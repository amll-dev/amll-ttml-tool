import { Romanize as hRomanize } from "hangul-romanize/dist-esm/Romanize";
// @ts-expect-error no types for this
import Kuroshiro from "kuroshiro";
// @ts-expect-error no types for this
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";
import { pinyin } from "pinyin-pro";

let kuroshiroInstance: Kuroshiro | null = null;
let kuroshiroInitPromise: Promise<void> | null = null;

const getKuroshiro = async () => {
	if (kuroshiroInstance) return kuroshiroInstance;
	if (kuroshiroInitPromise) {
		await kuroshiroInitPromise;
		return kuroshiroInstance;
	}

	kuroshiroInitPromise = (async () => {
		const kS = new Kuroshiro();
		await kS.init(
			new KuromojiAnalyzer({
				dictPath: "/dict",
			}),
		);
		kuroshiroInstance = kS;
	})();

	try {
		await kuroshiroInitPromise;
	} catch (e) {
		console.error("Kuroshiro failed to initialize:", e);
		// Clean up the promise if initialization failed, so we can retry if needed
		kuroshiroInitPromise = null;
		throw e;
	}
	return kuroshiroInstance;
};

export const romanizeText = async (
	text: string,
	language: string,
): Promise<string> => {
	if (!text || !text.trim() || language === "auto" || language === "off") {
		return text;
	}

	try {
		if (language === "ja") {
			const kuroshiro = await getKuroshiro();
			return await kuroshiro.convert(text, {
				to: "romaji",
				mode: "spaced",
				romajiSystem: "hepburn",
			});
		}

		if (language === "zh") {
			return pinyin(text, { toneType: "none", type: "string" });
		}

		if (language === "ko") {
			return hRomanize.from(text);
		}

		return text; // fallback for unsupported languages
	} catch (e) {
		console.error(`Romanization failed for language ${language}: `, e);
		return text;
	}
};
