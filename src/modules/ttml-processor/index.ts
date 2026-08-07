import type {
	LyricLine as AppLyricLine,
	LyricWord as AppLyricWord,
	TTMLLyric as AppTTMLLyric,
	TTMLMetadata as AppTTMLMetadata,
} from "$/types/ttml";
import {
	TranslationOutputMode,
	translationOutputModeAtom,
} from "$/modules/settings/states";
import { globalStore } from "$/states/store.ts";
import type {
	AmllLyricLine,
	AmllLyricResult,
	AmllLyricWord,
	AmllMetadata,
	AmllToTtmlOptions,
	GeneratorConfig,
	JsError,
	TTMLResult,
	TtmlToAmllOptions,
} from "./types";
import {
	amllToTtml as rawAmllToTtml,
	amllToTtmlResult as rawAmllToTtmlResult,
	generateTtml as rawGenerateTtml,
	parseTtml as rawParseTtml,
	ttmlResultToAmll as rawTtmlResultToAmll,
	ttmlToAmll as rawTtmlToAmll,
} from "./wasm/ttml_processor_wasm";

//#region 类型定义
export type Result<T> =
	| { success: true; data: T }
	| { success: false; error: JsError };

/** 需要在导入时剔除的元数据键 */
const IGNORED_METADATA_KEYS = new Set(["timingMode", "language"]);

/** 导入时需要重命名的元数据键 */
const RENAMED_METADATA_KEYS: Record<string, string> = {
	songwriters: "songwriter",
	title: "musicName",
};

/** 导出时需要重命名的元数据键 */
const EXPORT_RENAMED_METADATA_KEYS: Record<string, string> = {
	songwriter: "songwriters",
};
//#endregion

//#region 生成器配置
/**
 * 根据首选项中的翻译输出方式，生成默认的 TTML 生成器配置
 *
 * - {@link TranslationOutputMode.AppleMusic}：逐行翻译/音译写入 `<iTunesMetadata>`
 * - {@link TranslationOutputMode.Amll}：逐行翻译/音译写入为内嵌的
 *   `x-translation` / `x-roman`
 */
export function getDefaultGeneratorConfig(): Partial<GeneratorConfig> {
	return {
		useAppleFormatRules:
			globalStore.get(translationOutputModeAtom) ===
			TranslationOutputMode.AppleMusic,
	};
}

/**
 * 将调用方传入的生成器配置与首选项中的默认配置合并
 *
 * 调用方显式指定的字段优先于首选项
 */
function withDefaultGeneratorConfig(
	config?: Partial<GeneratorConfig>,
): Partial<GeneratorConfig> {
	return { ...getDefaultGeneratorConfig(), ...config };
}
//#endregion

//#region 底层 API
/**
 * 解析 TTML 字符串为 TTMLResult
 * @param ttmlContent 原始 TTML 文本
 * @returns Result 包含 TTMLResult
 */
export function parseTTML(ttmlContent: string): Result<TTMLResult> {
	return rawParseTtml(ttmlContent) as Result<TTMLResult>;
}

/**
 * 将解析后的 TTML 结构体生成为 TTML 字符串
 * @param result TTMLResult 数据模型
 * @param config TTML 生成器配置
 * @returns Result 包含生成的 TTML 字符串
 */
export function generateTTML(
	result: TTMLResult,
	config?: Partial<GeneratorConfig>,
): Result<string> {
	return rawGenerateTtml(result, config) as Result<string>;
}
//#endregion

//#region AMLL 转换相关
/**
 * 便捷方法，将 TTML 字符串转换并降级为 AMLL 所使用的较简单的结构
 * @param ttmlContent 原始 TTML 文本
 * @param options 提取时的语言首选项
 * @returns Result 包含 AmllLyricResult
 */
export function ttmlToAmll(
	ttmlContent: string,
	options?: Partial<TtmlToAmllOptions>,
): Result<AmllLyricResult> {
	const result = rawTtmlToAmll(ttmlContent, options) as Result<AmllLyricResult>;
	if (!result.success) return result;

	const processedLyricLines = result.data.lyricLines.map((line) => {
		const newWords: AmllLyricWord[] = [];

		for (const word of line.words) {
			const trailingSpaceMatch = word.word.match(/(\s+)$/);

			if (trailingSpaceMatch && word.word !== trailingSpaceMatch[0]) {
				const spaces = trailingSpaceMatch[0];
				const pureWord = word.word.slice(0, -spaces.length);

				newWords.push({ ...word, word: pureWord });

				newWords.push({
					startTime: 0,
					endTime: 0,
					word: spaces,
				});
			} else {
				newWords.push(word);
			}
		}

		return {
			...line,
			words: newWords,
		};
	});

	return {
		success: true,
		data: {
			...result.data,
			lyricLines: processedLyricLines,
			metadata: result.data.metadata
				.filter((meta) => !IGNORED_METADATA_KEYS.has(meta.key))
				.map((meta) => ({
					...meta,
					key: RENAMED_METADATA_KEYS[meta.key] ?? meta.key,
				})),
		},
	};
}

/**
 * 将编辑器内部的单个歌词单词降级为 AMLL 简化结构
 *
 * 会丢弃 `id`、`romanWarning` 等编辑器专用字段
 */
function normalizeExportWord(word: AppLyricWord): AmllLyricWord {
	return {
		startTime: word.startTime,
		endTime: word.endTime,
		word: word.word,
		romanWord: word.romanWord,
		obscene: word.obscene,
		emptyBeat: word.emptyBeat,
		ruby: word.ruby,
	};
}

/**
 * 将编辑器内部的单行歌词降级为 AMLL 简化结构
 *
 * 会丢弃 `id`、`ignoreSync`、`endTimeLink` 等编辑器专用字段
 */
function normalizeExportLine(line: AppLyricLine): AmllLyricLine {
	return {
		words: line.words.map(normalizeExportWord),
		translatedLyric: line.translatedLyric,
		romanLyric: line.romanLyric,
		isBG: line.isBG,
		isDuet: line.isDuet,
		startTime: line.startTime,
		endTime: line.endTime,
	};
}

/**
 * 将编辑器内部的元数据降级为 AMLL 简化结构
 */
function normalizeExportMetadata(metadata: AppTTMLMetadata[]): AmllMetadata[] {
	return metadata.map((meta) => ({
		key: EXPORT_RENAMED_METADATA_KEYS[meta.key] ?? meta.key,
		value: [...meta.value],
	}));
}

/**
 * 将编辑器内部使用的 `TTMLLyric` 结构转换为 AMLL 所使用的较简单的结构
 * @param ttmlLyric 编辑器内部的歌词数据
 * @returns AmllLyricResult 结构
 */
export function ttmlLyricToAmllResult(
	ttmlLyric: AppTTMLLyric,
): AmllLyricResult {
	return {
		lyricLines: ttmlLyric.lyricLines.map(normalizeExportLine),
		metadata: normalizeExportMetadata(ttmlLyric.metadata),
	};
}

function postProcessLyricLines(amllResult: AmllLyricResult): AmllLyricResult {
	return {
		...amllResult,
		lyricLines: amllResult.lyricLines.map((line) => ({
			...line,
			startTime: Math.round(line.startTime),
			endTime: Math.round(line.endTime),
			words: line.words.map((word) => {
				const processedWord: AmllLyricWord = {
					...word,
					startTime: Math.round(word.startTime),
					endTime: Math.round(word.endTime),
					ruby: word.ruby
						? word.ruby.map((r) => ({
								...r,
								startTime: Math.round(r.startTime),
								endTime: Math.round(r.endTime),
							}))
						: undefined,
				};

				if (processedWord.emptyBeat == null || processedWord.emptyBeat === 0) {
					processedWord.emptyBeat = undefined;
				}

				if (!processedWord.romanWord || processedWord.romanWord.trim() === "") {
					processedWord.romanWord = undefined;
				}

				return processedWord;
			}),
		})),
	};
}

/**
 * 便捷方法，将 AMLL 格式的歌词和元数据生成为 TTML 字符串
 *
 * 会对文本进行规范化，例如清理空格、移除背景人声括号等
 * @param amllResult AMLL 结构体数据
 * @param options 语言配置
 * @param config TTML 生成器配置
 * @returns Result 包含生成的 TTML 字符串
 */
export function amllToTTML(
	amllResult: AmllLyricResult,
	options?: Partial<AmllToTtmlOptions>,
	config?: Partial<GeneratorConfig>,
): Result<string> {
	const processedAmllResult = postProcessLyricLines(amllResult);
	return rawAmllToTtml(
		processedAmllResult,
		options,
		withDefaultGeneratorConfig(config),
	) as Result<string>;
}

/**
 * 工具方法，将复杂的 TTMLResult 结构降级为 AMLL 所使用的较简单的数据结构
 * @param ttmlResult 复杂的 TTMLResult 数据树
 * @param options 提取时的语言首选项
 * @returns Result 包含 AmllLyricResult
 */
export function ttmlResultToAmll(
	ttmlResult: TTMLResult,
	options?: Partial<TtmlToAmllOptions>,
): Result<AmllLyricResult> {
	return rawTtmlResultToAmll(ttmlResult, options) as Result<AmllLyricResult>;
}

/**
 * 工具方法，将 AMLL 格式的歌词和元数据转换为 TTMLResult 结构
 *
 * 会对文本进行规范化，例如清理空格、移除背景人声括号等
 * @param amllResult AMLL 结构体数据
 * @param options 语言配置
 * @returns Result 包含 TTMLResult
 */
export function amllToTTMLResult(
	amllResult: AmllLyricResult,
	options?: Partial<AmllToTtmlOptions>,
): Result<TTMLResult> {
	const processedAmllResult = postProcessLyricLines(amllResult);
	return rawAmllToTtmlResult(
		processedAmllResult,
		options,
	) as Result<TTMLResult>;
}
//#endregion
