/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/Steve-xmh/amll-ttml-tool/blob/main/LICENSE
 */

/**
 * @fileoverview
 * 用于将内部歌词数组对象导出成 TTML 格式的模块
 * 但是可能会有信息会丢失
 */

import type { LyricLine, LyricWord, TTMLLyric } from "../../../types/ttml.ts";
import { log } from "../../../utils/logging.ts";
import { msToTimestamp } from "../../../utils/timestamp.ts";

export default function exportTTMLText(
	ttmlLyric: TTMLLyric,
	pretty = false,
): string {
	const params: LyricLine[][] = [];
	const lyric = ttmlLyric.lyricLines;

	let tmp: LyricLine[] = [];
	for (const line of lyric) {
		if (line.words.length === 0 && tmp.length > 0) {
			params.push(tmp);
			tmp = [];
		} else {
			tmp.push(line);
		}
	}

	if (tmp.length > 0) {
		params.push(tmp);
	}

	const doc = new Document();

	function createWordElement(word: LyricWord): Element {
		const span = doc.createElement("span");
		span.setAttribute("begin", msToTimestamp(word.startTime));
		span.setAttribute("end", msToTimestamp(word.endTime));
		if (word.obscene) span.setAttribute("amll:obscene", "true");
		if (word.emptyBeat)
			span.setAttribute("amll:empty-beat", `${word.emptyBeat}`);
		span.appendChild(doc.createTextNode(word.word));
		return span;
	}

	function createRomanizationSpan(word: LyricWord): Element {
		const span = doc.createElement("span");
		span.setAttribute("begin", msToTimestamp(word.startTime));
		span.setAttribute("end", msToTimestamp(word.endTime));
		span.appendChild(doc.createTextNode(word.romanWord));
		return span;
	}

	function normalizeVocalValue(vocal?: string | string[] | null): string {
		if (!vocal) return "";
		const parts = Array.isArray(vocal) ? vocal : vocal.split(/[\s,]+/);
		return parts
			.map((v) => v.trim())
			.filter(Boolean)
			.join(",");
	}

	const ttRoot = doc.createElement("tt");

	ttRoot.setAttribute("xmlns", "http://www.w3.org/ns/ttml");
	ttRoot.setAttribute("xmlns:ttm", "http://www.w3.org/ns/ttml#metadata");
	ttRoot.setAttribute("xmlns:amll", "http://www.example.com/ns/amll");
	ttRoot.setAttribute(
		"xmlns:itunes",
		"http://music.apple.com/lyric-ttml-internal",
	);

	// Determine itunes:timing mode for Spicylyrics compatibility
	// Word = at least one line has 2+ non-blank words (dynamic/per-word timing)
	// Line = has lyric lines but every line has 0 or 1 non-blank word
	// None = no timed words at all
	const nonBlankWordCountsPerLine = lyric.map(
		(l) => l.words.filter((w) => w.word.trim().length > 0).length,
	);
	const totalNonBlankWords = nonBlankWordCountsPerLine.reduce(
		(sum, v) => sum + v,
		0,
	);
	const hasAnyTiming = lyric.some((l) =>
		l.words.some((w) => w.word.trim().length > 0 && w.endTime > w.startTime),
	);
	let timingMode: "Word" | "Line" | "None";
	if (totalNonBlankWords === 0 || !hasAnyTiming) timingMode = "None";
	else if (nonBlankWordCountsPerLine.some((c) => c > 1)) timingMode = "Word";
	else timingMode = "Line";
	ttRoot.setAttribute("itunes:timing", timingMode);

	doc.appendChild(ttRoot);

	const head = doc.createElement("head");

	ttRoot.appendChild(head);

	const body = doc.createElement("body");
	const hasOtherPerson = !!lyric.find((v) => v.isDuet);

	const metadataEl = doc.createElement("metadata");
	const mainPersonAgent = doc.createElement("ttm:agent");
	mainPersonAgent.setAttribute("type", "person");
	mainPersonAgent.setAttribute("xml:id", "v1");

	metadataEl.appendChild(mainPersonAgent);

	if (hasOtherPerson) {
		const otherPersonAgent = doc.createElement("ttm:agent");
		otherPersonAgent.setAttribute("type", "other");
		otherPersonAgent.setAttribute("xml:id", "v2");

		metadataEl.appendChild(otherPersonAgent);
	}

	const vocalTags = ttmlLyric.vocalTags?.filter(
		(tag) => tag.key && tag.key.trim().length > 0,
	) ?? [];
	if (vocalTags.length > 0) {
		const vocalsEl = doc.createElement("amll:vocals");
		for (const tag of vocalTags) {
			const vocalEl = doc.createElement("vocal");
			vocalEl.setAttribute("key", tag.key);
			vocalEl.setAttribute("value", tag.value ?? "");
			vocalsEl.appendChild(vocalEl);
		}
		metadataEl.appendChild(vocalsEl);
	}

	// Extract songwriter metadata to emit in iTunes format (Spicylyrics compatibility)
	const songwriterMeta = ttmlLyric.metadata.find(
		(m) => m.key === "songwriter" && m.value.some((v) => v.trim().length > 0),
	);

	if (songwriterMeta) {
		const iTunesMetadata = doc.createElement("iTunesMetadata");
		iTunesMetadata.setAttribute(
			"xmlns",
			"http://music.apple.com/lyric-ttml-internal",
		);
		const songwritersEl = doc.createElement("songwriters");
		for (const name of songwriterMeta.value) {
			const trimmed = name.trim();
			if (!trimmed) continue;
			const swEl = doc.createElement("songwriter");
			swEl.appendChild(doc.createTextNode(trimmed));
			songwritersEl.appendChild(swEl);
		}
		if (songwritersEl.childNodes.length > 0) {
			iTunesMetadata.appendChild(songwritersEl);
			metadataEl.appendChild(iTunesMetadata);
		}
	}

	// Append remaining metadata entries (skip songwriter since it's in iTunes format)
	for (const metadata of ttmlLyric.metadata) {
		if (metadata.key === "songwriter") continue;
		for (const value of metadata.value) {
			const metaEl = doc.createElement("amll:meta");
			metaEl.setAttribute("key", metadata.key);
			metaEl.setAttribute("value", value);
			metadataEl.appendChild(metaEl);
		}
	}

	head.appendChild(metadataEl);

	let i = 0;

	const romanizationMap = new Map<
		string,
		{ main: LyricWord[]; bg: LyricWord[] }
	>();

	const guessDuration = lyric[lyric.length - 1]?.endTime ?? 0;
	body.setAttribute("dur", msToTimestamp(guessDuration));
	const isDynamicLyric = lyric.some(
		(line) => line.words.filter((v) => v.word.trim().length > 0).length > 1,
	);

	for (const param of params) {
		const paramDiv = doc.createElement("div");
		const beginTime = param[0]?.startTime ?? 0;
		const endTime = param[param.length - 1]?.endTime ?? 0;

		paramDiv.setAttribute("begin", msToTimestamp(beginTime));
		paramDiv.setAttribute("end", msToTimestamp(endTime));

		for (let lineIndex = 0; lineIndex < param.length; lineIndex++) {
			const line = param[lineIndex];
			const lineP = doc.createElement("p");
			const beginTime = line.startTime ?? 0;
			const endTime = line.endTime;

			lineP.setAttribute("begin", msToTimestamp(beginTime));
			lineP.setAttribute("end", msToTimestamp(endTime));

			lineP.setAttribute("ttm:agent", line.isDuet ? "v2" : "v1");
			const normalizedVocal = normalizeVocalValue(line.vocal);
			if (normalizedVocal.length > 0) {
				lineP.setAttribute("amll:vocal", normalizedVocal);
			}

			const itunesKey = `L${++i}`;
			lineP.setAttribute("itunes:key", itunesKey);

			const mainWords = line.words;
			let bgWords: LyricWord[] = [];

			if (isDynamicLyric) {
				let beginTime = Number.POSITIVE_INFINITY;
				let endTime = 0;
				for (const word of line.words) {
					if (word.word.trim().length === 0) {
						lineP.appendChild(doc.createTextNode(word.word));
					} else {
						const span = createWordElement(word);
						lineP.appendChild(span);
						beginTime = Math.min(beginTime, word.startTime);
						endTime = Math.max(endTime, word.endTime);
					}
				}
				lineP.setAttribute("begin", msToTimestamp(line.startTime));
				lineP.setAttribute("end", msToTimestamp(line.endTime));
			} else {
				const word = line.words[0];
				lineP.appendChild(doc.createTextNode(word.word));
				lineP.setAttribute("begin", msToTimestamp(word.startTime));
				lineP.setAttribute("end", msToTimestamp(word.endTime));
			}

			const nextLine = param[lineIndex + 1];
			if (nextLine?.isBG) {
				lineIndex++;
				const bgLine = nextLine;
				bgWords = bgLine.words;

				const bgLineSpan = doc.createElement("span");
				bgLineSpan.setAttribute("ttm:role", "x-bg");

				if (isDynamicLyric) {
					let beginTime = Number.POSITIVE_INFINITY;
					let endTime = 0;

					const firstWordIndex = bgLine.words.findIndex(
						(w) => w.word.trim().length > 0,
					);
					const lastWordIndex = bgLine.words
						.map((w) => w.word.trim().length > 0)
						.lastIndexOf(true);

					for (
						let wordIndex = 0;
						wordIndex < bgLine.words.length;
						wordIndex++
					) {
						const word = bgLine.words[wordIndex];
						if (word.word.trim().length === 0) {
							bgLineSpan.appendChild(doc.createTextNode(word.word));
						} else {
							const span = createWordElement(word);

							if (wordIndex === firstWordIndex && span.firstChild) {
								span.firstChild.nodeValue = `(${span.firstChild.nodeValue}`;
							}
							if (wordIndex === lastWordIndex && span.firstChild) {
								span.firstChild.nodeValue = `${span.firstChild.nodeValue})`;
							}

							bgLineSpan.appendChild(span);
							beginTime = Math.min(beginTime, word.startTime);
							endTime = Math.max(endTime, word.endTime);
						}
					}
					bgLineSpan.setAttribute("begin", msToTimestamp(beginTime));
					bgLineSpan.setAttribute("end", msToTimestamp(endTime));
				} else {
					const word = bgLine.words[0];
					bgLineSpan.appendChild(doc.createTextNode(`(${word.word})`));
					bgLineSpan.setAttribute("begin", msToTimestamp(word.startTime));
					bgLineSpan.setAttribute("end", msToTimestamp(word.endTime));
				}

				const normalizedBgVocal = normalizeVocalValue(bgLine.vocal);
				if (normalizedBgVocal.length > 0) {
					bgLineSpan.setAttribute("amll:vocal", normalizedBgVocal);
				}

				if (bgLine.translatedLyric) {
					const span = doc.createElement("span");
					span.setAttribute("ttm:role", "x-translation");
					span.setAttribute("xml:lang", "zh-CN");
					span.appendChild(doc.createTextNode(bgLine.translatedLyric));
					bgLineSpan.appendChild(span);
				}

				if (bgLine.romanLyric) {
					const span = doc.createElement("span");
					span.setAttribute("ttm:role", "x-roman");
					span.appendChild(doc.createTextNode(bgLine.romanLyric));
					bgLineSpan.appendChild(span);
				}

				lineP.appendChild(bgLineSpan);
			}

			if (line.translatedLyric) {
				const span = doc.createElement("span");
				span.setAttribute("ttm:role", "x-translation");
				span.setAttribute("xml:lang", "zh-CN");
				span.appendChild(doc.createTextNode(line.translatedLyric));
				lineP.appendChild(span);
			}

			if (line.romanLyric) {
				const span = doc.createElement("span");
				span.setAttribute("ttm:role", "x-roman");
				span.appendChild(doc.createTextNode(line.romanLyric));
				lineP.appendChild(span);
			}

			const hasRoman =
				mainWords.some((w) => w.romanWord && w.romanWord.trim().length > 0) ||
				bgWords.some((w) => w.romanWord && w.romanWord.trim().length > 0);

			if (hasRoman) {
				romanizationMap.set(itunesKey, { main: mainWords, bg: bgWords });
			}

			paramDiv.appendChild(lineP);
		}

		body.appendChild(paramDiv);
	}

	if (romanizationMap.size > 0) {
		const itunesMeta = doc.createElement("iTunesMetadata");
		itunesMeta.setAttribute(
			"xmlns",
			"http://music.apple.com/lyric-ttml-internal",
		);

		const transliterations = doc.createElement("transliterations");
		const transliteration = doc.createElement("transliteration");

		for (const [key, { main, bg }] of romanizationMap.entries()) {
			const textEl = doc.createElement("text");
			textEl.setAttribute("for", key);

			for (const word of main) {
				if (word.romanWord && word.romanWord.trim().length > 0) {
					textEl.appendChild(createRomanizationSpan(word));
				} else if (word.word.trim().length === 0 && textEl.hasChildNodes()) {
					textEl.appendChild(doc.createTextNode(word.word));
				}
			}

			const hasBgRoman = bg.some(
				(w) => w.romanWord && w.romanWord.trim().length > 0,
			);
			if (hasBgRoman) {
				const bgSpan = doc.createElement("span");
				bgSpan.setAttribute("ttm:role", "x-bg");

				const romanBgWords = bg.filter(
					(w) => w.romanWord && w.romanWord.trim().length > 0,
				);

				for (let wordIndex = 0; wordIndex < romanBgWords.length; wordIndex++) {
					const word = romanBgWords[wordIndex];
					const span = createRomanizationSpan(word);

					if (wordIndex === 0 && span.firstChild) {
						span.firstChild.nodeValue = `(${span.firstChild.nodeValue}`;
					}
					if (wordIndex === romanBgWords.length - 1 && span.firstChild) {
						span.firstChild.nodeValue = `${span.firstChild.nodeValue})`;
					}

					bgSpan.appendChild(span);

					const originalIndex = bg.indexOf(word);
					if (originalIndex > -1 && originalIndex < bg.length - 1) {
						const nextWord = bg[originalIndex + 1];
						if (nextWord && nextWord.word.trim().length === 0) {
							bgSpan.appendChild(doc.createTextNode(nextWord.word));
						}
					}
				}
				textEl.appendChild(bgSpan);
			}

			transliteration.appendChild(textEl);
		}

		transliterations.appendChild(transliteration);
		itunesMeta.appendChild(transliterations);

		metadataEl.appendChild(itunesMeta);
	}

	ttRoot.appendChild(body);
	log("ttml document built", ttRoot);

	if (pretty) {
		const xsltDoc = new DOMParser().parseFromString(
			[
				'<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">',
				'  <xsl:strip-space elements="*"/>',
				'  <xsl:template match="para[content-style][not(text())]">',
				'    <xsl:value-of select="normalize-space(.)"/>',
				"  </xsl:template>",
				'  <xsl:template match="node()|@*">',
				'    <xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>',
				"  </xsl:template>",
				'  <xsl:output indent="yes"/>',
				"</xsl:stylesheet>",
			].join("\n"),
			"application/xml",
		);

		const xsltProcessor = new XSLTProcessor();
		xsltProcessor.importStylesheet(xsltDoc);
		const resultDoc = xsltProcessor.transformToDocument(doc);

		return new XMLSerializer().serializeToString(resultDoc);
	}
	return new XMLSerializer().serializeToString(doc);
}
