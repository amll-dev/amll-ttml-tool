import {
	computeFrequencyBinRanges,
	type FrequencyBinRanges,
} from "$/modules/spectrogram/utils/frequency-mapping";
import {
	applyNaturalWeightingToLogValue,
	computeNaturalWeightingOffsets,
	maxNaturalWeightingAttenuation,
} from "$/modules/spectrogram/utils/natural-weighting";
import { baseFieldToColorIndices } from "$/modules/spectrogram/utils/reassigned-spectrogram";
import init, {
	generate_spectrogram_image,
	initThreadPool,
	SpectrogramConfig,
} from "$/modules/spectrogram/vendor";
import {
	computeReassignFieldInPool,
	disposeReassignPool,
	setReassignEpochSource,
} from "$/modules/spectrogram/workers/reassign-pool";
import type {
	SpectrogramWorkerScope,
	TileGenerationParams,
} from "$/modules/spectrogram/workers/types";
import { spectrogramLogger } from "../logger";

const ctx: SpectrogramWorkerScope = self as SpectrogramWorkerScope;

/** 普通频谱的 FFT 大小 */
const FFT_SIZE = 1024;
/** 普通频谱的帧移 */
const HOP_LENGTH = 64;
/** 渲染的最高频率 */
const MAX_RENDER_FREQUENCY = 20000;

/** 原始线性频谱缓存的字节上限 */
const RAW_CACHE_MAX_BYTES = 96 * 1024 * 1024;
/** 重分配频谱强度缓存的字节上限 */
const REASSIGN_CACHE_MAX_BYTES = 64 * 1024 * 1024;
/** 频率映射结果缓存的条目上限 */
const MAPPING_CACHE_MAX_ENTRIES = 8;
/** 自然加权逐行偏移缓存的条目上限 */
const NATURAL_WEIGHTING_CACHE_MAX_ENTRIES = 8;
/** 普通频谱逐行 LUT 缓存的条目上限 */
const NORMAL_LUT_CACHE_MAX_ENTRIES = 4;

let audioSampleRate: number = 0;
let audioDuration: number = 0;
let wasmInitialized: Promise<void> | null = null;
let currentPalette: Uint8Array | null = null;
let opfsAccessHandle: FileSystemSyncAccessHandle | null = null;
let reusableBuffer = new Float32Array(441000);
/** 主线程写入的「代」计数器，用来跳过已过期的排队请求 */
let sharedEpoch: Int32Array | null = null;

const opfsChannel = new BroadcastChannel("opfs-lock-channel");

/**
 * @description 恒等调色板
 *
 * 当调色板第 i 项为 [i, i, i, 255] 时，生成像素的 R 通道恰好等于
 * 该像素的强度索引（0~255），因此可以在不损失精度的前提下取回
 * 原始的线性频谱数据，再在 TS 侧做频率重映射和上色。
 */
const IDENTITY_PALETTE = (() => {
	const lut = new Uint8Array(256 * 4);
	for (let i = 0; i < 256; i++) {
		const offset = i * 4;
		lut[offset] = i;
		lut[offset + 1] = i;
		lut[offset + 2] = i;
		lut[offset + 3] = 255;
	}
	return lut;
})();

interface RawTile {
	width: number;
	/** 频率 bin 数量 */
	bins: number;
	/** 强度索引，布局为 [x * bins + bin] */
	data: Uint8Array;
}

/** 原始线性频谱缓存 */
const rawTileCache = new Map<string, RawTile>();
let rawTileCacheBytes = 0;
/** 频率重分配结果缓存 */
const frequencyMappingCache = new Map<string, FrequencyBinRanges>();
/** 相位声码器重分配频谱的「基础值场」缓存（与增益无关） */
const reassignCache = new Map<string, Float32Array>();
let reassignCacheBytes = 0;
/** 自然加权逐行偏移缓存 */
const naturalWeightingCache = new Map<string, Float32Array>();
/** 普通频谱逐行 LUT 缓存（每一行 256 项） */
const normalLutCache = new Map<string, Uint8Array>();

async function initializeWasm() {
	if (!wasmInitialized) {
		wasmInitialized = (async () => {
			await init();
			await initThreadPool(navigator.hardwareConcurrency);
		})();
	}
	await wasmInitialized;
}

function clearCaches() {
	rawTileCache.clear();
	rawTileCacheBytes = 0;
	frequencyMappingCache.clear();
	reassignCache.clear();
	reassignCacheBytes = 0;
	naturalWeightingCache.clear();
	normalLutCache.clear();
}

/**
 * @description 与 wasm-spectrogram 内部一致地计算频率 bin 数量
 */
function getNumFreqBins(sampleRate: number): number {
	const freqResolution = sampleRate / FFT_SIZE;
	return Math.min(
		Math.round(MAX_RENDER_FREQUENCY / freqResolution),
		Math.floor(FFT_SIZE / 2),
	);
}

/**
 * @description 从 OPFS 音频缓存中读取一段 PCM 切片
 *
 * 返回的 Float32Array 是 `reusableBuffer` 上的视图，仅供当次同步使用，
 * 不可跨消息持有。
 */
function readAudioSlice(
	startTime: number,
	endTime: number,
): Float32Array | null {
	if (!opfsAccessHandle || !audioSampleRate) return null;

	const startSample = Math.floor(startTime * audioSampleRate);
	const endSample = Math.ceil(endTime * audioSampleRate);
	const samplesToRead = endSample - startSample;
	const totalSamples = Math.ceil(audioDuration * audioSampleRate);

	if (samplesToRead <= 0 || startSample >= totalSamples) return null;

	if (samplesToRead > reusableBuffer.length) {
		reusableBuffer = new Float32Array(samplesToRead);
	}

	const byteOffset = startSample * 4;
	const byteView = new Uint8Array(reusableBuffer.buffer, 0, samplesToRead * 4);
	const bytesRead = opfsAccessHandle.read(byteView, { at: byteOffset });
	const actualSamplesRead = bytesRead / 4;

	if (actualSamplesRead === 0) return null;

	return new Float32Array(reusableBuffer.buffer, 0, actualSamplesRead);
}

function cacheRawTile(key: string, tile: RawTile) {
	const existing = rawTileCache.get(key);
	if (existing) {
		rawTileCacheBytes -= existing.data.byteLength;
		rawTileCache.delete(key);
	}
	rawTileCache.set(key, tile);
	rawTileCacheBytes += tile.data.byteLength;

	while (rawTileCacheBytes > RAW_CACHE_MAX_BYTES && rawTileCache.size > 1) {
		const oldestKey = rawTileCache.keys().next().value;
		if (oldestKey === undefined) break;
		const oldest = rawTileCache.get(oldestKey);
		rawTileCache.delete(oldestKey);
		if (oldest) rawTileCacheBytes -= oldest.data.byteLength;
	}
}

function cacheReassignTile(key: string, data: Float32Array) {
	const existing = reassignCache.get(key);
	if (existing) {
		reassignCacheBytes -= existing.byteLength;
		reassignCache.delete(key);
	}
	reassignCache.set(key, data);
	reassignCacheBytes += data.byteLength;

	while (
		reassignCacheBytes > REASSIGN_CACHE_MAX_BYTES &&
		reassignCache.size > 1
	) {
		const oldestKey = reassignCache.keys().next().value;
		if (oldestKey === undefined) break;
		const oldest = reassignCache.get(oldestKey);
		reassignCache.delete(oldestKey);
		if (oldest) reassignCacheBytes -= oldest.byteLength;
	}
}

function naturalWeightingApplies(
	params: TileGenerationParams,
	target: "normal" | "reassign",
): boolean {
	const scope = params.naturalWeightingScope;
	return scope === "both" || scope === target;
}

/**
 * @description 取（带缓存）某一套参数下的自然加权逐行偏移
 */
function getNaturalWeightingOffsets(
	height: number,
	logAmount: number,
	tiltDBPerOctave: number,
): Float32Array {
	if (!audioSampleRate) return new Float32Array(0);

	const freqResolution = audioSampleRate / FFT_SIZE;
	const maxAxisFrequency = getNumFreqBins(audioSampleRate) * freqResolution;
	const key = `${height}|${logAmount.toFixed(3)}|${tiltDBPerOctave}`;
	const cached = naturalWeightingCache.get(key);
	if (cached) return cached;

	const offsets = computeNaturalWeightingOffsets(
		height,
		freqResolution,
		maxAxisFrequency,
		logAmount,
		tiltDBPerOctave,
	);
	naturalWeightingCache.set(key, offsets);

	while (naturalWeightingCache.size > NATURAL_WEIGHTING_CACHE_MAX_ENTRIES) {
		const oldestKey = naturalWeightingCache.keys().next().value;
		if (oldestKey === undefined) break;
		naturalWeightingCache.delete(oldestKey);
	}

	return offsets;
}

interface NormalRenderParams {
	/** 渲染原始瓦片时使用的参考增益（预留了自然加权余量） */
	gainRef: number;
	/** 每一显示行 256 项的调色板索引查找表 */
	lut: Uint8Array;
}

/**
 * @description 预计算普通频谱的逐行 LUT
 *
 * 原始瓦片的每个像素是 `clamp(gainRef · L, 0, 1) × 255`（L = log10(m·k+1)）。
 * 这里对每一行、每一个可能的原始值，还原出 L 之后在**幅度域**施加自然加权
 * （`m' = m · 10^t`，等价于 `L' = log10((10^L − 1)·10^t + 1)`），再乘用户增益。
 * 因为是对 8bit 原始值建表，所以每个像素只剩一次查表。
 *
 * 注意不能在 L 上直接加 t：那会把静音/噪声底整体抬亮。
 */
function buildNormalLut(
	height: number,
	gain: number,
	lScale: number,
	offsets: Float32Array,
): Uint8Array {
	const lut = new Uint8Array(height * 256);
	for (let row = 0; row < height; row++) {
		const boost = offsets.length > row ? 10 ** offsets[row] : 1;
		const base = row * 256;
		for (let raw = 0; raw < 256; raw++) {
			const logValue = raw * lScale;
			const tilted = applyNaturalWeightingToLogValue(logValue, boost);
			const value = tilted * gain;
			lut[base + raw] =
				value <= 0 ? 0 : value >= 1 ? 255 : (value * 255 + 0.5) | 0;
		}
	}
	return lut;
}

/**
 * @description 计算普通频谱这一块的渲染参数
 *
 * 自然加权如果作用到普通频谱，就用一个更小的参考增益渲染原始瓦片，
 * 给「压低低频」预留余量，避免被 8bit 截断后无法还原；关闭时
 * gainRef 就等于用户增益，LUT 退化为恒等映射，结果与原来逐像素一致。
 */
function getNormalRenderParams(
	params: TileGenerationParams,
): NormalRenderParams {
	const tilt = naturalWeightingApplies(params, "normal")
		? params.naturalWeightingTilt
		: 0;
	const offsets = getNaturalWeightingOffsets(
		params.height,
		params.logAmount,
		tilt,
	);
	const maxAttenuation = maxNaturalWeightingAttenuation(offsets);

	// 需要的对数域捕获上限：最被压低的那一行也要能还原出白光
	const logCapture = Math.log10(
		1 + (10 ** (1 / params.gain) - 1) * 10 ** maxAttenuation,
	);
	const gainRef = 1 / logCapture;
	const lScale = 1 / (255 * gainRef);

	const key = `${params.height}|${params.gain}|${tilt}|${params.logAmount.toFixed(3)}`;
	const cached = normalLutCache.get(key);
	if (cached) {
		return { gainRef, lut: cached };
	}

	const lut = buildNormalLut(params.height, params.gain, lScale, offsets);
	normalLutCache.set(key, lut);
	while (normalLutCache.size > NORMAL_LUT_CACHE_MAX_ENTRIES) {
		const oldestKey = normalLutCache.keys().next().value;
		if (oldestKey === undefined) break;
		normalLutCache.delete(oldestKey);
	}
	return { gainRef, lut };
}

/**
 * @description 生成（或从缓存读取）一个瓦片的原始线性频谱
 */
function getRawTile(params: TileGenerationParams, gainRef: number): RawTile | null {
	if (!audioSampleRate) return null;

	const bins = getNumFreqBins(audioSampleRate);
	if (bins <= 0) return null;

	const key = `${params.tileIndex}|${params.tileWidthPx}|${gainRef.toFixed(4)}|${bins}`;
	const cached = rawTileCache.get(key);
	if (cached) {
		// LRU：移动到末尾
		rawTileCache.delete(key);
		rawTileCache.set(key, cached);
		return cached;
	}

	const audioSlice = readAudioSlice(params.startTime, params.endTime);
	if (!audioSlice) return null;

	const config = new SpectrogramConfig(
		audioSampleRate,
		FFT_SIZE,
		HOP_LENGTH,
		params.tileWidthPx,
		bins,
		gainRef,
	);

	try {
		const pixels = generate_spectrogram_image(
			audioSlice,
			IDENTITY_PALETTE,
			config,
		);

		// wasm 输出的图像自上而下对应频率从高到低，这里转置为
		// [x * bins + bin] 的布局，方便后续按 bin 连续读取
		const data = new Uint8Array(params.tileWidthPx * bins);
		for (let yPixel = 0; yPixel < bins; yPixel++) {
			const logicalRow = bins - 1 - yPixel;
			const pixelRowOffset = yPixel * params.tileWidthPx * 4;
			for (let x = 0; x < params.tileWidthPx; x++) {
				data[x * bins + logicalRow] = pixels[pixelRowOffset + x * 4];
			}
		}

		const tile: RawTile = { width: params.tileWidthPx, bins, data };
		cacheRawTile(key, tile);
		return tile;
	} finally {
		config.free();
	}
}

/**
 * @description 生成（或从缓存读取）相位声码器频率重分配频谱的基础值场
 *
 * 基础值场与增益无关，所以增益变化只需重新上色，无需重跑 STFT。
 * 频率轴与普通频谱保持一致（以普通模式的频率分辨率为下限），
 * 因此切换模式时刻度不会跳动。
 */
async function getReassignedBaseField(
	params: TileGenerationParams,
): Promise<Float32Array | null> {
	if (!audioSampleRate) return null;

	const tilt = naturalWeightingApplies(params, "reassign")
		? params.naturalWeightingTilt
		: 0;
	const key = `${params.tileIndex}|${params.tileWidthPx}|${params.height}|${params.logAmount.toFixed(3)}|${params.fftSize}|${params.hopLength}|${tilt}`;
	const cached = reassignCache.get(key);
	if (cached) {
		reassignCache.delete(key);
		reassignCache.set(key, cached);
		return cached;
	}

	const audioSlice = readAudioSlice(params.startTime, params.endTime);
	if (!audioSlice) return null;

	// audioSlice 是复用缓冲上的视图，transfer 会分离它，所以先复制一份交给
	// 计算 worker；复制发生在任何 await 之前，不会被后续读取覆盖。
	const audioCopy = audioSlice.slice();

	// 频率轴必须与普通频谱一致：minF = 频率分辨率，maxF = bin 数 × 频率分辨率
	const freqResolution = audioSampleRate / FFT_SIZE;
	const maxAxisFrequency = getNumFreqBins(audioSampleRate) * freqResolution;

	const field = await computeReassignFieldInPool(audioCopy, {
		sampleRate: audioSampleRate,
		fftSize: params.fftSize,
		hopLength: params.hopLength,
		width: params.tileWidthPx,
		height: params.height,
		logAmount: params.logAmount,
		minFrequency: freqResolution,
		maxFrequency: maxAxisFrequency,
		tiltDBPerOctave: tilt,
	});

	if (!field) return null;

	cacheReassignTile(key, field);
	return field;
}

/**
 * @description 获取频率重分配映射（带缓存）
 */
function getFrequencyRanges(
	bins: number,
	height: number,
	logAmount: number,
): FrequencyBinRanges {
	const key = `${bins}|${height}|${logAmount.toFixed(3)}`;
	const cached = frequencyMappingCache.get(key);
	if (cached) return cached;

	const ranges = computeFrequencyBinRanges(bins, height, logAmount);
	frequencyMappingCache.set(key, ranges);

	while (frequencyMappingCache.size > MAPPING_CACHE_MAX_ENTRIES) {
		const oldestKey = frequencyMappingCache.keys().next().value;
		if (oldestKey === undefined) break;
		frequencyMappingCache.delete(oldestKey);
	}

	return ranges;
}

/**
 * @description 将原始线性频谱渲染为位图
 *
 * 原始瓦片是以参考增益 gainRef 渲染并 8bit 量化的，每个像素的值都通过
 * 所在行的 LUT（由 buildNormalLut 预计算）映射到调色板索引。
 */
function renderTile(
	raw: RawTile,
	ranges: FrequencyBinRanges,
	height: number,
	palette: Uint8Array,
	lut: Uint8Array,
): ImageBitmap {
	const width = raw.width;
	const bins = raw.bins;
	const data = raw.data;
	const lastBin = bins - 1;
	const { start, end } = ranges;

	const rgba = new Uint8ClampedArray(width * height * 4);

	for (let y = 0; y < height; y++) {
		const binStart = start[y];
		const binEnd = end[y];
		const lutBase = y * 256;
		let offset = y * width * 4;

		if (binStart >= binEnd) {
			// 单个 bin 直接放大到整行
			const bin = binStart > lastBin ? lastBin : binStart;
			for (let x = 0; x < width; x++) {
				const colorIndex = lut[lutBase + data[x * bins + bin]];
				const intensity = colorIndex * 4;
				rgba[offset] = palette[intensity];
				rgba[offset + 1] = palette[intensity + 1];
				rgba[offset + 2] = palette[intensity + 2];
				rgba[offset + 3] = palette[intensity + 3];
				offset += 4;
			}
		} else {
			// 多个 bin 取最大值，避免重采样时丢失高能量
			for (let x = 0; x < width; x++) {
				const base = x * bins;
				let maxValue = 0;
				for (let bin = binStart; bin < binEnd; bin++) {
					const value = data[base + bin];
					if (value > maxValue) maxValue = value;
				}
				const colorIndex = lut[lutBase + maxValue];
				const intensity = colorIndex * 4;
				rgba[offset] = palette[intensity];
				rgba[offset + 1] = palette[intensity + 1];
				rgba[offset + 2] = palette[intensity + 2];
				rgba[offset + 3] = palette[intensity + 3];
				offset += 4;
			}
		}
	}

	return bitmapFromRgba(rgba, width, height);
}

/**
 * @description 把调色板索引缓冲着色为位图
 */
function colorizeIndexed(
	indices: Uint8Array,
	width: number,
	height: number,
	palette: Uint8Array,
): ImageBitmap {
	const rgba = new Uint8ClampedArray(width * height * 4);
	for (let i = 0, offset = 0; i < indices.length; i++, offset += 4) {
		const intensity = indices[i] * 4;
		rgba[offset] = palette[intensity];
		rgba[offset + 1] = palette[intensity + 1];
		rgba[offset + 2] = palette[intensity + 2];
		rgba[offset + 3] = palette[intensity + 3];
	}

	return bitmapFromRgba(rgba, width, height);
}

function bitmapFromRgba(
	rgba: Uint8ClampedArray<ArrayBuffer>,
	width: number,
	height: number,
): ImageBitmap {
	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext("2d");
	if (!context) throw new Error("OffscreenCanvas 上下文创建失败");

	context.putImageData(new ImageData(rgba, width, height), 0, 0);
	return canvas.transferToImageBitmap();
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
			// 换了音频，丢掉所有在途的计算任务
			disposeReassignPool();
			clearCaches();

			try {
				const rootDir = await navigator.storage.getDirectory();
				const fileHandle = await rootDir.getFileHandle("audio_cache.pcm");

				if (opfsAccessHandle) {
					opfsAccessHandle.close();
				}
				opfsAccessHandle = await fileHandle.createSyncAccessHandle();

				ctx.postMessage({ type: "INIT_COMPLETE" });
			} catch (e) {
				spectrogramLogger.error("Worker 无法打开 OPFS 缓存文件:", e);
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
			disposeReassignPool();
			clearCaches();
			opfsChannel.postMessage("OPFS_RELEASED");
			break;

		case "SET_PALETTE":
			currentPalette = msg.palette;
			break;

		case "SET_EPOCH_BUFFER":
			sharedEpoch = new Int32Array(msg.buffer);
			setReassignEpochSource(sharedEpoch);
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

			// 排队期间参数又被改过：这块钱已经过期，直接跳过不做计算
			if (sharedEpoch && msg.epoch < Atomics.load(sharedEpoch, 0)) {
				ctx.postMessage({ type: "TILE_SKIPPED", reqId });
				return;
			}

			try {
				if (params.reassign) {
					const field = await getReassignedBaseField(params);
					if (!field) {
						ctx.postMessage({
							type: "ERROR",
							reqId,
							message: "Out of bounds",
						});
						return;
					}

					// 增益在这里实时应用：自然加权已经烘焙进基础值场，缓存也按倾斜度区分
					const indices = baseFieldToColorIndices(field, params.gain);
					const imageBitmap = colorizeIndexed(
						indices,
						params.tileWidthPx,
						params.height,
						currentPalette,
					);
					ctx.postMessage(
						{
							type: "TILE_READY",
							reqId,
							imageBitmap,
						},
						[imageBitmap],
					);
					return;
				}

				const normalRender = getNormalRenderParams(params);
				const raw = getRawTile(params, normalRender.gainRef);
				if (!raw) {
					ctx.postMessage({
						type: "ERROR",
						reqId,
						message: "Out of bounds",
					});
					return;
				}

				const ranges = getFrequencyRanges(
					raw.bins,
					params.height,
					params.logAmount,
				);
				const imageBitmap = renderTile(
					raw,
					ranges,
					params.height,
					currentPalette,
					normalRender.lut,
				);

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
