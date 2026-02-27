import type { LyricWord, LyricWordBase } from "$/types/ttml";
import * as wanakana from "wanakana";
import { isKanaOnly } from "$/modules/segmentation/utils/Transliteration/TransliterationUtils";

const EXCLUDED_KANA_COMBOS = new Set([
	"きゃ",
	"きゅ",
	"きょ",
	"ぎゃ",
	"ぎゅ",
	"ぎょ",
	"キャ",
	"キュ",
	"キョ",
	"ギャ",
	"ギュ",
	"ギョ",
	"しゃ",
	"しゅ",
	"しょ",
	"じゃ",
	"じゅ",
	"じょ",
	"ちゃ",
	"ちゅ",
	"ちょ",
	"にゃ",
	"にゅ",
	"にょ",
	"ひゃ",
	"ひゅ",
	"ひょ",
	"びゃ",
	"びゅ",
	"びょ",
	"ぴゃ",
	"ぴゅ",
	"ぴょ",
	"みゃ",
	"みゅ",
	"みょ",
	"りゃ",
	"りゅ",
	"りょ"
]);

const buildRubyEntries = (
	word: LyricWord,
	tokens: string[],
): LyricWordBase[] =>
	tokens.map((token) => ({
		word: token,
		startTime: word.startTime,
		endTime: word.endTime,
	}));

const toKanaToken = (token: string) => wanakana.toKana(token).trim();
const normalizeSokuon = (token: string) => {
	const lower = token.toLowerCase();
	if (lower === "t" || lower === "s") return "っ";
	return token;
};

export const generateRubyFromRomanWord = (
	word: LyricWord,
): LyricWordBase[] | undefined => {
	const romanWord = (word.romanWord ?? "").trim();
	if (!romanWord) return;
	const kanaWord = toKanaToken(romanWord);
	if (!kanaWord) return;

	if (isKanaOnly(word.word)) {
		return;
	}

	const compactKana = kanaWord.replace(/\s+/g, "");
	if (!compactKana) return;
	for (const combo of EXCLUDED_KANA_COMBOS) {
		if (compactKana.includes(combo)) {
			return buildRubyEntries(word, [compactKana]);
		}
	}
	const kanaChars = Array.from(compactKana)
		.map((char) => normalizeSokuon(char))
		.filter((char) => char.trim() !== "");
	if (kanaChars.length === 0) return;
	return buildRubyEntries(word, kanaChars);
};

export const applyGeneratedRuby = (
	word: LyricWord,
	options?: { overwrite?: boolean },
) => {
	const generated = generateRubyFromRomanWord(word);
	if (!generated || generated.length === 0) return;
	const hasRuby = word.ruby && word.ruby.length > 0;
	if (!options?.overwrite && hasRuby) return;
	word.ruby = generated;
};
