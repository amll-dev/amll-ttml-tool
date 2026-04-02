/*
 * Copyright 2023-2026 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/amll-dev/amll-ttml-tool/blob/main/LICENSE
 */

import {
	CutRegular,
	DeleteRegular,
	PaddingLeftRegular,
	PaddingRightRegular,
	SplitVerticalRegular,
	TaskListLtrRegular,
} from "@fluentui/react-icons";
import {
	Button,
	ContextMenu,
	Dialog,
	Flex,
	Grid,
	IconButton,
	Text,
	TextField,
} from "@radix-ui/themes";
import classNames from "classnames";
import { type Atom, atom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import {
	type FC,
	type MouseEvent,
	memo,
	type PropsWithChildren,
	type SyntheticEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { currentTimeAtom } from "$/modules/audio/states/index.ts";
import {
	displayRomanizationInSyncAtom,
	highlightActiveWordAtom,
	highlightErrorsAtom,
	LayoutMode,
	layoutModeAtom,
	quickFixesAtom,
	showTimestampsAtom,
} from "$/modules/settings/states/index.ts";
import {
	enableUpcomingWordHighlightAtom,
	upcomingWordHighlightColorAtom,
	upcomingWordHighlightThresholdAtom,
	visualizeTimestampUpdateAtom,
} from "$/modules/settings/states/sync.ts";
import { splitWordDialogAtom } from "$/states/dialogs.ts";
import {
	editingWordStateAtom,
	lyricLinesAtom,
	allLyricsWordsAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	showEndTimeAsDurationAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main.ts";
import { type LyricLine, type LyricWord, newLyricWord } from "$/types/ttml.ts";
import { msToTimestamp, parseTimespan } from "$/utils/timestamp.ts";
import { RubyEditor } from "../tools/RubyEditor.tsx";
import {
	getGrammarSuggestions,
} from "../utils/grammar-warning.ts";
import { buildRubySelectionId } from "../utils/lyric-states.ts";
import { normalizeLineTime } from "../utils/normalize-line-time.ts";
import styles from "./index.module.css";
import { LyricLineMenu } from "./lyric-line-menu.tsx";
import { LyricWordMenu } from "./lyric-word-menu";

const isDraggingAtom = atom(false);

const useWordBlank = (word: string) =>
	useMemo(
		() => word.length === 0 || (word.length > 0 && word.trim().length === 0),
		[word],
	);

const parseRubyShortcut = (value: string) => {
	if (value.endsWith("|")) {
		return {
			word: value.slice(0, -1),
			enableRuby: true,
		};
	}
	return {
		word: value,
		enableRuby: false,
	};
};

const getDisplayWordText = (
	t: (
		key: string,
		defaultValue: string,
		options?: { count?: number },
	) => string,
	word: string,
	isWordBlank: boolean,
	romanWord?: string,
	displayRomanizationInSync?: boolean,
) => {
	if (displayRomanizationInSync && romanWord && romanWord.trim() !== "")
		return romanWord;
	if (word === "") return t("lyricWordView.empty", "空白");
	if (isWordBlank)
		return t("lyricWordView.spaceCount", "空格 x{count}", {
			count: word.length,
		});
	return word;
};

type LyricWordViewEditProps = {
	wordAtom: Atom<LyricWord>;
	wordIndex: number;
	line: LyricLine;
	lineIndex: number;
};

type LyricWordViewEditSpanProps = {
	wordAtom: Atom<LyricWord>;
	wordIndex: number;
	line: LyricLine;
	className?: string;
	onDoubleClick?: () => void;
};

const LyricWordViewEditSpan = ({
	wordAtom,
	wordIndex,
	line,
	className,
	children,
	onDoubleClick,
}: PropsWithChildren<LyricWordViewEditSpanProps>) => {
	const word = useAtomValue(wordAtom);
	const store = useStore();
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setSelectedLines = useSetImmerAtom(selectedLinesAtom);
	const isWordSelectedAtom = useMemo(
		() => atom((get) => get(selectedWordsAtom).has(get(wordAtom).id)),
		[wordAtom],
	);
	const isWordSelected = useAtomValue(isWordSelectedAtom);
	const selectedWords = useAtomValue(selectedWordsAtom);
	const setSelectedWords = useSetImmerAtom(selectedWordsAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const blockDragRef = useRef(false);
	const lastClickTimeRef = useRef(0);

	function onWordSelect(evt: MouseEvent<HTMLSpanElement>) {
		if (evt.ctrlKey || evt.metaKey) {
			setSelectedWords((v) => {
				if (v.has(word.id)) {
					v.delete(word.id);
				} else {
					v.add(word.id);
				}
			});
		} else if (evt.shiftKey) {
			setSelectedWords((v) => {
				if (v.size > 0) {
					let minBoundry = Number.NaN;
					let maxBoundry = Number.NaN;
					line.words.forEach((word, i) => {
						if (v.has(word.id)) {
							if (Number.isNaN(minBoundry)) minBoundry = i;
							if (Number.isNaN(maxBoundry)) maxBoundry = i;

							minBoundry = Math.min(minBoundry, i, wordIndex);
							maxBoundry = Math.max(maxBoundry, i, wordIndex);
						}
					});
					for (let i = minBoundry; i <= maxBoundry; i++) {
						v.add(line.words[i].id);
					}
				} else {
					v.add(word.id);
				}
			});
		} else {
			setSelectedLines((state) => {
				if (!state.has(line.id) || state.size !== 1) {
					state.clear();
					state.add(line.id);
				}
			});
			setSelectedWords((state) => {
				if (!state.has(word.id) || state.size !== 1) {
					state.clear();
					state.add(word.id);
				}
			});
		}
	}

	return (
		<span
			draggable={toolMode === ToolMode.Edit}
			onPointerDown={(evt) => {
				blockDragRef.current =
					(evt.target as HTMLElement | null)?.tagName === "INPUT";
			}}
			onPointerUp={() => {
				blockDragRef.current = false;
			}}
			onDragStart={(evt) => {
				if (blockDragRef.current) {
					blockDragRef.current = false;
					evt.preventDefault();
					evt.stopPropagation();
					return;
				}
				if (!isWordSelected) onWordSelect(evt);
				evt.dataTransfer.effectAllowed = "copyMove";
				evt.dataTransfer.dropEffect = "move";
				store.set(isDraggingAtom, true);
				evt.stopPropagation();
			}}
			onDragEnd={() => {
				store.set(isDraggingAtom, false);
				blockDragRef.current = false;
			}}
			onDragOver={(evt) => {
				if (!store.get(isDraggingAtom)) return;
				if (isWordSelected) return;
				evt.preventDefault();
				evt.dataTransfer.dropEffect = "move";
				const rect = evt.currentTarget.getBoundingClientRect();
				const innerX = evt.clientX - rect.left;
				if (innerX < rect.width / 2) {
					evt.currentTarget.classList.add(styles.dropLeft);
					evt.currentTarget.classList.remove(styles.dropRight);
				} else {
					evt.currentTarget.classList.remove(styles.dropLeft);
					evt.currentTarget.classList.add(styles.dropRight);
				}
				const isCopyingWords = evt.ctrlKey || evt.metaKey;
				evt.dataTransfer.dropEffect = isCopyingWords ? "copy" : "move";
			}}
			onDrop={(evt) => {
				evt.currentTarget.classList.remove(styles.dropLeft);
				evt.currentTarget.classList.remove(styles.dropRight);
				if (!store.get(isDraggingAtom)) return;
				if (isWordSelected) return;

				const rect = evt.currentTarget.getBoundingClientRect();
				const innerX = evt.clientX - rect.left;
				const insertRight = innerX > rect.width / 2;

				const isCopyingWords = evt.ctrlKey || evt.metaKey;
				editLyricLines((state) => {
					let collectedWords: LyricWord[] = [];
					for (const line of state.lyricLines) {
						const words = line.words.filter((w) => selectedWords.has(w.id));
						collectedWords.push(...words);
						if (!isCopyingWords) {
							const deletedAtBounds =
								line.words.length > 0 &&
								(selectedWords.has(line.words[0].id) ||
									selectedWords.has(line.words[line.words.length - 1].id));
							line.words = line.words.filter((w) => !selectedWords.has(w.id));
							if (deletedAtBounds) normalizeLineTime(line);
						}
					}
					const targetLine = state.lyricLines.find(({ id }) => id === line.id);
					if (!targetLine) throw new Error("Target line not found");
					const targetIndex = targetLine.words.findIndex(
						(w) => w.id === word.id,
					);
					if (targetIndex < 0) throw new Error("Target word not found");
					if (isCopyingWords) {
						collectedWords = collectedWords.map((w) => ({
							...w,
							id: newLyricWord().id,
						}));
						setSelectedWords((v) => {
							v.clear();
							for (const w of collectedWords) {
								v.add(w.id);
							}
						});
					}
					const insertPosition = targetIndex + (insertRight ? 1 : 0);
					const insertedAtBounds =
						insertPosition === 0 || insertPosition === targetLine.words.length;
					targetLine.words.splice(insertPosition, 0, ...collectedWords);
					if (insertedAtBounds) normalizeLineTime(targetLine);
				});
			}}
			onDragLeave={(evt) => {
				evt.currentTarget.classList.remove(styles.dropLeft);
				evt.currentTarget.classList.remove(styles.dropRight);
			}}
			className={className}
			onClick={(evt) => {
				const now = Date.now();
				const wasAlreadySelected = isWordSelected && selectedWords.size === 1;
				const isSelectionClick = !evt.ctrlKey && !evt.metaKey && !evt.shiftKey;
				const clickInterval = now - lastClickTimeRef.current;
				lastClickTimeRef.current = now;

				evt.stopPropagation();
				evt.preventDefault();
				onWordSelect(evt);

				if (wasAlreadySelected && isSelectionClick && clickInterval > 100) {
					onDoubleClick?.();
				}
			}}
		>
			{children}
		</span>
	);
};

function WordEditField<F extends keyof LyricWord, V extends LyricWord[F]>({
	wordAtom,
	fieldName,
	formatter,
	parser,
	// textFieldStyle,
	children,
	...other
}: PropsWithChildren<
	{
		wordAtom: Atom<LyricWord>;
		fieldName: F;
		formatter: (v: V) => string;
		parser: (v: string) => V;
		textFieldStyle?: React.CSSProperties;
	} & TextField.RootProps
>) {
	const [fieldInput, setFieldInput] = useState<string | undefined>(undefined);
	const [fieldPlaceholder, setFieldPlaceholder] = useState<string>("");

	const editLyricLines = useSetImmerAtom(lyricLinesAtom);

	const currentValueAtom = useMemo(
		() =>
			atom((get) => {
				const word = get(wordAtom);
				return formatter(word[fieldName] as V);
			}),
		[fieldName, wordAtom, formatter],
	);
	const currentValue = useAtomValue(currentValueAtom);
	const store = useStore();

	const onInputFinished = useCallback(
		(rawValue: string) => {
			try {
				const thisWord = store.get(wordAtom);
				const { word: inputWord, enableRuby } =
					fieldName === "word"
						? parseRubyShortcut(rawValue)
						: { word: rawValue, enableRuby: false };
				const value =
					fieldName === "word"
						? (inputWord as unknown as V)
						: parser(inputWord as string);
				editLyricLines((state) => {
					for (const line of state.lyricLines) {
						for (const word of line.words) {
							if (thisWord.id === word.id) {
								word[fieldName] = value;
								if (fieldName === "word" && enableRuby && !word.ruby) {
									word.ruby = [];
								}
								break;
							}
						}
					}
					return state;
				});
			} catch {
				if (typeof currentValue === "string") setFieldInput(currentValue);
			}
		},
		[wordAtom, store, editLyricLines, currentValue, fieldName, parser],
	);

	useLayoutEffect(() => {
		setFieldInput(currentValue);
		setFieldPlaceholder("");
	}, [currentValue]);

	return (
		<TextField.Root
			size="1"
			value={fieldInput ?? ""}
			placeholder={fieldPlaceholder}
			disabled={fieldInput === undefined}
			onChange={(evt) => setFieldInput(evt.currentTarget.value)}
			onKeyDown={(evt) => {
				if (evt.key !== "Enter") return;
				onInputFinished(evt.currentTarget.value);
			}}
			onBlur={(evt) => {
				if (evt.currentTarget.value === currentValue) return;
				onInputFinished(evt.currentTarget.value);
			}}
			{...other}
		>
			{children}
		</TextField.Root>
	);
}

const LyricWordViewEditAdvance = ({
	wordAtom,
	wordIndex,
	line,
	lineIndex,
}: LyricWordViewEditProps) => {
	const store = useStore();
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setOpenSplitWordDialog = useSetAtom(splitWordDialogAtom);
	const setSplitState = useSetAtom(editingWordStateAtom);
	const setSelectedLines = useSetImmerAtom(selectedLinesAtom);
	const setSelectedWords = useSetImmerAtom(selectedWordsAtom);
	const currentWord = useAtomValue(wordAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const isWordSelectedAtom = useMemo(
		() => atom((get) => get(selectedWordsAtom).has(get(wordAtom).id)),
		[wordAtom],
	);
	const isWordSelected = useAtomValue(isWordSelectedAtom);

	const isWordBlank = useWordBlank(currentWord.word);
	const showRubyEditor = useMemo(
		() => currentWord.ruby !== undefined,
		[currentWord.ruby],
	);

	const hasError = useMemo(
		() => currentWord.startTime > currentWord.endTime,
		[currentWord.startTime, currentWord.endTime],
	);

	const className = useMemo(
		() =>
			classNames(
				styles.lyricWord,
				styles.edit,
				styles.advance,
				isWordSelected && styles.selected,
				isWordBlank && styles.blank,
				showRubyEditor && styles.rubyEnabled,
				hasError && toolMode === ToolMode.Edit && styles.error,
			),
		[isWordBlank, isWordSelected, showRubyEditor, hasError, toolMode],
	);

	return (
		<ContextMenu.Root
			onOpenChange={(open) => {
				if (!open) return;
				if (isWordSelected) return;
				setSelectedWords((state) => {
					state.clear();
					state.add(currentWord.id);
				});
				setSelectedLines((state) => {
					state.clear();
					state.add(line.id);
				});
			}}
		>
			<ContextMenu.Trigger><LyricWordViewEditSpan
					wordAtom={wordAtom}
					wordIndex={wordIndex}
					className={className}
					line={line}
					onDoubleClick={() => {
						// Grammar actions disabled in Edit mode
					}}
				>
					<WordEditField
						size="1"
						color="ruby"
						wordAtom={wordAtom}
						fieldName="startTime"
						formatter={msToTimestamp}
						parser={parseTimespan}
						style={{
							minWidth: "0",
						}}
					>
						<TextField.Slot><PaddingLeftRegular /></TextField.Slot>
					</WordEditField>
					<div className={styles.advanceBar}>
						<IconButton
							variant="soft"
							size="1"
							onClick={() => {
								setSplitState({
									wordIndex,
									lineIndex,
									word: currentWord.word,
								});
								setOpenSplitWordDialog(true);
							}}
						>
							<CutRegular />
						</IconButton>
						<WordEditField
							size="1"
							wordAtom={wordAtom}
							fieldName="word"
							formatter={String}
							parser={String}
							style={{
								minWidth: "0em",
							}}
						/>
						<IconButton
							variant="soft"
							size="1"
							onClick={() => {
								editLyricLines((state) => {
									const selectedWords = store.get(selectedWordsAtom);
									for (const line of state.lyricLines) {
										line.words = line.words.filter(
											(w) => !selectedWords.has(w.id),
										);
									}
								});
							}}
						>
							<DeleteRegular />
						</IconButton>
					</div>
					<div className={styles.rubyAdvanceRow}>
						<RubyEditor
							wordAtom={wordAtom}
							forceShow
							showIcon
							className={styles.rubyEditorCompact}
						/>
					</div>
					<WordEditField
						size="1"
						color="red"
						wordAtom={wordAtom}
						fieldName="endTime"
						formatter={msToTimestamp}
						parser={parseTimespan}
						style={{
							minWidth: "0",
						}}
					>
						<TextField.Slot><PaddingRightRegular /></TextField.Slot>
					</WordEditField>
					<div className={styles.advanceBar}>
						<WordEditField
							size="1"
							type="number"
							min={0}
							wordAtom={wordAtom}
							fieldName="emptyBeat"
							formatter={String}
							parser={Number.parseInt}
							style={{
								minWidth: "0",
							}}
						>
							<TextField.Slot><SplitVerticalRegular /></TextField.Slot>
						</WordEditField>
						<IconButton
							variant="soft"
							size="1"
							onClick={() => {
								editLyricLines((state) => {
									for (const line of state.lyricLines)
										for (const word of line.words)
											if (word.word === currentWord.word)
												word.emptyBeat = currentWord.emptyBeat;
								});
							}}
						>
							<TaskListLtrRegular />
						</IconButton>
					</div>
				</LyricWordViewEditSpan>
			</ContextMenu.Trigger>
			<ContextMenu.Content>
				<LyricWordMenu
					wordAtom={wordAtom}
					wordIndex={wordIndex}
					lineIndex={lineIndex}
				/>
				<LyricLineMenu lineIndex={lineIndex} />
			</ContextMenu.Content>
		</ContextMenu.Root>
	);
};

const LyricWorldViewEdit = ({
	wordAtom,
	wordIndex,
	line,
	lineIndex,
}: LyricWordViewEditProps) => {
	const { t } = useTranslation();
	const word = useAtomValue(wordAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setSelectedLines = useSetImmerAtom(selectedLinesAtom);
	const isWordSelectedAtom = useMemo(
		() => atom((get) => get(selectedWordsAtom).has(get(wordAtom).id)),
		[wordAtom],
	);
	const isWordSelected = useAtomValue(isWordSelectedAtom);
	const setSelectedWords = useSetImmerAtom(selectedWordsAtom);
	const [editing, setEditing] = useState(false);
	const toolMode = useAtomValue(toolModeAtom);
	const isWordBlank = useWordBlank(word.word);
	const displayWord = getDisplayWordText(t, word.word, isWordBlank);
	const showRubyEditor = useMemo(() => word.ruby !== undefined, [word.ruby]);

	const hasError = useMemo(
		() => word.startTime > word.endTime,
		[word.startTime, word.endTime],
	);

	const className = useMemo(
		() =>
			classNames(
				styles.lyricWord,
				styles.edit,
				isWordSelected && styles.selected,
				isWordBlank && styles.blank,
				showRubyEditor && styles.rubyEnabled,
				hasError && toolMode === ToolMode.Edit && styles.error,
			),
		[isWordBlank, isWordSelected, showRubyEditor, hasError, toolMode],
	);
	const onEnter = useCallback(
		(evt: SyntheticEvent<HTMLInputElement>) => {
			setEditing(false);
			const { word: parsedWord, enableRuby } = parseRubyShortcut(
				evt.currentTarget.value,
			);
			if (parsedWord !== word.word || enableRuby) {
				editLyricLines((state) => {
					const targetWord = state.lyricLines[lineIndex]?.words[wordIndex];
					if (!targetWord) return;
					targetWord.word = parsedWord;
					if (enableRuby && !targetWord.ruby) {
						targetWord.ruby = [];
					}
				});
			}
		},
		[editLyricLines, lineIndex, word.word, wordIndex],
	);

	return editing ? (
		<div className={className}>
			<span className={styles.wordEditRow}>
				<TextField.Root
					autoFocus
					defaultValue={word.word}
					onBlur={onEnter}
					onKeyDown={(evt) => {
						if (evt.key === "Enter") onEnter(evt);
					}}
				/>
				{showRubyEditor && <RubyEditor wordAtom={wordAtom} />}
			</span>
		</div>
	) : (
		<ContextMenu.Root
			onOpenChange={(open) => {
				if (!open) return;
				if (isWordSelected) return;
				setSelectedWords((state) => {
					state.clear();
					state.add(word.id);
				});
				setSelectedLines((state) => {
					state.clear();
					state.add(line.id);
				});
			}}
		>
			<ContextMenu.Trigger><LyricWordViewEditSpan
					wordAtom={wordAtom}
					wordIndex={wordIndex}
					className={className}
					line={line}
					onDoubleClick={() => {
						// Open inline editor directly (grammar actions disabled in Edit mode)
						setEditing(true);
					}}
				>
					<span className={styles.wordEditRow}>
						{displayWord}
						{showRubyEditor && <RubyEditor wordAtom={wordAtom} />}
					</span>
				</LyricWordViewEditSpan>
			</ContextMenu.Trigger>
			<ContextMenu.Content>
				<LyricWordMenu
					wordAtom={wordAtom}
					wordIndex={wordIndex}
					lineIndex={lineIndex}
				/>
				<LyricLineMenu lineIndex={lineIndex} />
			</ContextMenu.Content>
		</ContextMenu.Root>
	);
};

const LyricSyncWordView: FC<{
	syncId: string;
	line: LyricLine;
	startTime: number;
	endTime: number;
	displayWord: string;
	isWordBlank: boolean;
	wordIndex: number;
	setCorrectionDialog: (dialog: {
		open: boolean;
		wordIndex: number;
		currentWord: string;
		suggestions: string[];
	} | null) => void;
	allWordsInLyrics: Set<string>;
}> = ({
	syncId,
	line,
	startTime,
	endTime,
	displayWord,
	isWordBlank,
	wordIndex,
	setCorrectionDialog,
	allWordsInLyrics,
}) => {
	const isWordSelectedAtom = useMemo(
		() => atom((get) => get(selectedWordsAtom).has(syncId)),
		[syncId],
	);
	const isWordActiveAtom = useMemo(
		() =>
			atom((get) => {
				const currentTime = get(currentTimeAtom);
				return currentTime >= startTime && currentTime < endTime;
			}),
		[startTime, endTime],
	);
	const isWordActive = useAtomValue(isWordActiveAtom);
	const isWordSelected = useAtomValue(isWordSelectedAtom);
	const setSelectedWords = useSetImmerAtom(selectedWordsAtom);
	const setSelectedLines = useSetImmerAtom(selectedLinesAtom);
	const visualizeTimestampUpdate = useAtomValue(visualizeTimestampUpdateAtom);
	const showTimestamps = useAtomValue(showTimestampsAtom);
	const showEndTimeAsDuration = useAtomValue(showEndTimeAsDurationAtom);
	const highlightErrors = useAtomValue(highlightErrorsAtom);
	const highlightActiveWord = useAtomValue(highlightActiveWordAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const quickFixes = useAtomValue(quickFixesAtom);


	const store = useStore();
	const enableUpcomingWordHighlight = useAtomValue(
		enableUpcomingWordHighlightAtom,
	);
	const upcomingWordHighlightColor = useAtomValue(
		upcomingWordHighlightColorAtom,
	);
	const upcomingWordHighlightThreshold = useAtomValue(
		upcomingWordHighlightThresholdAtom,
	);

	const startTimeRef = useRef<HTMLDivElement>(null);
	const endTimeRef = useRef<HTMLDivElement>(null);
	const ambientHighlightRef = useRef<HTMLDivElement>(null);
	const lastClickTimeRef = useRef(0);

	// Optimized render loop for pre-playback word ambient highlighting
	useEffect(() => {
		if (!enableUpcomingWordHighlight || !ambientHighlightRef.current) return;

		const updateHighlight = () => {
			if (!ambientHighlightRef.current) return;
			const currentTime = store.get(currentTimeAtom);
			const delta = startTime - currentTime;
			const threshold = upcomingWordHighlightThreshold;

			const isBlueActive =
				ambientHighlightRef.current.parentElement?.classList.contains(
					styles.active,
				);

			// Extend the highlight window by 50ms to sync with the React blue highlight render delay
			if (
				delta > -50 &&
				!isBlueActive &&
				(threshold <= 0 || delta <= threshold)
			) {
				// Cap effective delta at 0 so opacity stays at maximum (0.75) during the 50ms delay window
				const effectiveDelta = Math.max(0, delta);
				const opacity =
					threshold > 0 ? 0.75 * (1 - effectiveDelta / threshold) : 0.75;
				ambientHighlightRef.current.style.transition = "none";
				ambientHighlightRef.current.style.opacity = opacity.toFixed(3);
				ambientHighlightRef.current.style.backgroundColor =
					upcomingWordHighlightColor;
			} else {
				ambientHighlightRef.current.style.transition = "none";
				ambientHighlightRef.current.style.opacity = "0";
			}
		};

		// Run immediately to establish initial state without waiting for playback
		updateHighlight();

		return store.sub(currentTimeAtom, updateHighlight);
	}, [
		enableUpcomingWordHighlight,
		upcomingWordHighlightColor,
		upcomingWordHighlightThreshold,
		startTime,
		store,
	]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 用于呈现时间戳更新效果
	useEffect(() => {
		if (!visualizeTimestampUpdate) return;
		const animation = startTimeRef.current?.animate(
			[
				{
					backgroundColor: "var(--ruby-a8)",
				},
				{
					backgroundColor: "var(--ruby-a4)",
				},
			],
			{
				duration: 500,
			},
		);

		return () => {
			animation?.cancel();
		};
	}, [startTime, visualizeTimestampUpdate]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 用于呈现时间戳更新效果
	useEffect(() => {
		if (!visualizeTimestampUpdate) return;
		const animation = endTimeRef.current?.animate(
			[
				{
					backgroundColor: "var(--red-a8)",
				},
				{
					backgroundColor: "var(--red-a4)",
				},
			],
			{
				duration: 500,
			},
		);

		return () => {
			animation?.cancel();
		};
	}, [endTime, visualizeTimestampUpdate]);

	const hasError = useMemo(() => startTime > endTime, [startTime, endTime]);

	const className = useMemo(
		() =>
			classNames(
				styles.lyricWord,
				styles.sync,
				isWordSelected && styles.selected,
				isWordBlank && styles.blank,
				isWordActive && highlightActiveWord && styles.active,
				hasError &&
					(toolMode === ToolMode.Edit ||
						(toolMode === ToolMode.Sync &&
							showTimestamps &&
							highlightErrors)) &&
					styles.error,
				/* highlightGrammarWarnings is visually disabled as per user request */
			),
		[
			isWordBlank,
			isWordSelected,
			isWordActive,
			hasError,
			toolMode,
			highlightActiveWord,
			showTimestamps,
			highlightErrors,
		],
	);

	return (
		<div
			className={className}
			style={{ position: "relative", zIndex: 1 }}
			onClick={(evt) => {
				const now = Date.now();
				const clickInterval = now - lastClickTimeRef.current;
				lastClickTimeRef.current = now;

				setSelectedLines((state) => {
					state.clear();
					state.add(line.id);
				});
				setSelectedWords((state) => {
					state.clear();
					state.add(syncId);
				});

				// Only trigger grammar actions if two clicks happen within 300ms (standard double click)
				if (clickInterval > 300) return;

				// Only open the dialog if Quick Fixes is enabled
				if (!quickFixes) return;

				evt.stopPropagation();
				evt.preventDefault();

				const wordText = line.words[wordIndex]?.word || "";
				const suggestions = getGrammarSuggestions(
					line,
					wordIndex,
					allWordsInLyrics,
				);

				// Always open the correction dialog on double-click in Sync mode (Time tab)
				setCorrectionDialog({
					open: true,
					wordIndex: wordIndex,
					currentWord: wordText,
					suggestions: suggestions,
				});
			}}
		>
			<div
				ref={ambientHighlightRef}
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					opacity: 0,
					zIndex: -1,
					pointerEvents: "none",
					borderRadius: "inherit",
				}}
			/>
			{showTimestamps && (
				<div className={classNames(styles.startTime)} ref={startTimeRef}>
					{msToTimestamp(startTime)}
				</div>
			)}
			<div className={styles.displayWord}>{displayWord}</div>
			{showTimestamps && (
				<div className={classNames(styles.endTime)} ref={endTimeRef}>
					{showEndTimeAsDuration
						? `+${endTime - startTime}ms`
						: msToTimestamp(endTime)}
				</div>
			)}
		</div>
	);
};

const LyricWorldViewSync: FC<{
	wordAtom: Atom<LyricWord>;
	wordIndex: number;
	line: LyricLine;
	lineIndex: number;
	setCorrectionDialog: (dialog: {
		open: boolean;
		wordIndex: number;
		currentWord: string;
		suggestions: string[];
	} | null) => void;
	allWordsInLyrics: Set<string>;
}> = ({
	wordAtom,
	line,
	wordIndex,
	setCorrectionDialog,
	allWordsInLyrics,
}) => {
	const { t } = useTranslation();
	const word = useAtomValue(wordAtom);
	const displayRomanizationInSync = useAtomValue(displayRomanizationInSyncAtom);
	const isWordBlank = useWordBlank(word.word);
	const getDisplayWord = useCallback(
		(
			displayText: string,
			isBlank: boolean,
			romanWord?: string,
			showRomanization?: boolean,
		) =>
			getDisplayWordText(t, displayText, isBlank, romanWord, showRomanization),
		[t],
	);

	if (word.ruby && word.ruby.length > 0) {
		return (
			<div className={styles.rubySyncRow}>
				{word.ruby.map((rubyWord, rubyIndex) => {
					const isRubyBlank =
						rubyWord.word.length === 0 ||
						(rubyWord.word.length > 0 && rubyWord.word.trim().length === 0);
					return (
						<LyricSyncWordView
							key={`${word.id}-ruby-${rubyIndex}`}
							syncId={buildRubySelectionId(word.id, rubyIndex)}
							line={line}
							startTime={rubyWord.startTime}
							endTime={rubyWord.endTime}
							displayWord={getDisplayWord(rubyWord.word, isRubyBlank)}
							isWordBlank={isRubyBlank}
							wordIndex={wordIndex}
							setCorrectionDialog={setCorrectionDialog}
							allWordsInLyrics={allWordsInLyrics}
						/>
					);
				})}
			</div>
		);
	}

	return (
		<LyricSyncWordView
			syncId={word.id}
			line={line}
			startTime={word.startTime}
			endTime={word.endTime}
			displayWord={getDisplayWord(
				word.word,
				isWordBlank,
				word.romanWord,
				displayRomanizationInSync,
			)}
			isWordBlank={isWordBlank}
			wordIndex={wordIndex}
			setCorrectionDialog={setCorrectionDialog}
			allWordsInLyrics={allWordsInLyrics}
		/>
	);
};

export const LyricWordView: FC<{
	wordAtom: Atom<LyricWord>;
	wordIndex: number;
	line: LyricLine;
	lineIndex: number;
}> = memo(({ wordAtom, wordIndex, line, lineIndex }) => {
	const { t } = useTranslation();
	const word = useAtomValue(wordAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const layoutMode = useAtomValue(layoutModeAtom);


	const isWordBlank = useWordBlank(word.word);
	const hasRuby = word.ruby && word.ruby.length > 0;
	const allWordsInLyrics = useAtomValue(allLyricsWordsAtom);
	const [correctionDialog, setCorrectionDialog] = useState<{
		open: boolean;
		wordIndex: number;
		currentWord: string;
		suggestions: string[];
	} | null>(null);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);

	const handleDialogClose = () => setCorrectionDialog(null);

	const handleWordUpdate = (targetWordIndex: number, newWord: string) => {
		editLyricLines((state) => {
			const targetLine = state.lyricLines[lineIndex];
			if (targetLine) {
				targetLine.words[targetWordIndex].word = newWord;
			}
		});
		setCorrectionDialog(null);
	};

	// Sub-component for suggestion buttons
	const SuggestionButton = ({
		suggestion,
		onApply,
	}: { suggestion: string; onApply: (s: string) => void }) => {
		return (
			<Button
				variant="soft"
				onClick={() => onApply(suggestion)}
			>
				{suggestion === "__REMOVE_REPEATED_WORD__"
					? t("lyricWordView.removeWord", "删除重复单词")
					: suggestion}
			</Button>
		);
	};

	return (
		<div>
			{toolMode === ToolMode.Edit && layoutMode === LayoutMode.Simple && (
				<LyricWorldViewEdit
					wordAtom={wordAtom}
					line={line}
					lineIndex={lineIndex}
					wordIndex={wordIndex}
				/>
			)}
			{toolMode === ToolMode.Edit && layoutMode === LayoutMode.Advance && (
				<LyricWordViewEditAdvance
					wordAtom={wordAtom}
					line={line}
					lineIndex={lineIndex}
					wordIndex={wordIndex}
				/>
			)}
			{toolMode === ToolMode.Sync && (hasRuby || !isWordBlank) && (
				<LyricWorldViewSync
					wordAtom={wordAtom}
					line={line}
					lineIndex={lineIndex}
					wordIndex={wordIndex}
					setCorrectionDialog={setCorrectionDialog}
					allWordsInLyrics={allWordsInLyrics}
				/>
			)}
			<Dialog.Root
				open={correctionDialog?.open || false}
				onOpenChange={handleDialogClose}
			>
				<Dialog.Content>
					<Dialog.Title>
						{t("lyricWordView.editingWordTitle", "Editing Word")}
					</Dialog.Title>
					<Dialog.Description>
						{t(
							"lyricWordView.editingWordDesc",
							"Edit the word or apply suggested quick fixes.",
						)}
					</Dialog.Description>
					<Flex direction="column" gap="3">
						<Text size="1" color="gray" mb="-2">
							Input:
						</Text>
						<TextField.Root
							value={correctionDialog?.currentWord || ""}
							onChange={(e) => {
								if (correctionDialog) {
									setCorrectionDialog({
										...correctionDialog,
										currentWord: e.target.value,
									});
								}
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter" && correctionDialog) {
									handleWordUpdate(
										correctionDialog.wordIndex,
										correctionDialog.currentWord,
									);
								}
							}}
							placeholder="Type the corrected word"
						/>
						<Flex direction="column" gap="2">
							<Text size="2" weight="bold">
								Suggestions:
							</Text>
							{correctionDialog?.suggestions &&
							correctionDialog.suggestions.length > 0 ? (
								<Grid columns="2" gap="2">
									{correctionDialog.suggestions.map((suggestion) => (
										<SuggestionButton
											key={suggestion}
											suggestion={suggestion}
											onApply={(s) =>
												handleWordUpdate(
													correctionDialog.wordIndex,
													s === "__REMOVE_REPEATED_WORD__" ? "" : s,
												)
											}
										/>
									))}
								</Grid>
							) : (
								<Text size="1" color="gray" align="center">
									{t("lyricWordView.noSuggestions", "No suggestions")}
								</Text>
							)}
						</Flex>
					</Flex>
					<Flex gap="3" mt="4" justify="end">
						<Dialog.Close>
							<Button variant="soft" color="gray">
								Cancel
							</Button>
						</Dialog.Close>
					</Flex>
				</Dialog.Content>
			</Dialog.Root>
		</div>
	);
});

export default LyricWordView;
