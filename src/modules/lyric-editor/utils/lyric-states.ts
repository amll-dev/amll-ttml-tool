import { type createStore, useAtomValue } from "jotai";
import { useMemo } from "react";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main.ts";
import type { LyricLine, LyricWord, LyricWordBase } from "$/types/ttml";

export interface LineLocationResult {
	lines: LyricLine[];
	line: LyricLine;
	lineIndex: number;
}

export interface LineAndWordLocationResult extends LineLocationResult {
	word: LyricWord;
	wordIndex: number;
	rubyIndex?: number;
	rubyWord?: LyricWordBase;
	syncIndex: number;
	syncId: string;
	isFirstWord: boolean;
	isLastWord: boolean;
}

export interface SyncWordUnit {
	id: string;
	word: LyricWord;
	wordIndex: number;
	rubyIndex?: number;
	rubyWord?: LyricWordBase;
}

export const buildRubySelectionId = (wordId: string, rubyIndex: number) =>
	`${wordId}-ruby-${rubyIndex}`;

export const parseRubySelectionId = (id: string) => {
	const match = id.match(/^(.*)-ruby-(\d+)$/);
	if (!match) return;
	return {
		wordId: match[1],
		rubyIndex: Number.parseInt(match[2], 10),
	};
};

export const getSyncUnitsForLine = (line: LyricLine): SyncWordUnit[] =>
	line.words.flatMap((word, wordIndex) => {
		if (word.ruby && word.ruby.length > 0) {
			return word.ruby.map((rubyWord, rubyIndex) => ({
				id: buildRubySelectionId(word.id, rubyIndex),
				word,
				wordIndex,
				rubyIndex,
				rubyWord,
			}));
		}
		return [
			{
				id: word.id,
				word,
				wordIndex,
			},
		];
	});

export const getSynchronizableUnits = (line: LyricLine) =>
	getSyncUnitsForLine(line).filter((unit) => {
		const text = unit.rubyWord?.word ?? unit.word.word;
		return text.trim().length > 0;
	});

export const getFirstSynchronizableUnit = (line: LyricLine) =>
	getSynchronizableUnits(line)[0];

export const getLastSynchronizableUnit = (line: LyricLine) => {
	const units = getSynchronizableUnits(line);
	return units[units.length - 1];
};

export function getCurrentLineLocation(
	store: ReturnType<typeof createStore>,
): LineLocationResult | undefined {
	const lyricLines = store.get(lyricLinesAtom).lyricLines;
	const selectedLineId = [...store.get(selectedLinesAtom)][0]; // 进入打轴模式下一般不会出现多选的情况
	if (!selectedLineId) return;
	const lyricLine = lyricLines.findIndex((line) => line.id === selectedLineId);
	if (lyricLine === -1) return;
	return {
		lines: lyricLines,
		line: lyricLines[lyricLine],
		lineIndex: lyricLine,
	};
}

export function getCurrentLocation(
	store: ReturnType<typeof createStore>,
): LineAndWordLocationResult | undefined {
	const lyricLines = store.get(lyricLinesAtom).lyricLines;
	const selectedLineId = [...store.get(selectedLinesAtom)][0]; // 进入打轴模式下一般不会出现多选的情况
	if (!selectedLineId) return;
	const lyricLine = lyricLines.findIndex((line) => line.id === selectedLineId);
	if (lyricLine === -1) return;
	const selectedWordId = [...store.get(selectedWordsAtom)][0];
	if (!selectedWordId) return;
	const line = lyricLines[lyricLine];
	const syncUnits = getSynchronizableUnits(line);
	let syncIndex = syncUnits.findIndex((unit) => unit.id === selectedWordId);
	if (syncIndex === -1) {
		const parsed = parseRubySelectionId(selectedWordId);
		if (parsed) {
			syncIndex = syncUnits.findIndex(
				(unit) =>
					unit.word.id === parsed.wordId &&
					unit.rubyIndex === parsed.rubyIndex,
			);
		} else {
			syncIndex = syncUnits.findIndex((unit) => unit.word.id === selectedWordId);
		}
	}
	if (syncIndex === -1) return;
	const targetUnit = syncUnits[syncIndex];
	if (!targetUnit) return;
	const isFirstWord = syncIndex === 0;
	const isLastWord = syncIndex === syncUnits.length - 1;
	return {
		lines: lyricLines,
		line,
		lineIndex: lyricLine,
		word: targetUnit.word,
		wordIndex: targetUnit.wordIndex,
		rubyIndex: targetUnit.rubyIndex,
		rubyWord: targetUnit.rubyWord,
		syncIndex,
		syncId: targetUnit.id,
		isFirstWord,
		isLastWord,
	};
}

export function useCurrentLocation(): LineAndWordLocationResult | undefined {
	const lyrics = useAtomValue(lyricLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const selectedWords = useAtomValue(selectedWordsAtom);
	const result = useMemo(() => {
		const lyricLine = lyrics.lyricLines.findIndex((line) =>
			selectedLines.has(line.id),
		);
		if (lyricLine === -1) return;
		const line = lyrics.lyricLines[lyricLine];
		const syncUnits = getSynchronizableUnits(line);
		let syncIndex = syncUnits.findIndex((unit) =>
			selectedWords.has(unit.id),
		);
		if (syncIndex === -1) {
			const selectedWordId = [...selectedWords][0];
			if (!selectedWordId) return;
			const parsed = parseRubySelectionId(selectedWordId);
			if (parsed) {
				syncIndex = syncUnits.findIndex(
					(unit) =>
						unit.word.id === parsed.wordId &&
						unit.rubyIndex === parsed.rubyIndex,
				);
			} else {
				syncIndex = syncUnits.findIndex(
					(unit) => unit.word.id === selectedWordId,
				);
			}
		}
		if (syncIndex === -1) return;
		const targetUnit = syncUnits[syncIndex];
		if (!targetUnit) return;
		const isFirstWord = syncIndex === 0;
		const isLastWord = syncIndex === syncUnits.length - 1;
		return {
			lines: lyrics.lyricLines,
			line,
			lineIndex: lyricLine,
			word: targetUnit.word,
			wordIndex: targetUnit.wordIndex,
			rubyIndex: targetUnit.rubyIndex,
			rubyWord: targetUnit.rubyWord,
			syncIndex,
			syncId: targetUnit.id,
			isFirstWord,
			isLastWord,
		};
	}, [lyrics, selectedLines, selectedWords]);
	return result;
}

export const isSynchronizableLine = (line: LyricLine) => !line.ignoreSync;

export function findNextWord(
	lyricLines: LyricLine[],
	lineIndex: number,
	syncIndex: number,
):
	| {
			unit: SyncWordUnit;
			line: LyricLine;
			lineIndex: number;
			syncIndex: number;
	  }
	| undefined {
	const line = lyricLines[lineIndex];
	if (!line) return;
	const units = getSynchronizableUnits(line);
	const nextUnit = units[syncIndex + 1];
	if (nextUnit) {
		return {
			line,
			lineIndex,
			unit: nextUnit,
			syncIndex: syncIndex + 1,
		};
	}
	const nextLineIndex = lyricLines
		.slice(lineIndex + 1)
		.findIndex(
			(nextLine) =>
				isSynchronizableLine(nextLine) &&
				getSynchronizableUnits(nextLine).length > 0,
		);
	if (nextLineIndex === -1) return;
	const absoluteIndex = lineIndex + 1 + nextLineIndex;
	const nextLine = lyricLines[absoluteIndex];
	if (!nextLine) return;
	const nextLineUnits = getSynchronizableUnits(nextLine);
	const firstUnit = nextLineUnits[0];
	if (!firstUnit) return;
	return {
		line: nextLine,
		lineIndex: absoluteIndex,
		unit: firstUnit,
		syncIndex: 0,
	};
}
