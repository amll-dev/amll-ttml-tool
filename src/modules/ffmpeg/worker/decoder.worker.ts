import { type AudioWriter, createAudioWriter } from "../queue";
import type { FFmpegWasmModule, FFmpegWasmModuleFactory } from "./types.ts";
import createModule from "./wasm/ffmpeg_wasm.js";

let wasmModule: FFmpegWasmModule | null = null;
let audioFile: File | null = null;
const readerSync = new FileReaderSync();

let decoderPtr: number = 0;
let isDecoding = false;
let eofPending = false;

let audioWriter: AudioWriter | null = null;
let targetChannels = 2;
let targetSampleRate = 48000;
const yieldChannel = new MessageChannel();
let isProcessing = false;
let currentSeekGeneration = 0;

yieldChannel.port1.onmessage = () => {
	processFrame();
};

async function initWasm(ffmpegWasmUrl: string): Promise<FFmpegWasmModule> {
	return await (createModule as unknown as FFmpegWasmModuleFactory)({
		locateFile: () => ffmpegWasmUrl,

		js_get_file_size: (_file_id: number): number => {
			return audioFile ? audioFile.size : -1;
		},

		js_read_file: (
			_file_id: number,
			offset: number,
			length: number,
		): ArrayBuffer | null => {
			if (!audioFile) return null;
			try {
				const blobSlice = audioFile.slice(offset, offset + length);
				return readerSync.readAsArrayBuffer(blobSlice);
			} catch (err) {
				console.error("read error:", err);
				return null;
			}
		},
	});
}

async function processFrame() {
	if (!wasmModule || !isDecoding || decoderPtr === 0 || !audioWriter) {
		return;
	}

	if (isProcessing) {
		return;
	}
	isProcessing = true;
	const myGeneration = currentSeekGeneration;

	try {
		const status = wasmModule._wasm_decoder_decode_frame(decoderPtr);

		if (status === 1) {
			const samples = wasmModule._wasm_decoder_get_frame_samples(decoderPtr);
			const memoryBuffer = wasmModule.wasmMemory.buffer;

			const channelDatas: Float32Array[] = [];
			for (let c = 0; c < targetChannels; c++) {
				const ptr = wasmModule._wasm_decoder_get_channel_ptr(decoderPtr, c);
				channelDatas.push(new Float32Array(memoryBuffer, ptr, samples));
			}

			let written = 0;
			while (written < samples) {
				if (!isDecoding || myGeneration !== currentSeekGeneration) {
					return;
				}

				const remaining = samples - written;
				const pushed = audioWriter.writePartial(
					channelDatas,
					written,
					remaining,
				);
				written += pushed;

				if (pushed === 0) {
					const { async, promise } = audioWriter.waitForSpaceAsync();
					if (async && promise) {
						await promise;
					}
				}
			}
		} else if (status === 0) {
			isDecoding = false;
			eofPending = true;
			checkEofDrained();
			return;
		} else {
			console.error("Decoder: Fatal decoding error.");
			isDecoding = false;
			self.postMessage({ type: "DECODE_ERROR" });
			return;
		}
	} finally {
		isProcessing = false;

		if (myGeneration !== currentSeekGeneration && isDecoding) {
			processFrame();
		}
	}

	if (isDecoding) {
		yieldChannel.port2.postMessage(null);
	}
}

function checkEofDrained() {
	if (!eofPending || !audioWriter) return;

	const { isDrained, promise } = audioWriter.waitForDrainAsync();

	if (isDrained) {
		eofPending = false;
		self.postMessage({ type: "DECODE_EOF" });
		return;
	}

	if (promise) {
		promise.then(() => checkEofDrained());
	} else {
		checkEofDrained();
	}
}

self.onmessage = async (e: MessageEvent) => {
	const { type, payload } = e.data;

	if (type === "INIT") {
		try {
			audioFile = payload.file;
			targetSampleRate = payload.sampleRate;
			targetChannels = payload.channels;
			audioWriter = createAudioWriter(payload.sharedBuffer, targetChannels);
			wasmModule = await initWasm(payload.ffmpegWasmUrl);

			decoderPtr = wasmModule._wasm_decoder_create(
				1,
				targetSampleRate,
				targetChannels,
			);
			if (decoderPtr === 0)
				throw new Error("Failed to create Wasm Decoder Context");

			const duration = wasmModule._wasm_decoder_get_duration(decoderPtr);
			const metadataJsonPtr =
				wasmModule._wasm_decoder_get_metadata_json(decoderPtr);
			const metadataJson = wasmModule.UTF8ToString(metadataJsonPtr);
			const metadata = JSON.parse(metadataJson);

			let coverBytes: ArrayBuffer | null = null;
			let coverMime: string | null = null;
			const coverSize = wasmModule._wasm_decoder_get_cover_size(decoderPtr);

			if (coverSize > 0) {
				const coverPtr = wasmModule._wasm_decoder_get_cover_ptr(decoderPtr);
				const memoryBuffer = wasmModule.wasmMemory.buffer;
				coverBytes = memoryBuffer.slice(coverPtr, coverPtr + coverSize);
				const mimePtr = wasmModule._wasm_decoder_get_cover_mime(decoderPtr);
				if (mimePtr !== 0) coverMime = wasmModule.UTF8ToString(mimePtr);
			}

			self.postMessage({
				type: "INIT_DONE",
				payload: { duration, metadata, coverBytes, coverMime },
			});
		} catch (err) {
			console.error("Worker Init Failed:", err);
			self.postMessage({ type: "INIT_ERROR", error: String(err) });
		}
	} else if (type === "PLAY") {
		if (!isDecoding) {
			isDecoding = true;
			processFrame();
		}
	} else if (type === "PAUSE") {
		isDecoding = false;
	} else if (type === "SEEK") {
		if (!wasmModule || !audioWriter) return;
		eofPending = false;
		currentSeekGeneration++;

		audioWriter.beginSeek();
		wasmModule._wasm_decoder_seek(decoderPtr, payload.targetSeconds);
		audioWriter.endSeek();

		if (!isDecoding) {
			isDecoding = true;
		}
		processFrame();
	}
};
