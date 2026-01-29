import { produce } from "immer";
import { useStore } from "jotai";
import { type FC, useCallback } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	findNextWord,
	getCurrentLineLocation,
	getCurrentLocation,
	isSynchronizableLine,
	isSynchronizableWord,
} from "$/modules/lyric-editor/utils/lyric-states";
import {
	SyncJudgeMode,
	smartFirstWordAtom,
	smartLastWordAtom,
	syncJudgeModeAtom,
} from "$/modules/settings/states";
import {
	currentEmptyBeatAtom,
	smartFirstWordActiveIdAtom,
	syncTimeOffsetAtom,
} from "$/modules/settings/states/sync";
import {
	keyMoveNextLineAtom,
	keyMoveNextWordAndPlayAtom,
	keyMoveNextWordAtom,
	keyMovePrevLineAtom,
	keyMovePrevWordAndPlayAtom,
	keyMovePrevWordAtom,
    keyMoveLastWordAndPlayAtom,
	keyMoveFirstWordAndPlayAtom,
	keySyncEndAtom,
	keySyncNextAtom,
	keySyncStartAtom,
} from "$/states/keybindings.ts";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main.ts";
import {
	type KeyBindingEvent,
	useKeyBindingAtom,
} from "$/utils/keybindings.ts";

export const SyncKeyBinding: FC = () => {
	const store = useStore();

	const calcJudgeTime = useCallback(
		(evt: KeyBindingEvent) => {
			const syncTimeOffset = store.get(syncTimeOffsetAtom);
			const currentTime = Math.max(
				0,
				audioEngine.musicCurrentTime * 1000 + syncTimeOffset,
			);
			const syncJudgeMode = store.get(syncJudgeModeAtom);
			if (syncJudgeMode === SyncJudgeMode.FirstKeyDownTimeLegacy) {
				return (
					Math.max(
						0,
						audioEngine.musicCurrentTime * 1000 -
							evt.downTimeOffset +
							syncTimeOffset,
					) | 0
				);
			}
			let timeAdjustment = 0;
			if (audioEngine.musicPlaying) {
				switch (syncJudgeMode) {
					case SyncJudgeMode.FirstKeyDownTime:
						timeAdjustment -= evt.downTimeOffset;
						break;
					case SyncJudgeMode.LastKeyUpTime:
						break;
					case SyncJudgeMode.MiddleKeyTime:
						timeAdjustment -= currentTime - evt.downTimeOffset / 2;
						break;
				}
				timeAdjustment *= audioEngine.musicPlayBackRate;
			}
			return Math.max(0, currentTime + timeAdjustment) | 0;
		},
		[store],
	);

	const moveToNextWordBase = useCallback(
		(play: boolean): boolean => {
			const location = getCurrentLocation(store);
			if (!location) return false;
			const nextWord = findNextWord(
				location.lines,
				location.lineIndex,
				location.wordIndex,
			);
			if (!nextWord) return false;
			store.set(selectedWordsAtom, new Set([nextWord.word.id]));
			store.set(selectedLinesAtom, new Set([nextWord.line.id]));
			store.set(currentEmptyBeatAtom, 0);
			if (play) audioEngine.seekMusic(nextWord.word.startTime / 1000);
			return true;
		},
		[store],
	);

	const moveToNextWord = useCallback(
		() => moveToNextWordBase(false),
		[moveToNextWordBase],
	);
	const moveToNextWordAndPlay = useCallback(
		() => moveToNextWordBase(true),
		[moveToNextWordBase],
	);

	const moveToPrevWordBase = useCallback(
		(play: boolean): boolean => {
			const location = getCurrentLocation(store);
			if (!location) return false;
			if (location.wordIndex === 0) {
				if (location.lineIndex === 0) return false;
				const lastLineIndex = Math.max(0, location.lineIndex);
				const lastLine = location.lines
					.slice(0, lastLineIndex)
					.reverse()
					.find(isSynchronizableLine);
				if (!lastLine) return false;
				store.set(selectedLinesAtom, new Set([lastLine.id]));
				if (lastLine.words.length === 0) {
					store.set(selectedWordsAtom, new Set());
				} else {
					const lastWord = lastLine.words
						.slice()
						.reverse()
						.find(isSynchronizableWord);
					if (!lastWord) return false;
					store.set(selectedWordsAtom, new Set([lastWord.id]));
					if (play) audioEngine.seekMusic(lastWord.startTime / 1000);
				}
			} else {
				const prevWord = location.line.words
					.slice(0, location.wordIndex)
					.reverse()
					.find(isSynchronizableWord);
				if (!prevWord) return false;
				store.set(selectedWordsAtom, new Set([prevWord.id]));
				if (play) audioEngine.seekMusic(prevWord.startTime / 1000);
			}
			return true;
		},
		[store],
	);
	const moveToPrevWord = useCallback(
		() => moveToPrevWordBase(false),
		[moveToPrevWordBase],
	);
	const moveToPrevWordAndPlay = useCallback(
		() => moveToPrevWordBase(true),
		[moveToPrevWordBase],
	);

	// 移动打轴光标

	useKeyBindingAtom(keyMoveNextLineAtom, () => {
		const location = getCurrentLineLocation(store);
		if (!location) return;
		const lastLineIndex = Math.min(
			location.lines.length,
			location.lineIndex + 1,
		);
		const lastLine = location.lines[lastLineIndex];
		if (!lastLine) return;
		store.set(selectedLinesAtom, new Set([lastLine.id]));
		if (lastLine.words.length === 0) {
			store.set(selectedWordsAtom, new Set());
		} else {
			store.set(selectedWordsAtom, new Set([lastLine.words[0]?.id]));
		}
	}, [store]);

	useKeyBindingAtom(keyMovePrevLineAtom, () => {
		const location = getCurrentLineLocation(store);
		if (!location) return;
		const lastLineIndex = Math.max(0, location.lineIndex - 1);
		const lastLine = location.lines[lastLineIndex];
		if (!lastLine) return;
		store.set(selectedLinesAtom, new Set([lastLine.id]));
		if (lastLine.words.length === 0) {
			store.set(selectedWordsAtom, new Set());
		} else {
			store.set(selectedWordsAtom, new Set([lastLine.words[0]?.id]));
		}
	}, [store]);

	useKeyBindingAtom(keyMoveNextWordAtom, moveToNextWord, [store]);
	useKeyBindingAtom(keyMoveNextWordAndPlayAtom, moveToNextWordAndPlay, [store]);
	useKeyBindingAtom(keyMovePrevWordAtom, moveToPrevWord, [store]);
	useKeyBindingAtom(keyMovePrevWordAndPlayAtom, moveToPrevWordAndPlay, [store]);

	useKeyBindingAtom(keyMoveLastWordAndPlayAtom, () => {
		const location = getCurrentLineLocation(store);
		if (!location) return;

		const lastWord = location.line.words
			.slice()
			.reverse()
			.find(isSynchronizableWord);

		if (!lastWord) return;

		store.set(selectedWordsAtom, new Set([lastWord.id]));
		store.set(selectedLinesAtom, new Set([location.line.id]));
		audioEngine.seekMusic(lastWord.startTime / 1000);
	}, [store]);

	useKeyBindingAtom(keyMoveFirstWordAndPlayAtom, () => {
		const location = getCurrentLineLocation(store);
		if (!location) return;

		const firstWord = location.line.words.find(isSynchronizableWord);
		if (!firstWord) return;

		store.set(selectedWordsAtom, new Set([firstWord.id]));
		store.set(selectedLinesAtom, new Set([location.line.id]));
		audioEngine.seekMusic(firstWord.startTime / 1000);
	}, [store]);

	// 记录时间戳（主要打轴按键）

	useKeyBindingAtom(
		keySyncStartAtom,
		(evt) => {
			const location = getCurrentLocation(store);
			if (!location) return;
			const currentTime = calcJudgeTime(evt);

			const smartFirstWord = store.get(smartFirstWordAtom);
			if (smartFirstWord && location.isFirstWord) {
				store.set(smartFirstWordActiveIdAtom, location.word.id);
			}

			store.set(lyricLinesAtom, (state) =>
				produce(state, (state) => {
					const line = state.lyricLines[location.lineIndex];
					if (location.isFirstWord) {
						line.startTime = currentTime;
					}
					line.words[location.wordIndex].startTime = currentTime;
				}),
			);
		},
		[store],
	);
	useKeyBindingAtom(
		keySyncNextAtom,
		(evt) => {
			const location = getCurrentLocation(store);
			if (!location) return;
			const currentTime = calcJudgeTime(evt);

			// 智能首字
			const smartFirstWord = store.get(smartFirstWordAtom);
			if (smartFirstWord && location.isFirstWord) {
				const activeId = store.get(smartFirstWordActiveIdAtom);
				if (activeId !== location.word.id) {
					store.set(lyricLinesAtom, (state) =>
						produce(state, (state) => {
							const line = state.lyricLines[location.lineIndex];
							line.startTime = currentTime;
							line.words[location.wordIndex].startTime = currentTime;
						}),
					);
					store.set(smartFirstWordActiveIdAtom, location.word.id);
					return;
				}
			}
			store.set(smartFirstWordActiveIdAtom, null);

			const emptyBeat = store.get(currentEmptyBeatAtom);
			if (emptyBeat < location.word.emptyBeat) {
				store.set(currentEmptyBeatAtom, emptyBeat + 1);
				return;
			}

			// 智能尾字
			const smartLastWord = store.get(smartLastWordAtom);
			if (smartLastWord && location.isLastWord) {
				store.set(lyricLinesAtom, (state) =>
					produce(state, (state) => {
						const line = state.lyricLines[location.lineIndex];
						line.words[location.wordIndex].endTime = currentTime;
						line.endTime = currentTime;
					}),
				);
				moveToNextWord();
				return;
			}

			store.set(lyricLinesAtom, (state) =>
				produce(state, (state) => {
					const curLine = state.lyricLines[location.lineIndex];
					curLine.words[location.wordIndex].endTime = currentTime;
					const nextWord = findNextWord(
						state.lyricLines,
						location.lineIndex,
						location.wordIndex,
					);
					if (nextWord) {
						if (curLine !== nextWord.line) {
							curLine.endTime = currentTime;
							nextWord.line.startTime = currentTime;
						}
						nextWord.word.startTime = currentTime;
					}
				}),
			);
			moveToNextWord();

			// 开了智能首字后，连轴打到下一行时跳过智能首字
			if (smartFirstWord) {
				const newLocation = getCurrentLocation(store);
				if (newLocation?.isFirstWord) {
					store.set(smartFirstWordActiveIdAtom, newLocation.word.id);
				}
			}
		},
		[store, moveToNextWord],
	);
	useKeyBindingAtom(
		keySyncEndAtom,
		(evt) => {
			const location = getCurrentLocation(store);
			if (!location) return;
			const currentTime = calcJudgeTime(evt);
			store.set(lyricLinesAtom, (state) =>
				produce(state, (state) => {
					const line = state.lyricLines[location.lineIndex];
					line.words[location.wordIndex].endTime = currentTime;
					if (location.isLastWord) {
						line.endTime = currentTime;
					}
				}),
			);
			moveToNextWord();
		},
		[store, moveToNextWord],
	);

	return null;
};
