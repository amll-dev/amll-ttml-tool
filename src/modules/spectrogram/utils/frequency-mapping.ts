/**
 * @description 频谱图频率轴（频率重分配）工具
 *
 * FFT 得到的是按线性频率排列的频率 bin，而显示时需要把若干个 bin
 * 重新分配到每一行像素上，这个过程就是「频率重分配」。
 *
 * `logAmount` 控制重分配曲线的对数程度：
 * - `0` 完全线性（高频与低频占用相同的行数）
 * - `1` 完全对数（低频占用更多行，高频被压缩）
 *
 * 该计算与 wasm-spectrogram 内部的渲染逻辑保持一致：
 * 图像自上而下对应频率从高到低。
 */

/** 最低渲染的 bin，跳过直流分量 */
export const MIN_FREQ_BIN = 1;

export interface FrequencyBinRanges {
	/** 每一显示行对应的起始 bin（含） */
	start: Int32Array;
	/** 每一显示行对应的结束 bin（不含） */
	end: Int32Array;
}

/**
 * @description 将任意输入夹取到 0 ~ 1 的对数程度
 */
export function clampLogAmount(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(1, Math.max(0, value));
}

/**
 * @description 计算每一显示行对应的频率 bin 范围
 *
 * @param numFreqBins FFT 频率 bin 数量
 * @param imgHeight 显示高度（像素行数）
 * @param logAmount 对数程度，0 ~ 1
 */
export function computeFrequencyBinRanges(
	numFreqBins: number,
	imgHeight: number,
	logAmount: number,
): FrequencyBinRanges {
	const start = new Int32Array(imgHeight);
	const end = new Int32Array(imgHeight);

	const minBin = MIN_FREQ_BIN;
	const maxBin = numFreqBins;
	if (maxBin <= minBin || imgHeight <= 0) {
		return { start, end };
	}

	const minBinF = minBin;
	const maxBinF = maxBin;
	const scaleLog = Math.log(maxBinF / minBinF);
	const amount = clampLogAmount(logAmount);
	const lastBin = numFreqBins - 1;

	// 把归一化的行位置映射到连续的 bin 索引
	const mapRowToBin = (row: number) => {
		const pos = row / imgHeight;
		const linear = minBinF + pos * (maxBinF - minBinF);
		const logarithmic = minBinF * Math.exp(pos * scaleLog);
		return linear + amount * (logarithmic - linear);
	};

	for (let yPixel = 0; yPixel < imgHeight; yPixel++) {
		const yLogical = imgHeight - 1 - yPixel;
		const binStart = Math.min(Math.floor(mapRowToBin(yLogical)), lastBin);
		const binEnd = Math.min(Math.floor(mapRowToBin(yLogical + 1)), numFreqBins);
		start[yPixel] = binStart < 0 ? 0 : binStart;
		end[yPixel] = binEnd;
	}

	return { start, end };
}

/**
 * @description 把一个频率映射到显示行（0 为最顶行，即最高频）
 *
 * 该映射与 {@link computeFrequencyBinRanges} 使用同一个频率轴，
 * 因此线性/对数模式下重分配频谱与普通频谱的频率刻度是一致的。
 *
 * @param frequency 频率（Hz）
 * @param minFrequency 频率轴最低频率
 * @param maxFrequency 频率轴最高频率
 * @param imgHeight 显示高度（像素行数）
 * @param logAmount 对数程度，0 ~ 1
 */
export function frequencyToRowIndex(
	frequency: number,
	minFrequency: number,
	maxFrequency: number,
	imgHeight: number,
	logAmount: number,
): number {
	if (imgHeight <= 0 || maxFrequency <= minFrequency) return 0;

	// 频率轴的两端由 minFrequency / maxFrequency 定义，而频率与 bin 索引是
	// 线性关系（bin = 频率 / 频率分辨率），所以这里直接反解
	// computeFrequencyBinRanges 使用的同一套「bin 空间」混合映射，
	// 这样重分配频谱与普通频谱的频率刻度完全一致。
	const minBin = MIN_FREQ_BIN;
	const maxBin = maxFrequency / minFrequency;
	const scaleLog = Math.log(maxBin / minBin);
	const amount = clampLogAmount(logAmount);

	const targetBin = Math.min(
		Math.max(frequency / minFrequency, minBin),
		maxBin,
	);

	let lo = 0;
	let hi = 1;
	for (let i = 0; i < 48; i++) {
		const mid = 0.5 * (lo + hi);
		const linear = minBin + mid * (maxBin - minBin);
		const logarithmic = minBin * Math.exp(mid * scaleLog);
		const bin = linear + amount * (logarithmic - linear);
		if (bin < targetBin) {
			lo = mid;
		} else {
			hi = mid;
		}
	}
	const pos = 0.5 * (lo + hi);

	const yLogical = Math.min(
		imgHeight,
		Math.max(0, Math.floor(pos * imgHeight)),
	);
	const row = imgHeight - 1 - yLogical;
	if (row < 0) return 0;
	if (row > imgHeight - 1) return imgHeight - 1;
	return row;
}

/**
 * @description 把一个显示行映射回它代表的频率（Hz）
 *
 * 是 {@link frequencyToRowIndex} 的反向映射（正向计算，无需二分），
 * 两者共用同一套频率轴公式。
 */
export function frequencyAtRowIndex(
	row: number,
	minFrequency: number,
	maxFrequency: number,
	imgHeight: number,
	logAmount: number,
): number {
	if (imgHeight <= 0 || maxFrequency <= minFrequency) return minFrequency;

	const clampedRow = Math.min(imgHeight - 1, Math.max(0, row));
	const yLogical = imgHeight - 1 - clampedRow;
	const pos = yLogical / imgHeight;

	const minBin = MIN_FREQ_BIN;
	const maxBin = maxFrequency / minFrequency;
	const scaleLog = Math.log(maxBin / minBin);
	const amount = clampLogAmount(logAmount);
	const linear = minBin + pos * (maxBin - minBin);
	const logarithmic = minBin * Math.exp(pos * scaleLog);
	const bin = linear + amount * (logarithmic - linear);

	return bin * minFrequency;
}
