import type { FFmpegWasmModule, FFmpegWasmModuleFactory } from "./types.ts";
import createModule from "./wasm/ffmpeg_wasm.js";

let wasmModule: FFmpegWasmModule | null = null;
let decoderPtr: number = 0;
let audioFile: File | null = null;
const readerSync = new FileReaderSync();

let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
let canvasWidth = 0;
let canvasHeight = 0;
let dpr = 1;

let peaksCapacity = 16384 * 3;
let peaksBuffer = new Float32Array(peaksCapacity);
let peaksCount = 0;

let totalSamples = 0;
let totalDuration = 0;
let isAnalyzing = false;
let primaryColor = "#00ffa21e";

let opfsAccessHandle: FileSystemSyncAccessHandle | null = null;
const TARGET_SAMPLE_RATE = 48000;

const opfsChannel = new BroadcastChannel("opfs-lock-channel");

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

function pushPeak(progress: number, min: number, max: number) {
	if (peaksCount + 3 > peaksCapacity) {
		peaksCapacity *= 2;
		const newBuffer = new Float32Array(peaksCapacity);
		newBuffer.set(peaksBuffer);
		peaksBuffer = newBuffer;
	}
	peaksBuffer[peaksCount++] = progress;
	peaksBuffer[peaksCount++] = min;
	peaksBuffer[peaksCount++] = max;
}

function drawWaveform() {
	if (
		!offscreenCtx ||
		canvasWidth === 0 ||
		canvasHeight === 0 ||
		peaksCount === 0
	)
		return;

	offscreenCtx.clearRect(0, 0, canvasWidth, canvasHeight);

	offscreenCtx.fillStyle = primaryColor;
	offscreenCtx.beginPath();

	const halfH = canvasHeight / 2;
	const tripletCount = peaksCount / 3;
	const AMPLITUDE_SCALE = 0.6;

	for (let i = 0; i < tripletCount; i++) {
		const progress = peaksBuffer[i * 3];
		const maxVal = peaksBuffer[i * 3 + 2];

		const x = progress * canvasWidth;
		const yMax = halfH - maxVal * halfH * AMPLITUDE_SCALE;

		if (i === 0) offscreenCtx.moveTo(x, yMax);
		else offscreenCtx.lineTo(x, yMax);
	}

	for (let i = tripletCount - 1; i >= 0; i--) {
		const progress = peaksBuffer[i * 3];
		const minVal = peaksBuffer[i * 3 + 1];

		const x = progress * canvasWidth;
		const yMin = halfH - minVal * halfH * AMPLITUDE_SCALE;

		offscreenCtx.lineTo(x, yMin);
	}
	offscreenCtx.closePath();
	offscreenCtx.fill();
}

const yieldChannel = new MessageChannel();
yieldChannel.port1.onmessage = () => analyzeLoop();

function analyzeLoop() {
	if (!isAnalyzing || !wasmModule || decoderPtr === 0) return;
	const BATCH_FRAMES = 1000;

	let eof = false;

	const expectedTotalSamples = totalDuration * TARGET_SAMPLE_RATE;

	for (let i = 0; i < BATCH_FRAMES; i++) {
		const status = wasmModule._wasm_decoder_decode_frame(decoderPtr);
		if (status === 1) {
			const frameSamples =
				wasmModule._wasm_decoder_get_frame_samples(decoderPtr);

			if (opfsAccessHandle && frameSamples > 0) {
				const ptr = wasmModule._wasm_decoder_get_channel_ptr(decoderPtr, 0);
				const pcmView = new Float32Array(
					wasmModule.wasmMemory.buffer,
					ptr,
					frameSamples,
				);
				opfsAccessHandle.write(pcmView);
			}

			totalSamples += frameSamples;

			let progress =
				expectedTotalSamples > 0 ? totalSamples / expectedTotalSamples : 0;
			progress = Math.min(progress, 1.0);
			const min = wasmModule._wasm_decoder_get_frame_min(decoderPtr);
			const max = wasmModule._wasm_decoder_get_frame_max(decoderPtr);

			pushPeak(progress, min, max);
		} else if (status === 0) {
			eof = true;
			break;
		} else {
			console.error("[Analyzer] decode error");
			eof = true;
			break;
		}
	}

	drawWaveform();

	if (!eof) {
		yieldChannel.port2.postMessage(null);
	} else {
		isAnalyzing = false;

		if (peaksCount >= 3) {
			const maxProgress = peaksBuffer[peaksCount - 3];
			if (maxProgress > 0 && maxProgress < 1.0) {
				const tripletCount = peaksCount / 3;
				for (let i = 0; i < tripletCount; i++) {
					peaksBuffer[i * 3] /= maxProgress;
				}
			}
		}
		drawWaveform();

		if (opfsAccessHandle) {
			opfsAccessHandle.flush();
			opfsAccessHandle.close();
			opfsAccessHandle = null;
		}

		self.postMessage({ type: "ANALYZE_DONE" });

		wasmModule._wasm_decoder_destroy(decoderPtr);
		decoderPtr = 0;
	}
}

self.onmessage = async (e: MessageEvent) => {
	const { type, payload } = e.data;

	if (type === "INIT") {
		const {
			file,
			ffmpegWasmUrl,
			canvas,
			width,
			height,
			dpr: deviceDpr,
			color,
		} = payload;

		audioFile = file;
		canvasWidth = width;
		canvasHeight = height;
		dpr = deviceDpr;
		if (color) primaryColor = color;

		if (canvas) {
			offscreenCtx = (canvas as OffscreenCanvas).getContext("2d", {
				alpha: true,
				desynchronized: true,
			});
		}

		if (offscreenCtx) {
			offscreenCtx.canvas.width = canvasWidth * dpr;
			offscreenCtx.canvas.height = canvasHeight * dpr;
			offscreenCtx.scale(dpr, dpr);
		}

		try {
			const rootDir = await navigator.storage.getDirectory();
			const fileHandle = await rootDir.getFileHandle("audio_cache.pcm", {
				create: true,
			});

			const acquireLockAndInit = async () => {
				opfsAccessHandle = await fileHandle.createSyncAccessHandle();
				opfsAccessHandle.truncate(0);

				wasmModule = await initWasm(ffmpegWasmUrl);
				decoderPtr = wasmModule._wasm_decoder_create(1, TARGET_SAMPLE_RATE, 1);

				if (decoderPtr === 0) throw new Error("Failed to create Wasm Decoder");
				wasmModule._wasm_decoder_set_compute_peaks(decoderPtr, 1);
				totalDuration = wasmModule._wasm_decoder_get_duration(decoderPtr);

				peaksCount = 0;
				totalSamples = 0;
				isAnalyzing = true;

				analyzeLoop();
			};

			try {
				await acquireLockAndInit();
			} catch (e) {
				if ((e as Error).name === "NoModificationAllowedError") {
					opfsChannel.onmessage = async (e) => {
						if (e.data === "OPFS_RELEASED") {
							opfsChannel.onmessage = null;
							await acquireLockAndInit();
						}
					};

					opfsChannel.postMessage("DEMAND_LOCK");
				} else {
					throw e;
				}
			}
		} catch (err) {
			console.error("[Analyzer] Init Failed:", err);

			if (opfsAccessHandle) {
				opfsAccessHandle.close();
				opfsAccessHandle = null;
			}
		}
	} else if (type === "RESIZE") {
		canvasWidth = payload.width;
		canvasHeight = payload.height;
		dpr = payload.dpr;
		if (payload.color) primaryColor = payload.color;

		if (offscreenCtx && canvasWidth > 0 && canvasHeight > 0) {
			offscreenCtx.canvas.width = canvasWidth * dpr;
			offscreenCtx.canvas.height = canvasHeight * dpr;
			offscreenCtx.scale(dpr, dpr);
			drawWaveform();
		}
	}
};
