import init, {
	generate_spectrogram_image,
	initThreadPool,
	SpectrogramConfig,
} from "$/modules/spectrogram/vendor";
import type { SpectrogramWorkerScope } from "$/modules/spectrogram/workers/types";

const ctx: SpectrogramWorkerScope = self as SpectrogramWorkerScope;

let audioSampleRate: number = 0;
let audioDuration: number = 0;
let wasmInitialized: Promise<void> | null = null;
let currentPalette: Uint8Array | null = null;
let opfsAccessHandle: FileSystemSyncAccessHandle | null = null;
let reusableBuffer = new Float32Array(480000);

const opfsChannel = new BroadcastChannel("opfs-lock-channel");

async function initializeWasm() {
	if (!wasmInitialized) {
		wasmInitialized = (async () => {
			await init();
			await initThreadPool(navigator.hardwareConcurrency);
		})();
	}
	await wasmInitialized;
}

ctx.onmessage = async (event) => {
	await initializeWasm();

	const msg = event.data;

	opfsChannel.onmessage = (e) => {
		if (e.data === "DEMAND_LOCK") {
			if (opfsAccessHandle) {
				opfsAccessHandle.close();
				opfsAccessHandle = null;
			}

			opfsChannel.postMessage("OPFS_RELEASED");
		}
	};

	switch (msg.type) {
		case "INIT":
			audioSampleRate = msg.sampleRate;
			audioDuration = msg.duration;
			currentPalette = null;

			try {
				const rootDir = await navigator.storage.getDirectory();
				const fileHandle = await rootDir.getFileHandle("audio_cache.pcm");

				if (opfsAccessHandle) {
					opfsAccessHandle.close();
				}
				opfsAccessHandle = await fileHandle.createSyncAccessHandle();

				ctx.postMessage({ type: "INIT_COMPLETE" });
			} catch (e) {
				console.error("[Spectrogram Worker] 无法打开 OPFS 缓存文件:", e);
				ctx.postMessage({
					type: "ERROR",
					reqId: -1,
					message: "无法打开音频缓存",
				});
			}
			break;

		case "RELEASE":
			if (opfsAccessHandle) {
				opfsAccessHandle.close();
				opfsAccessHandle = null;
			}
			opfsChannel.postMessage("OPFS_RELEASED");
			break;

		case "SET_PALETTE":
			currentPalette = msg.palette;
			break;

		case "GET_TILE": {
			const { reqId, params } = msg;

			if (!opfsAccessHandle || !audioSampleRate || !currentPalette) {
				ctx.postMessage({
					type: "ERROR",
					reqId,
					message: "Worker not ready",
				});
				return;
			}

			const { startTime, endTime, gain, tileWidthPx, height } = params;

			const startSample = Math.floor(startTime * audioSampleRate);
			const endSample = Math.ceil(endTime * audioSampleRate);
			const samplesToRead = endSample - startSample;

			const totalSamples = Math.ceil(audioDuration * audioSampleRate);

			if (startSample >= totalSamples) {
				ctx.postMessage({
					type: "ERROR",
					reqId,
					message: "Out of bounds",
				});
				return;
			}

			try {
				if (samplesToRead > reusableBuffer.length) {
					reusableBuffer = new Float32Array(samplesToRead);
				}

				const byteOffset = startSample * 4;
				const byteView = new Uint8Array(
					reusableBuffer.buffer,
					0,
					samplesToRead * 4,
				);

				const bytesRead = opfsAccessHandle.read(byteView, { at: byteOffset });
				const actualSamplesRead = bytesRead / 4;

				if (actualSamplesRead === 0) {
					throw new Error("No data read from OPFS");
				}

				const audioSlice = new Float32Array(
					reusableBuffer.buffer,
					0,
					actualSamplesRead,
				);

				const FFT_SIZE = 1024;
				const HOP_LENGTH = 64;

				const config = new SpectrogramConfig(
					audioSampleRate,
					FFT_SIZE,
					HOP_LENGTH,
					tileWidthPx,
					height,
					gain,
				);

				const pixelData = generate_spectrogram_image(
					audioSlice,
					currentPalette,
					config,
				);

				config.free();

				const canvas = new OffscreenCanvas(tileWidthPx, height);
				const context = canvas.getContext("2d");
				if (!context) throw new Error("OffscreenCanvas context 失败");

				const imageData = new ImageData(
					new Uint8ClampedArray(pixelData),
					tileWidthPx,
					height,
				);
				context.putImageData(imageData, 0, 0);

				const imageBitmap = canvas.transferToImageBitmap();
				ctx.postMessage(
					{
						type: "TILE_READY",
						reqId,
						imageBitmap,
					},
					[imageBitmap],
				);
			} catch (e) {
				ctx.postMessage({
					type: "ERROR",
					reqId,
					message: (e as Error).message,
				});
			}
			break;
		}
	}
};
