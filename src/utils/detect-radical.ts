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
export function containsRadicalChar(text: string): boolean {
	for (const char of text) {
		const code = char.codePointAt(0);
		if (code === undefined) continue;

		// CJK Radicals Supplement: U+2E80 - U+2EFF
		if (code >= 0x2e80 && code <= 0x2eff) {
			return true;
		}
		// Kangxi Radicals: U+2F00 - U+2FDF
		if (code >= 0x2f00 && code <= 0x2fdf) {
			return true;
		}
		// CJK Strokes: U+31C0 - U+31EF
		if (code >= 0x31c0 && code <= 0x31ef) {
			return true;
		}
	}
	return false;
}
