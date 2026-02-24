import type { Draft } from "immer";
import {
	type ProcessedLyricLine,
	processSingleLine,
	type WordSegment,
} from "$/modules/segmentation/utils/segment-processing";
import { lyricLinesAtom } from "$/states/main";
import { globalStore } from "$/states/store.ts";
import type { LyricLine, LyricWord } from "$/types/ttml";

const MIN_DIVIDER_WIDTH_PX = 15;
const MIN_WORD_DURATION_MS = 10;

function fillRubyTimingFromWord(word: Draft<LyricWord>) {
	if (!word.ruby || word.ruby.length === 0) return;
	const shouldFill = word.ruby.every(
		(rubyWord) => rubyWord.startTime === 0 && rubyWord.endTime === 0,
	);
	if (!shouldFill) return;
	const totalDuration = word.endTime - word.startTime;
	if (totalDuration <= 0) return;
	const perRubyDuration = totalDuration / word.ruby.length;
	let cursor = word.startTime;
	for (const rubyWord of word.ruby) {
		rubyWord.startTime = cursor;
		rubyWord.endTime = cursor + perRubyDuration;
		cursor += perRubyDuration;
	}
}

export function getUpdatedLineForDivider(
	originalLine: ProcessedLyricLine,
	/**
	 * 分割线左侧 segment 的索引
	 *
	 * -1 表示行首
	 */
	segmentIndex: number,
	/**
	 * 拖拽后计算出的新时间戳
	 */
	newTime: number,
	isGapCreation: boolean,
	zoom: number,
): ProcessedLyricLine {
	const segments = [...originalLine.segments];
	let newStartTime = originalLine.startTime;
	let newEndTime = originalLine.endTime;

	const minVisualDurationMs = (MIN_DIVIDER_WIDTH_PX / zoom) * 1000;
	const dynamicMinDurationMs = Math.max(
		MIN_WORD_DURATION_MS,
		minVisualDurationMs,
	);

	const leftSegment = segments[segmentIndex] || null;
	const rightSegment = segments[segmentIndex + 1] || null;

	const minTime =
		leftSegment && leftSegment.type === "word"
			? leftSegment.startTime + dynamicMinDurationMs
			: leftSegment
				? leftSegment.startTime
				: 0;

	const maxTime =
		rightSegment && rightSegment.type === "word"
			? rightSegment.endTime - dynamicMinDurationMs
			: rightSegment
				? rightSegment.endTime
				: Infinity;

	let clampedTime = Math.max(minTime, newTime);
	clampedTime = Math.min(maxTime, clampedTime);
	clampedTime = Math.max(0, clampedTime);

	const newSegments = [...segments];

	if (segmentIndex === -1) {
		if (rightSegment && rightSegment.type === "word") {
			clampedTime = Math.min(
				clampedTime,
				rightSegment.endTime - dynamicMinDurationMs,
			);
		}
		newStartTime = clampedTime;
		if (rightSegment) {
			newSegments[segmentIndex + 1] = {
				...rightSegment,
				startTime: clampedTime,
			};
		}
	} else if (segmentIndex === segments.length - 1) {
		if (leftSegment && leftSegment.type === "word") {
			clampedTime = Math.max(
				clampedTime,
				leftSegment.startTime + dynamicMinDurationMs,
			);
		}
		newEndTime = clampedTime;
		if (leftSegment) {
			newSegments[segmentIndex] = { ...leftSegment, endTime: clampedTime };
		}
	} else {
		const originalTime = leftSegment.endTime;
		if (isGapCreation) {
			if (clampedTime > originalTime) {
				newSegments[segmentIndex + 1] = {
					...rightSegment,
					startTime: clampedTime,
				};
			} else if (clampedTime < originalTime) {
				newSegments[segmentIndex] = { ...leftSegment, endTime: clampedTime };
			}
		} else {
			newSegments[segmentIndex] = { ...leftSegment, endTime: clampedTime };
			newSegments[segmentIndex + 1] = {
				...rightSegment,
				startTime: clampedTime,
			};
		}
	}

	return {
		...originalLine,
		startTime: newStartTime,
		endTime: newEndTime,
		segments: newSegments,
	};
}

export function commitUpdatedLine(updatedLine: ProcessedLyricLine) {
	const updatedValidSegments = updatedLine.segments.filter(
		(s): s is WordSegment => s.type === "word",
	);

	const updatedWordsMap = new Map<string, WordSegment>();
	const updatedRubyMap = new Map<string, Map<number, WordSegment>>();
	for (const segment of updatedValidSegments) {
		if (
			segment.isRuby &&
			segment.parentId &&
			typeof segment.rubyIndex === "number"
		) {
			const rubyUpdates =
				updatedRubyMap.get(segment.parentId) ?? new Map<number, WordSegment>();
			rubyUpdates.set(segment.rubyIndex, segment);
			updatedRubyMap.set(segment.parentId, rubyUpdates);
		} else {
			updatedWordsMap.set(segment.id, segment);
		}
	}

	globalStore.set(lyricLinesAtom, (prev) => {
		const newLines = prev.lyricLines.map((line) => {
			if (line.id !== updatedLine.id) {
				return line;
			}

			const newWords = line.words.map((originalWord) => {
				const updatedWord = updatedWordsMap.get(originalWord.id);
				let nextWord = originalWord;
				if (updatedWord) {
					const { type, isRuby, parentId, rubyIndex, ...word } = updatedWord;
					nextWord = word;
				}

				const rubyUpdates = updatedRubyMap.get(originalWord.id);
				if (rubyUpdates && nextWord.ruby) {
					const newRuby = nextWord.ruby.map((rubyWord, index) => {
						const updatedRuby = rubyUpdates.get(index);
						if (!updatedRuby) return rubyWord;
						return {
							...rubyWord,
							word: updatedRuby.word,
							startTime: updatedRuby.startTime,
							endTime: updatedRuby.endTime,
						};
					});
					const validRuby = newRuby.filter(
						(rubyWord) => rubyWord.endTime > rubyWord.startTime,
					);
					if (validRuby.length > 0) {
						const minStart = Math.min(
							...validRuby.map((rubyWord) => rubyWord.startTime),
						);
						const maxEnd = Math.max(
							...validRuby.map((rubyWord) => rubyWord.endTime),
						);
						nextWord = {
							...nextWord,
							startTime: minStart,
							endTime: maxEnd,
							ruby: newRuby,
						};
					} else {
						nextWord = {
							...nextWord,
							ruby: newRuby,
						};
					}
				}

				return nextWord;
			});

			return {
				...line,
				startTime: updatedLine.startTime,
				endTime: updatedLine.endTime,
				words: newWords,
			};
		});

		return {
			...prev,
			lyricLines: newLines,
		};
	});
}

export function getUpdatedLineForWordPan(
	processedLine: ProcessedLyricLine,
	wordId: string,
	desiredNewStartMS: number,
	zoom: number,
): ProcessedLyricLine {
	const segmentIndex = processedLine.segments.findIndex((s) => s.id === wordId);
	if (segmentIndex === -1) return processedLine;

	const segment = processedLine.segments[segmentIndex];
	if (segment.type !== "word") return processedLine;

	const leftSegment = processedLine.segments[segmentIndex - 1] || null;
	const rightSegment = processedLine.segments[segmentIndex + 1] || null;

	const wordDurationMS = segment.endTime - segment.startTime;

	const minVisualDurationMs = (MIN_DIVIDER_WIDTH_PX / zoom) * 1000;
	const dynamicMinDurationMs = Math.max(
		MIN_WORD_DURATION_MS,
		minVisualDurationMs,
	);

	let minStartMS: number;
	if (!leftSegment) {
		minStartMS = processedLine.startTime;
	} else if (leftSegment.type === "gap") {
		minStartMS = leftSegment.startTime;
	} else {
		minStartMS = leftSegment.startTime + dynamicMinDurationMs;
	}

	let maxStartMS: number;
	if (!rightSegment) {
		maxStartMS = processedLine.endTime - wordDurationMS;
	} else if (rightSegment.type === "gap") {
		maxStartMS = rightSegment.endTime - wordDurationMS;
	} else {
		maxStartMS = rightSegment.endTime - dynamicMinDurationMs - wordDurationMS;
	}

	let newStartMS = Math.max(minStartMS, desiredNewStartMS);
	newStartMS = Math.min(maxStartMS, newStartMS);
	const newEndMS = newStartMS + wordDurationMS;

	if (Math.round(newStartMS) === Math.round(segment.startTime)) {
		return processedLine;
	}

	const newSegments = [...processedLine.segments];

	newSegments[segmentIndex] = {
		...segment,
		startTime: newStartMS,
		endTime: newEndMS,
	};

	if (leftSegment) {
		newSegments[segmentIndex - 1] = {
			...leftSegment,
			endTime: newStartMS,
		};
	}

	if (rightSegment) {
		newSegments[segmentIndex + 1] = {
			...rightSegment,
			startTime: newEndMS,
		};
	}

	return {
		...processedLine,
		segments: newSegments,
	};
}

export function getUpdatedLineForLinePan(
	processedLine: ProcessedLyricLine,
	newStartMS: number,
): ProcessedLyricLine {
	newStartMS = Math.max(0, newStartMS);

	const deltaMS = newStartMS - processedLine.startTime;

	if (Math.round(deltaMS) === 0) {
		return processedLine;
	}

	const newEndMS = processedLine.endTime + deltaMS;

	const newSegments = processedLine.segments.map((segment) => ({
		...segment,
		startTime: segment.startTime + deltaMS,
		endTime: segment.endTime + deltaMS,
	}));

	return {
		...processedLine,
		startTime: newStartMS,
		endTime: newEndMS,
		segments: newSegments,
	};
}

export function tryInitializeZeroTimestampLine(
	line: Draft<LyricLine>,
	newStartTime: number,
	newEndTime: number,
): boolean {
	const isAllZero =
		line.words.length > 0 &&
		line.words.every((w) => w.startTime === 0 && w.endTime === 0);

	if (isAllZero) {
		line.startTime = newStartTime;
		line.endTime = newEndTime;
		const totalDuration = newEndTime - newStartTime;
		const nonEmptyWordCount = line.words.filter(
			(w) => w.word.trim() !== "",
		).length;

		if (nonEmptyWordCount === 0) {
			return true;
		}

		const perWordDuration = totalDuration / nonEmptyWordCount;
		let nonEmptyWordIndex = 0;

		line.words.forEach((word) => {
			if (word.word.trim() !== "") {
				word.startTime = newStartTime + nonEmptyWordIndex * perWordDuration;
				word.endTime = newStartTime + (nonEmptyWordIndex + 1) * perWordDuration;
				nonEmptyWordIndex++;
			}
			fillRubyTimingFromWord(word);
		});
		return true;
	}
	return false;
}

export function tryFixPartialInitialization(line: Draft<LyricLine>): boolean {
	const hasZeroWord = line.words.some(
		(w) => w.startTime === 0 && w.endTime === 0 && w.word.trim() !== "",
	);
	const hasNonZeroWord = line.words.some(
		(w) => w.startTime !== 0 || w.endTime !== 0,
	);

	if (!hasZeroWord || !hasNonZeroWord) {
		return false;
	}

	let didChange = false;

	for (let i = 0; i < line.words.length; i++) {
		const anchorWord = line.words[i];

		if (anchorWord.startTime !== 0 || anchorWord.endTime !== 0) {
			const groupToProcess = [anchorWord];
			let lookaheadIndex = i + 1;

			while (
				lookaheadIndex < line.words.length &&
				line.words[lookaheadIndex].startTime === 0 &&
				line.words[lookaheadIndex].endTime === 0
			) {
				groupToProcess.push(line.words[lookaheadIndex]);
				lookaheadIndex++;
			}

			if (groupToProcess.length > 1) {
				didChange = true;
				const groupStartTime = anchorWord.startTime;
				const totalDuration = anchorWord.endTime - anchorWord.startTime;

				const nonEmptyWords = groupToProcess.filter(
					(w) => w.word.trim() !== "",
				);
				const nonEmptyWordCount = nonEmptyWords.length;

				if (nonEmptyWordCount > 0 && totalDuration > 0) {
					const perWordDuration = totalDuration / nonEmptyWordCount;
					let cursorTime = groupStartTime;

					for (const word of groupToProcess) {
						if (word.word.trim() !== "") {
							word.startTime = cursorTime;
							word.endTime = cursorTime + perWordDuration;
							cursorTime += perWordDuration;
						} else {
							word.startTime = cursorTime;
							word.endTime = cursorTime;
						}
						fillRubyTimingFromWord(word);
					}
				}

				i = lookaheadIndex - 1;
			}
		}
	}

	return didChange;
}

export function shiftLineStartTime(
	line: Draft<LyricLine>,
	newStartTime: number,
) {
	const delta = newStartTime - line.startTime;
	if (delta !== 0) {
		line.startTime = newStartTime;
		for (const word of line.words) {
			word.startTime += delta;
			word.endTime += delta;
			if (word.ruby && word.ruby.length > 0) {
				for (const rubyWord of word.ruby) {
					rubyWord.startTime += delta;
					rubyWord.endTime += delta;
				}
			}
		}
	}
}

export function adjustLineEndTime(line: Draft<LyricLine>, newEndTime: number) {
	const currentLastWordEnd =
		line.words.length > 0
			? line.words[line.words.length - 1].endTime
			: line.endTime;

	const diff = currentLastWordEnd - newEndTime;

	if (line.words.length === 0) {
		line.endTime = newEndTime;
		return;
	}

	if (diff < 0) {
		line.endTime = newEndTime;
		const lastWord = line.words[line.words.length - 1];
		if (newEndTime > lastWord.startTime) {
			lastWord.endTime = newEndTime;
		}
	} else if (diff > 0) {
		line.endTime = newEndTime;

		const processedLine = processSingleLine(line);

	type RubyWord = NonNullable<LyricWord["ruby"]>[number];
		interface CompressTarget {
			duration: number;
		ref?: Draft<LyricWord | RubyWord>;
		}

		const wordDraftMap = new Map<string, Draft<LyricWord>>();
	const rubyDraftMap = new Map<string, Map<number, Draft<RubyWord>>>();
		for (const w of line.words) {
			wordDraftMap.set(w.id, w);
		if (w.ruby && w.ruby.length > 0) {
			const rubyMap = new Map<number, Draft<RubyWord>>();
			w.ruby.forEach((rubyWord, index) => {
				rubyMap.set(index, rubyWord);
			});
			rubyDraftMap.set(w.id, rubyMap);
		}
		}

		const targets: CompressTarget[] = processedLine.segments.map((seg) => ({
			duration: seg.endTime - seg.startTime,
		ref:
			seg.type === "word"
				? seg.isRuby && seg.parentId && typeof seg.rubyIndex === "number"
					? rubyDraftMap.get(seg.parentId)?.get(seg.rubyIndex)
					: wordDraftMap.get(seg.id)
				: undefined,
		}));

		let remainingReduction = diff;
		const MIN_DURATION = 50;

		for (let i = targets.length - 1; i >= 0; i--) {
			if (remainingReduction <= 0) break;

			const target = targets[i];
			const maxReducible = Math.max(0, target.duration - MIN_DURATION);
			const reduceAmount = Math.min(remainingReduction, maxReducible);

			target.duration -= reduceAmount;
			remainingReduction -= reduceAmount;
		}

		if (remainingReduction > 0) {
			const currentTotalDuration = targets.reduce(
				(sum, t) => sum + t.duration,
				0,
			);
			const targetTotalDuration = currentTotalDuration - remainingReduction;

			if (targetTotalDuration > 0 && currentTotalDuration > 0) {
				const scale = targetTotalDuration / currentTotalDuration;
				for (const target of targets) {
					target.duration *= scale;
				}
			}
		}

		let writeCursor = line.startTime;

		for (const target of targets) {
			if (target.ref) {
				target.ref.startTime = writeCursor;
				target.ref.endTime = writeCursor + target.duration;
			}
			writeCursor += target.duration;
		}
	for (const word of line.words) {
		if (word.ruby && word.ruby.length > 0) {
			const validRuby = word.ruby.filter(
				(rubyWord) => rubyWord.endTime > rubyWord.startTime,
			);
			if (validRuby.length > 0) {
				word.startTime = Math.min(
					...validRuby.map((rubyWord) => rubyWord.startTime),
				);
				word.endTime = Math.max(
					...validRuby.map((rubyWord) => rubyWord.endTime),
				);
			}
		}
	}
	}
}
