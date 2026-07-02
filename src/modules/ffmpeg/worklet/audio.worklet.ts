import "./polyfill.ts";
import { type AudioReader, createAudioReader } from "../queue";
import initWasm, { SoundTouchProcessor } from "./wasm/soundtouch.js";

const WORKLET_BLOCK_SIZE = 128;
const INPUT_CHUNK_SIZE = 2048;

class FFmpegAudioProcessor extends AudioWorkletProcessor {
	private audioReader: AudioReader | null = null;
	private stProcessor: SoundTouchProcessor | null = null;
	private wasmMemory: WebAssembly.Memory | null = null;

	private channels: number = 2;
	private currentTempo: number = 1.0;
	private currentRate: number = 1.0;
	private playbackFractional: number = 0.0;

	private wasSeeking: boolean = false;

	constructor() {
		super();

		this.port.addEventListener("message", async (event) => {
			const { type, payload } = event.data;

			if (type === "INIT") {
				const { sharedBuffer, channels, wasmBytes, initId } = payload;
				this.channels = channels;
				this.audioReader = createAudioReader(sharedBuffer, channels);

				const wasmInstance = await initWasm({ module_or_path: wasmBytes });
				this.wasmMemory = wasmInstance.memory;
				this.stProcessor = new SoundTouchProcessor(channels, sampleRate);

				this.port.postMessage({
					type: "INIT_DONE",
					payload: { initId },
				});
			} else if (type === "SET_TEMPO" && this.stProcessor) {
				this.stProcessor.setTempo(payload.tempo);
				this.currentTempo = payload.tempo;
			} else if (type === "SET_PITCH" && this.stProcessor) {
				this.stProcessor.setPitch(payload.pitch);
			} else if (type === "SET_RATE" && this.stProcessor) {
				this.stProcessor.setRate(payload.rate);
				this.currentRate = payload.rate;
			} else if (type === "DESTROY") {
				if (this.stProcessor) {
					this.stProcessor.free();
					this.stProcessor = null;
				}
				this.wasmMemory = null;
				this.audioReader = null;
			}
		});

		this.port.start();
	}

	process(
		_inputs: Float32Array[][],
		outputs: Float32Array[][],
		_parameters: Record<string, Float32Array>,
	): boolean {
		const output = outputs[0];
		if (
			!this.audioReader ||
			!this.stProcessor ||
			!this.wasmMemory ||
			!output[0]
		) {
			return true;
		}

		const isCurrentlySeeking = this.audioReader.isSeeking();
		if (this.wasSeeking && !isCurrentlySeeking) {
			this.stProcessor.clear();
			this.playbackFractional = 0.0;
		}
		this.wasSeeking = isCurrentlySeeking;

		if (!this.audioReader.isPlaying() || isCurrentlySeeking) {
			this.fillSilence(output, WORKLET_BLOCK_SIZE);
			return true;
		}

		const targetPauseIndex = this.audioReader.getPauseAtIndex();
		let remainingSourceFrames = Infinity;
		let isHittingTarget = false;

		if (targetPauseIndex !== -1) {
			const exactCurrentIndex =
				this.audioReader.getPlaybackIndex() + this.playbackFractional;
			remainingSourceFrames = targetPauseIndex - exactCurrentIndex;

			if (remainingSourceFrames <= 0) {
				this.fillSilence(output, WORKLET_BLOCK_SIZE);
				this.audioReader.clearPauseAtIndex();
				this.audioReader.pausePlayback();
				this.port.postMessage({ type: "AUTO_PAUSED" });
				return true;
			}
		}

		while (this.stProcessor.numSamples() < WORKLET_BLOCK_SIZE) {
			const availableInSAB = this.audioReader.getAvailableReadFrames();
			if (availableInSAB === 0) {
				break;
			}

			const readAmount = Math.min(availableInSAB, INPUT_CHUNK_SIZE);

			const wasmInputs: Float32Array[] = [];
			for (let c = 0; c < this.channels; c++) {
				const ptr = this.stProcessor.getInputPtr(c);
				wasmInputs.push(
					new Float32Array(this.wasmMemory.buffer, ptr, readAmount),
				);
			}

			const actualRead = this.audioReader.readPartial(wasmInputs, readAmount);

			if (actualRead > 0) {
				this.stProcessor.processInput(actualRead);
			} else {
				break;
			}
		}

		const availableST = this.stProcessor.numSamples();
		let extractAmount = Math.min(availableST, WORKLET_BLOCK_SIZE);

		if (targetPauseIndex !== -1 && extractAmount > 0) {
			const timeRatio = this.currentTempo * this.currentRate;
			const allowedOutputFrames = Math.floor(remainingSourceFrames / timeRatio);

			if (extractAmount >= allowedOutputFrames) {
				extractAmount = Math.max(0, allowedOutputFrames);
				isHittingTarget = true;
			}
		}

		let extracted = 0;

		if (extractAmount > 0) {
			extracted = this.stProcessor.extractOutput(extractAmount);

			const actualChannels = Math.min(this.channels, output.length);
			for (let c = 0; c < actualChannels; c++) {
				const ptr = this.stProcessor.getOutputPtr(c);
				const wasmOutput = new Float32Array(
					this.wasmMemory.buffer,
					ptr,
					extracted,
				);
				output[c].set(wasmOutput);
			}

			const consumedSourceFrames =
				extracted * this.currentTempo * this.currentRate;
			const totalToAccumulate = consumedSourceFrames + this.playbackFractional;

			const integerPart = Math.floor(totalToAccumulate);
			this.playbackFractional = totalToAccumulate - integerPart;

			if (integerPart > 0) {
				this.audioReader.addPlaybackIndex(integerPart);
			}
		}

		if (extracted < WORKLET_BLOCK_SIZE) {
			const actualChannels = Math.min(this.channels, output.length);
			for (let c = 0; c < actualChannels; c++) {
				output[c].fill(0, extracted);
			}
		}

		if (isHittingTarget) {
			this.audioReader.clearPauseAtIndex();
			this.audioReader.pausePlayback();
			this.port.postMessage({ type: "AUTO_PAUSED" });
		}

		return true;
	}

	private fillSilence(output: Float32Array[], length: number): void {
		const actualChannels = Math.min(this.channels, output.length);
		for (let c = 0; c < actualChannels; c++) {
			output[c].fill(0, 0, length);
		}
	}
}

registerProcessor("ffmpeg-audio", FFmpegAudioProcessor);
