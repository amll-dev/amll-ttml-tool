//#region Internal Constants
const CONTROL_BLOCK_BYTES = 64;

const STATE_PLAYING = 0;
const STATE_IS_SEEKING = 1;
const STATE_READ_INDEX = 2;
const STATE_WRITE_INDEX = 3;
const STATE_PLAYBACK_INDEX = 4;
const STATE_PAUSE_AT_INDEX = 5;

const RING_BUFFER_CAPACITY = 192000 * 2;
const RING_BUFFER_BYTES_PER_CHANNEL = RING_BUFFER_CAPACITY * 4;
//#endregion

//#region Public Interfaces
/**
 * Controls the global playback state and retrieves the current read position.
 *
 * Typically used by the main thread.
 */
export interface MainAudioController {
	play(): void;
	pause(): void;
	/**
	 * Returns the absolute number of frames consumed by the reader so far.
	 */
	getReadIndex(): number;
	getPlaybackIndex(): number;
	setSeeking(isSeeking: boolean): void;
	setPauseAtIndex(index: number): void;
	clearPauseAtIndex(): void;
}

/**
 * Provides write access to the audio queue.
 *
 * Typically used by the decoding worker.
 */
export interface AudioWriter {
	/**
	 * Returns the number of frames that can currently be written to the buffer.
	 */
	getAvailableWriteSpace(): number;

	/**
	 * Attempts to write audio frames into the buffer up to the available capacity.
	 *
	 * @param channelDatas An array of Float32Arrays representing planar audio channels.
	 * @param offset The starting index in the source arrays.
	 * @param length The number of frames to write.
	 * @returns The actual number of frames written.
	 */
	writePartial(
		channelDatas: Float32Array[],
		offset: number,
		length: number,
	): number;

	/**
	 * Suspends reading operations and resets the read/write indices for seeking.
	 */
	beginSeek(): void;

	/**
	 * Resumes normal operations after a seek.
	 */
	endSeek(): void;

	/**
	 * Asynchronously waits until the consumer frees up space in the buffer.
	 *
	 * @returns An object indicating whether the thread was suspended. If `async` is true,
	 * the `promise` resolves when space might be available.
	 */
	waitForSpaceAsync(): { async: boolean; promise?: Promise<void> };

	/**
	 * Asynchronously waits until all data currently in the buffer has been consumed.
	 *
	 * @returns An object indicating whether the buffer is fully drained. If not, and it
	 * suspended successfully, the `promise` resolves when the state changes.
	 */
	waitForDrainAsync(): { isDrained: boolean; promise?: Promise<void> };
}

/**
 * Provides read access to the audio queue.
 *
 * Typically used by the AudioWorkletProcessor.
 */
export interface AudioReader {
	/**
	 * Reads audio frames from the buffer into the provided output arrays.
	 * Automatically outputs silence if playback is paused, seeking, or if underflow occurs.
	 * @param outputs A 2D array representing the destination channels.
	 * @param outLen The number of frames requested by the audio context.
	 */
	read(outputs: Float32Array[][], outLen: number): void;
	/**
	 * Returns true if the playback state is currently set to playing.
	 */
	isPlaying(): boolean;
	/**
	 * Returns true if the player is currently seeking.
	 */
	isSeeking(): boolean;
	/**
	 * Probe: Returns the number of actual audio frames available to read in the buffer.
	 */
	getAvailableReadFrames(): number;
	/**
	 * Pulls a specific number of audio frames from the buffer into the output arrays.
	 * Does NOT pad with silence. Returns only the actual number of frames read.
	 *
	 * @param outputs An array of Float32Arrays representing destination channels (often mapped to Wasm memory).
	 * @param length The maximum number of frames requested.
	 * @returns The actual number of frames successfully read.
	 */
	readPartial(outputs: Float32Array[], length: number): number;
	addPlaybackIndex(frames: number): void;
	getPlaybackIndex(): number;
	getPauseAtIndex(): number;
	clearPauseAtIndex(): void;
	pausePlayback(): void;
}
//#endregion

//#region Core Implementation
class AudioQueueCore implements MainAudioController, AudioWriter, AudioReader {
	private controlBlock: Int32Array;
	private channelBuffers: Float32Array[] = [];
	private channels: number;

	constructor(sab: SharedArrayBuffer, channels: number) {
		this.channels = channels;
		this.controlBlock = new Int32Array(sab, 0, CONTROL_BLOCK_BYTES / 4);

		for (let c = 0; c < channels; c++) {
			const offset = CONTROL_BLOCK_BYTES + c * RING_BUFFER_BYTES_PER_CHANNEL;
			this.channelBuffers.push(
				new Float32Array(sab, offset, RING_BUFFER_CAPACITY),
			);
		}
	}

	//#region MainAudioController
	play(): void {
		Atomics.store(this.controlBlock, STATE_PLAYING, 1);
	}

	pause(): void {
		Atomics.store(this.controlBlock, STATE_PLAYING, 0);
	}

	getReadIndex(): number {
		return Atomics.load(this.controlBlock, STATE_READ_INDEX);
	}

	getPlaybackIndex(): number {
		return Atomics.load(this.controlBlock, STATE_PLAYBACK_INDEX);
	}

	setSeeking(isSeeking: boolean): void {
		Atomics.store(this.controlBlock, STATE_IS_SEEKING, isSeeking ? 1 : 0);
	}

	setPauseAtIndex(index: number): void {
		Atomics.store(this.controlBlock, STATE_PAUSE_AT_INDEX, index);
	}

	clearPauseAtIndex(): void {
		Atomics.store(this.controlBlock, STATE_PAUSE_AT_INDEX, -1);
	}
	//#endregion

	//#region AudioWriter
	getAvailableWriteSpace(): number {
		const writeIndex = Atomics.load(this.controlBlock, STATE_WRITE_INDEX);
		const readIndex = Atomics.load(this.controlBlock, STATE_READ_INDEX);
		return RING_BUFFER_CAPACITY - (writeIndex - readIndex);
	}

	writePartial(
		channelDatas: Float32Array[],
		offset: number,
		length: number,
	): number {
		const writeIndex = Atomics.load(this.controlBlock, STATE_WRITE_INDEX);
		const readIndex = Atomics.load(this.controlBlock, STATE_READ_INDEX);

		const availableSpace = RING_BUFFER_CAPACITY - (writeIndex - readIndex);
		const writeAmount = Math.min(length, availableSpace);

		if (writeAmount === 0) {
			return 0;
		}

		const ringPos = writeIndex % RING_BUFFER_CAPACITY;
		const spaceToEnd = RING_BUFFER_CAPACITY - ringPos;

		for (let c = 0; c < this.channels; c++) {
			const source = channelDatas[c];
			const target = this.channelBuffers[c];

			if (writeAmount <= spaceToEnd) {
				target.set(source.subarray(offset, offset + writeAmount), ringPos);
			} else {
				target.set(source.subarray(offset, offset + spaceToEnd), ringPos);
				target.set(
					source.subarray(offset + spaceToEnd, offset + writeAmount),
					0,
				);
			}
		}

		Atomics.add(this.controlBlock, STATE_WRITE_INDEX, writeAmount);
		return writeAmount;
	}

	beginSeek(): void {
		Atomics.store(this.controlBlock, STATE_IS_SEEKING, 1);
		Atomics.store(this.controlBlock, STATE_WRITE_INDEX, 0);
		Atomics.store(this.controlBlock, STATE_READ_INDEX, 0);
		Atomics.store(this.controlBlock, STATE_PLAYBACK_INDEX, 0);
		Atomics.notify(this.controlBlock, STATE_READ_INDEX, 1);
	}

	endSeek(): void {
		Atomics.store(this.controlBlock, STATE_IS_SEEKING, 0);
	}

	waitForSpaceAsync(): { async: boolean; promise?: Promise<void> } {
		const currentReadIndex = Atomics.load(this.controlBlock, STATE_READ_INDEX);
		const waitResult = Atomics.waitAsync(
			this.controlBlock,
			STATE_READ_INDEX,
			currentReadIndex,
		);

		if (waitResult.async) {
			const voidPromise = (waitResult.value as Promise<string>).then(() => {});
			return { async: true, promise: voidPromise };
		}

		return { async: false };
	}

	waitForDrainAsync(): { isDrained: boolean; promise?: Promise<void> } {
		const writeIndex = Atomics.load(this.controlBlock, STATE_WRITE_INDEX);
		const readIndex = Atomics.load(this.controlBlock, STATE_READ_INDEX);

		if (readIndex >= writeIndex) {
			return { isDrained: true };
		}

		const waitResult = Atomics.waitAsync(
			this.controlBlock,
			STATE_READ_INDEX,
			readIndex,
		);

		if (waitResult.async) {
			const voidPromise = (waitResult.value as Promise<string>).then(() => {});
			return { isDrained: false, promise: voidPromise };
		}

		return { isDrained: false };
	}
	//#endregion

	//#region AudioReader
	read(outputs: Float32Array[][], outLen: number): void {
		const isPlaying = Atomics.load(this.controlBlock, STATE_PLAYING) === 1;
		const isSeeking = Atomics.load(this.controlBlock, STATE_IS_SEEKING) === 1;

		if (!isPlaying || isSeeking) {
			this.fillSilence(outputs);
			return;
		}

		const writeIndex = Atomics.load(this.controlBlock, STATE_WRITE_INDEX);
		const readIndex = Atomics.load(this.controlBlock, STATE_READ_INDEX);
		const availableData = writeIndex - readIndex;

		if (availableData < outLen) {
			this.fillSilence(outputs);
			return;
		}

		const ringPos = readIndex % RING_BUFFER_CAPACITY;
		const spaceToEnd = RING_BUFFER_CAPACITY - ringPos;
		const output = outputs[0];

		for (let c = 0; c < this.channels; c++) {
			if (!output[c]) continue;

			if (outLen <= spaceToEnd) {
				output[c].set(
					this.channelBuffers[c].subarray(ringPos, ringPos + outLen),
				);
			} else {
				output[c].set(
					this.channelBuffers[c].subarray(ringPos, RING_BUFFER_CAPACITY),
					0,
				);
				const remaining = outLen - spaceToEnd;
				output[c].set(
					this.channelBuffers[c].subarray(0, remaining),
					spaceToEnd,
				);
			}
		}

		Atomics.add(this.controlBlock, STATE_READ_INDEX, outLen);
		Atomics.notify(this.controlBlock, STATE_READ_INDEX, 1);
	}

	isPlaying(): boolean {
		return Atomics.load(this.controlBlock, STATE_PLAYING) === 1;
	}

	isSeeking(): boolean {
		return Atomics.load(this.controlBlock, STATE_IS_SEEKING) === 1;
	}

	getAvailableReadFrames(): number {
		const writeIndex = Atomics.load(this.controlBlock, STATE_WRITE_INDEX);
		const readIndex = Atomics.load(this.controlBlock, STATE_READ_INDEX);
		return writeIndex - readIndex;
	}

	readPartial(outputs: Float32Array[], length: number): number {
		if (!this.isPlaying() || this.isSeeking()) {
			return 0;
		}

		const writeIndex = Atomics.load(this.controlBlock, STATE_WRITE_INDEX);
		const readIndex = Atomics.load(this.controlBlock, STATE_READ_INDEX);
		const availableData = writeIndex - readIndex;
		const readAmount = Math.min(length, availableData);

		if (readAmount === 0) {
			return 0;
		}

		const ringPos = readIndex % RING_BUFFER_CAPACITY;
		const spaceToEnd = RING_BUFFER_CAPACITY - ringPos;
		for (let c = 0; c < this.channels; c++) {
			if (!outputs[c]) continue;
			if (readAmount <= spaceToEnd) {
				outputs[c].set(
					this.channelBuffers[c].subarray(ringPos, ringPos + readAmount),
				);
			} else {
				outputs[c].set(
					this.channelBuffers[c].subarray(ringPos, RING_BUFFER_CAPACITY),
					0,
				);
				const remaining = readAmount - spaceToEnd;
				outputs[c].set(
					this.channelBuffers[c].subarray(0, remaining),
					spaceToEnd,
				);
			}
		}

		Atomics.add(this.controlBlock, STATE_READ_INDEX, readAmount);
		Atomics.notify(this.controlBlock, STATE_READ_INDEX, 1);
		return readAmount;
	}

	addPlaybackIndex(frames: number): void {
		Atomics.add(this.controlBlock, STATE_PLAYBACK_INDEX, frames);
	}

	getPauseAtIndex(): number {
		return Atomics.load(this.controlBlock, STATE_PAUSE_AT_INDEX);
	}

	pausePlayback(): void {
		Atomics.store(this.controlBlock, STATE_PLAYING, 0);
	}
	//#endregion

	private fillSilence(outputs: Float32Array[][]): void {
		const output = outputs[0];
		if (!output) return;

		for (let c = 0; c < this.channels; c++) {
			if (output[c]) {
				output[c].fill(0);
			}
		}
	}
}
//#endregion

//#region Public Allocators & Factories
/**
 * Allocates the shared memory required for the audio queue.
 *
 * @param channels The number of audio channels.
 * @returns A strictly sized SharedArrayBuffer.
 */
export function allocateAudioQueueMemory(channels: number): SharedArrayBuffer {
	const sabBytes =
		CONTROL_BLOCK_BYTES + RING_BUFFER_BYTES_PER_CHANNEL * channels;
	const sab = new SharedArrayBuffer(sabBytes);

	const controlBlock = new Int32Array(sab, 0, CONTROL_BLOCK_BYTES / 4);
	Atomics.store(controlBlock, STATE_PAUSE_AT_INDEX, -1);

	return sab;
}

/**
 * Creates the controller interface for the main thread.
 */
export function createMainController(
	sab: SharedArrayBuffer,
	channels: number,
): MainAudioController {
	return new AudioQueueCore(sab, channels);
}

/**
 * Creates the writer interface for the decoding worker.
 */
export function createAudioWriter(
	sab: SharedArrayBuffer,
	channels: number,
): AudioWriter {
	return new AudioQueueCore(sab, channels);
}

/**
 * Creates the reader interface for the audio worklet.
 */
export function createAudioReader(
	sab: SharedArrayBuffer,
	channels: number,
): AudioReader {
	return new AudioQueueCore(sab, channels);
}
//#endregion
