/**
 * 检测字符串中是否包含偏旁部首字符
 * 偏旁部首字符范围：
 * - U+2E80 - U+2EFF: CJK Radicals Supplement
 * - U+2F00 - U+2FDF: Kangxi Radicals
 * - U+31C0 - U+31EF: CJK Strokes
 *
 * @param text 要检测的文本
 * @returns 是否包含偏旁部首字符
 */
const RADICAL_CHAR_REGEXP = /[\u2e80-\u2eff\u2f00-\u2fdf\u31c0-\u31ef]/u;

export function containsRadicalChar(text: string): boolean {
	return RADICAL_CHAR_REGEXP.test(text);
}
