import { frequencyAtRowIndex } from "./frequency-mapping";

/** @description 自然加权（频谱倾斜）作用的范围 */
export type NaturalWeightingScope = "none" | "normal" | "reassign" | "both";

/** @description 自然加权的参考频率（Hz） */
export const NATURAL_WEIGHTING_REFERENCE_HZ = 1000;

/** @description 可选的自然加权倾斜度（dB/倍频程，0 表示不倾斜） */
export const NATURAL_WEIGHTING_TILT_OPTIONS = [0, 3, 4.5, 6];

/** @description 自然加权默认倾斜度 */
export const DEFAULT_NATURAL_WEIGHTING_TILT = 4.5;

/**
 * @description 计算每一显示行的自然加权偏移（log10 单位）
 *
 * 正值提升高频、压低低频，用来补偿自然音频约 -6dB/oct 的能量滚降，
 * 避免低频分量在显示上压倒高频。偏移作用在对数域，等价于把幅度乘以
 * `10^(dB/20)`。
 *
 * @param height 显示高度（像素行数）
 * @param minFrequency 频率轴最低频率
 * @param maxFrequency 频率轴最高频率
 * @param logAmount 对数程度，0 ~ 1
 * @param tiltDBPerOctave 倾斜度（dB/倍频程）
 */
export function computeNaturalWeightingOffsets(
	height: number,
	minFrequency: number,
	maxFrequency: number,
	logAmount: number,
	tiltDBPerOctave: number,
): Float32Array {
	const offsets = new Float32Array(height);
	if (tiltDBPerOctave === 0 || height <= 0 || maxFrequency <= minFrequency) {
		return offsets;
	}

	const scale = tiltDBPerOctave / 20;

	for (let row = 0; row < height; row++) {
		const frequency = frequencyAtRowIndex(
			row,
			minFrequency,
			maxFrequency,
			height,
			logAmount,
		);
		offsets[row] =
			scale *
			Math.log2(
				Math.max(frequency, 1e-6) / NATURAL_WEIGHTING_REFERENCE_HZ,
			);
	}

	return offsets;
}

/** @description 每 dB/倍频程对应的频率比指数 */
const DB_PER_OCTAVE_TO_EXPONENT = Math.log2(10) / 20;

/**
 * @description 自然加权在某个频率上的幅度增益
 *
 * 与 {@link computeNaturalWeightingOffsets} 的 log10 偏移等价：
 * `gain = 10^offset`。作用在幅度域时静音仍然是 0，
 * 不会像对数域加偏移那样把噪声底整体抬亮。
 */
export function naturalWeightingGain(
	frequency: number,
	tiltDBPerOctave: number,
): number {
	if (tiltDBPerOctave === 0 || frequency <= 0) return 1;
	return (
		(frequency / NATURAL_WEIGHTING_REFERENCE_HZ) **
		(tiltDBPerOctave * DB_PER_OCTAVE_TO_EXPONENT)
	);
}

/**
 * @description 在幅度域施加自然加权后，重新取回对数域的值
 *
 * 原始对数域值为 `L = log10(m·k+1)`，幅度乘以 `boost = 10^t` 之后就是
 * `log10((10^L − 1)·boost + 1)`。关键是静音（`L = 0`）映射后仍然是 0，
 * 所以不会像对数域直接加 `t` 那样把噪声底和空白区整体抬亮。
 */
export function applyNaturalWeightingToLogValue(
	logValue: number,
	boost: number,
): number {
	if (boost === 1) return logValue;
	return Math.log10((10 ** logValue - 1) * boost + 1);
}

/**
 * @description 偏移中最大的衰减量（正数，log10 单位）
 *
 * 普通频谱的原始瓦片是 8bit 截断的，需要用这个值给它预留
 * 「压低低频后仍不截断」的余量。
 */
export function maxNaturalWeightingAttenuation(
	offsets: Float32Array,
): number {
	let maxAttenuation = 0;
	for (let i = 0; i < offsets.length; i++) {
		const attenuation = -offsets[i];
		if (attenuation > maxAttenuation) maxAttenuation = attenuation;
	}
	return maxAttenuation;
}
