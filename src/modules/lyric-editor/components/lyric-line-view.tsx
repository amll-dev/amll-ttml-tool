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

import {
	AddFilled,
	LinkMultiple20Regular,
	TextAlignRightFilled,
	VideoBackgroundEffectFilled,
} from "@fluentui/react-icons";
import {
	Button,
	ContextMenu,
	Flex,
	IconButton,
	Text,
	TextField,
} from "@radix-ui/themes";
import classNames from "classnames";
import { type Atom, atom, useAtomValue, useStore } from "jotai";
import { splitAtom } from "jotai/utils";
import { useSetImmerAtom } from "jotai-immer";
import {
	type FC,
	Fragment,
	memo,
	type SyntheticEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { predictLineRomanization } from "$/modules/segmentation/utils/Transliteration/distributor";
import {
	enableAutoRomanizationPredictionAtom,
	showLineRomanizationAtom,
	showLineTranslationAtom,
	showTimestampsAtom,
	showWordRomanizationInputAtom,
} from "$/modules/settings/states/index.ts";
import { visualizeTimestampUpdateAtom } from "$/modules/settings/states/sync.ts";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main.ts";
import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml.ts";
import { msToTimestamp } from "$/utils/timestamp.ts";
import styles from "./index.module.css";
import { LyricLineMenu } from "./lyric-line-menu.tsx";
import { draggingIdAtom } from "./lyric-line-view-states.ts";
import LyricWordView from "./lyric-word-view.tsx";
import { RomanWordView } from "./roman-word-view.tsx";

const isDraggingAtom = atom(false);

// 定义一个派生 Atom，用于计算每一行的显示行号
const lineDisplayNumbersAtom = atom((get) => {
	const { lyricLines } = get(lyricLinesAtom);
	const displayNumbers: number[] = [];
	let currentNumber = 0;

	for (const [index, line] of lyricLines.entries()) {
		// 核心逻辑：只有当不是背景行时，计数器才+1
		// 这样背景行就会自动继承上一行的行号
		// 特例：首行从 1 开始
		if (!index || !line.isBG) {
			currentNumber++;
		}
		displayNumbers.push(currentNumber);
	}

	return displayNumbers;
});

const LyricLineScroller = ({
	lineAtom,
	wordsContainer,
	editingRomanWordIndex,
}: {
	lineAtom: Atom<LyricLine>;
	wordsContainer: HTMLDivElement | null;
	editingRomanWordIndex: number | null;
}) => {
	const scrollToIndexAtom = useMemo(
		() =>
			atom((get) => {
				const line = get(lineAtom);
				const selectedWords = get(selectedWordsAtom);
				if (selectedWords.size === 0) return Number.NaN;
				let scrollToIndex = Number.NaN;
				let i = 0;
				for (const word of line.words) {
					if (selectedWords.has(word.id)) {
						scrollToIndex = i;
						break;
					}
					i++;
				}
				return scrollToIndex;
			}),
		[lineAtom],
	);
	const scrollToIndex = useAtomValue(scrollToIndexAtom);

	useEffect(() => {
		const targetIndex =
			!Number.isNaN(scrollToIndex) ? scrollToIndex : editingRomanWordIndex;
		if (targetIndex === null || Number.isNaN(targetIndex)) return;
		// console.log({ scrollToIndex, wordsContainer });
		if (!wordsContainer) return;
		const wordEl = wordsContainer.children[targetIndex] as HTMLElement;
		// console.log({ wordEl, wordsContainer });
		if (!wordEl) return;
		wordsContainer.scrollTo({
			left: wordEl.offsetLeft - wordsContainer.clientWidth / 2,
			behavior: "auto",
		});
	}, [scrollToIndex, editingRomanWordIndex, wordsContainer]);

	useEffect(() => {
		if (!wordsContainer) return;
		const handleFocusIn = (evt: FocusEvent) => {
			const target = evt.target as HTMLElement | null;
			if (!target) return;
			const wordGroup = target.closest<HTMLElement>("[data-word-index]");
			if (!wordGroup || !wordsContainer.contains(wordGroup)) return;
			wordsContainer.scrollTo({
				left: wordGroup.offsetLeft - wordsContainer.clientWidth / 2,
				behavior: "auto",
			});
		};
		wordsContainer.addEventListener("focusin", handleFocusIn);
		return () => {
			wordsContainer.removeEventListener("focusin", handleFocusIn);
		};
	}, [wordsContainer]);

	return null;
};

const SubLineEdit = memo(
	({
		lineAtom,
		lineIndex,
		type,
	}: {
		lineAtom: Atom<LyricLine>;
		lineIndex: number;
		type: "translatedLyric" | "romanLyric";
	}) => {
		const editLyricLines = useSetImmerAtom(lyricLinesAtom);
		const line = useAtomValue(lineAtom);
		const [editing, setEditing] = useState(false);
		const [inputValue, setInputValue] = useState("");
		const { t } = useTranslation();

		const onEnter = useCallback(
			(evt: SyntheticEvent<HTMLInputElement>) => {
				setEditing(false);
				const newValue = evt.currentTarget.value;
				if (newValue !== line[type]) {
					editLyricLines((state) => {
						state.lyricLines[lineIndex][type] = newValue;
					});
				}
			},
			[editLyricLines, line, lineIndex, type],
		);

		useEffect(() => {
			if (editing) {
				setInputValue(line[type] || "");
			}
		}, [editing, line, type]);

		const inputWidth = useMemo(() => {
			if (inputValue.length > 0) {
				return `${Math.min(Math.max(inputValue.length, 2), 60)}ch`;
			}
			return "12ch";
		}, [inputValue]);

		const label = useMemo(
			() =>
				type === "translatedLyric"
					? t("lyricLineView.translatedLabel", "翻译：")
					: t("lyricLineView.romanLabel", "音译："),
			[type, t],
		);

		return (
			<Flex align="baseline">
				<Text size="2">{label}</Text>
				{editing ? (
					<TextField.Root
						autoFocus
						size="1"
						value={inputValue}
						style={{ width: inputWidth }}
						onChange={(evt) => setInputValue(evt.currentTarget.value)}
						onBlur={onEnter}
						onKeyDown={(evt) => {
							if (evt.key === "Enter") onEnter(evt);
						}}
					/>
				) : (
					<Button
						size="2"
						color="gray"
						variant="ghost"
						onClick={(evt) => {
							evt.stopPropagation();
							setEditing(true);
						}}
					>
						{line[type] || (
							<Text color="gray">{t("lyricLineView.empty", "无")}</Text>
						)}
					</Button>
				)}
			</Flex>
		);
	},
);

export const LyricLineView: FC<{
	lineAtom: Atom<LyricLine>;
	lineIndex: number;
}> = memo(({ lineAtom, lineIndex }) => {
	const { t } = useTranslation();
	const line = useAtomValue(lineAtom);
	const setSelectedLines = useSetImmerAtom(selectedLinesAtom);
	const lineSelectedAtom = useMemo(() => {
		const a = atom((get) => get(selectedLinesAtom).has(line.id));
		if (import.meta.env.DEV) {
			a.debugLabel = `lineSelectedAtom-${line.id}`;
		}
		return a;
	}, [line.id]);
	const wordsAtom = useMemo(
		() => splitAtom(atom((get) => get(lineAtom).words)),
		[lineAtom],
	);
	const words = useAtomValue(wordsAtom);
	const lineSelected = useAtomValue(lineSelectedAtom);
	const setSelectedWords = useSetImmerAtom(selectedWordsAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const visualizeTimestampUpdate = useAtomValue(visualizeTimestampUpdateAtom);
	const showTimestamps = useAtomValue(showTimestampsAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const store = useStore();
	const wordsContainerRef = useRef<HTMLDivElement>(null);
	const blockDragRef = useRef(false);

	// 创建一个仅订阅当前行显示行号的 atom，优化性能
	const displayNumberAtom = useMemo(
		() => atom((get) => get(lineDisplayNumbersAtom)[lineIndex]),
		[lineIndex],
	);
	const displayNumber = useAtomValue(displayNumberAtom);

	const hasError = useMemo(() => {
		if (line.startTime > line.endTime) {
			return true;
		}
		for (const word of line.words) {
			if (word.startTime > word.endTime) {
				return true;
			}
		}
		return false;
	}, [line.startTime, line.endTime, line.words]);

	const showWordRomanizationInput = useAtomValue(showWordRomanizationInputAtom);
	const showTranslation = useAtomValue(showLineTranslationAtom);
	const showRomanization = useAtomValue(showLineRomanizationAtom);
	const editingRomanWordIndexAtom = useMemo(
		() => atom<number | null>(null),
		[],
	);
	const editingRomanWordIndex = useAtomValue(editingRomanWordIndexAtom);
	const enablePrediction = useAtomValue(enableAutoRomanizationPredictionAtom);

	const startTimeRef = useRef<HTMLDivElement>(null);
	const endTimeRef = useRef<HTMLButtonElement>(null);
	const [enableInsert, setEnableInsert] = useState(false);
	const [endTimeLinked, setEndTimeLinked] = useState(() =>
		Boolean(line.endTimeLink),
	);
	const originalEndTimeRef = useRef<number | null>(null);
	const originalNextStartTimeRef = useRef<number | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 用于呈现时间戳更新效果
	useEffect(() => {
		if (!visualizeTimestampUpdate) return;
		const animation = startTimeRef.current?.animate(
			[
				{
					backgroundColor: "var(--green-a8)",
				},
				{
					backgroundColor: "var(--green-a4)",
				},
			],
			{
				duration: 500,
			},
		);

		return () => {
			animation?.cancel();
		};
	}, [line.startTime, visualizeTimestampUpdate]);

	useLayoutEffect(() => {
		if (toolMode !== ToolMode.Edit) {
			setEnableInsert(false);
		}
	}, [toolMode]);

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
	}, [line.endTime, visualizeTimestampUpdate]);

	useEffect(() => {
		if (!endTimeLinked) return;
		const nextLine = lyricLines.lyricLines[lineIndex + 1];
		if (!nextLine) {
			editLyricLines((state) => {
				const targetLine = state.lyricLines[lineIndex];
				if (!targetLine) return;
				if (targetLine.endTimeLink) delete targetLine.endTimeLink;
			});
			return;
		}
		if (nextLine.startTime === line.endTime) return;
		editLyricLines((state) => {
			const targetLine = state.lyricLines[lineIndex + 1];
			if (!targetLine) return;
			targetLine.startTime = line.endTime;
		});
	}, [endTimeLinked, editLyricLines, line.endTime, lineIndex, lyricLines]);
	useEffect(() => {
		const linked = Boolean(line.endTimeLink);
		if (linked === endTimeLinked) return;
		setEndTimeLinked(linked);
	}, [endTimeLinked, line.endTimeLink]);

	const suggestedRomans = useMemo(() => {
		if (!enablePrediction) {
			return [];
		}

		return predictLineRomanization(line.words, line.romanLyric || "");
	}, [line.romanLyric, line.words, enablePrediction]);

	const onToggleEndTimeLink = useCallback(
		(evt: React.MouseEvent<HTMLButtonElement>) => {
			evt.preventDefault();
			evt.stopPropagation();
			if (endTimeLinked) {
				setEndTimeLinked(false);
				originalEndTimeRef.current = null;
				originalNextStartTimeRef.current = null;
				editLyricLines((state) => {
					const targetLine = state.lyricLines[lineIndex];
					if (!targetLine) return;
					const linkInfo = targetLine.endTimeLink;
					if (!linkInfo) return;
					if (
						typeof linkInfo.originalEndTime !== "number" ||
						!Number.isFinite(linkInfo.originalEndTime)
					) {
						delete targetLine.endTimeLink;
						return;
					}
					targetLine.endTime = linkInfo.originalEndTime;
					const nextTarget = state.lyricLines[lineIndex + 1];
					if (
						nextTarget &&
						Number.isFinite(linkInfo.originalNextStartTime ?? Number.NaN)
					) {
						nextTarget.startTime =
							linkInfo.originalNextStartTime ?? nextTarget.startTime;
					}
					delete targetLine.endTimeLink;
				});
				return;
			}
			if (!nextLine) return;
			originalEndTimeRef.current = line.endTime;
			originalNextStartTimeRef.current = nextLine?.startTime ?? null;
			editLyricLines((state) => {
				const targetLine = state.lyricLines[lineIndex];
				if (!targetLine) return;
				const nextTarget = state.lyricLines[lineIndex + 1];
				if (!nextTarget) return;
				const originalEndTime =
					targetLine.endTimeLink?.originalEndTime ?? targetLine.endTime;
				const originalNextStartTime =
					targetLine.endTimeLink?.originalNextStartTime ??
					nextTarget.startTime ??
					null;
				const desiredEndTime = nextTarget.startTime ?? targetLine.endTime;
				targetLine.endTimeLink = {
					originalEndTime,
					originalNextStartTime,
				};
				targetLine.endTime = desiredEndTime;
				nextTarget.startTime = desiredEndTime;
			});
			setEndTimeLinked(true);
		},
		[
			editLyricLines,
			endTimeLinked,
			lineIndex,
		],
	);

	return (
		<>
			<LyricLineScroller
				lineAtom={lineAtom}
				wordsContainer={wordsContainerRef.current}
				editingRomanWordIndex={editingRomanWordIndex}
			/>
			{enableInsert && (
				<Button
					mx="2"
					my="1"
					variant="soft"
					size="1"
					style={{
						width: "calc(100% - var(--space-4))",
					}}
					onClick={() => {
						editLyricLines((state) => {
							state.lyricLines.splice(lineIndex, 0, newLyricLine());
						});
						// setInsertMode(InsertMode.None);
						setEnableInsert(false);
					}}
				>
					{t("lyricLineView.insertLine", "在此插入新行")}
				</Button>
			)}
			<ContextMenu.Root
				onOpenChange={(opened) => {
					if (opened) {
						if (!store.get(selectedLinesAtom).has(line.id)) {
							store.set(selectedLinesAtom, new Set([line.id]));
						}
					}
				}}
			>
				<ContextMenu.Trigger disabled={toolMode !== ToolMode.Edit}>
					<Flex
						mx="2"
						my="1"
						direction="row"
						className={classNames(
							styles.lyricLine,
							lineSelected && styles.selected,
							toolMode === ToolMode.Sync && styles.sync,
							toolMode === ToolMode.Edit && styles.edit,
							line.ignoreSync && styles.ignoreSync,
							hasError && toolMode === ToolMode.Edit && styles.error,
						)}
						align="center"
						gapX="4"
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
							evt.dataTransfer.dropEffect = "move";
							store.set(isDraggingAtom, true);
							store.set(draggingIdAtom, line.id);
						}}
						onDragEnd={() => {
							store.set(isDraggingAtom, false);
						}}
						onDragOver={(evt) => {
							if (!store.get(isDraggingAtom)) return;
							if (store.get(draggingIdAtom) === line.id) return;
							if (lineSelected) return;
							evt.preventDefault();
							evt.dataTransfer.dropEffect = "move";
							const rect = evt.currentTarget.getBoundingClientRect();
							const innerY = evt.clientY - rect.top;
							if (innerY < rect.height / 2) {
								evt.currentTarget.classList.add(styles.dropTop);
								evt.currentTarget.classList.remove(styles.dropBottom);
							} else {
								evt.currentTarget.classList.remove(styles.dropTop);
								evt.currentTarget.classList.add(styles.dropBottom);
							}
						}}
						onDrop={(evt) => {
							evt.currentTarget.classList.remove(styles.dropTop);
							evt.currentTarget.classList.remove(styles.dropBottom);
							if (!store.get(isDraggingAtom)) return;
							const rect = evt.currentTarget.getBoundingClientRect();
							const innerY = evt.clientY - rect.top;
							const selectedLines = store.get(selectedLinesAtom);
							const selectedLineIds = selectedLines.has(
								store.get(draggingIdAtom),
							)
								? selectedLines
								: new Set([store.get(draggingIdAtom)]);
							const indexDelta = innerY >= rect.height / 2 ? 1 : 0;
							editLyricLines((state) => {
								const filteredLines = state.lyricLines.filter(
									(l) => !selectedLineIds.has(l.id),
								);
								const targetLines = state.lyricLines.filter((l) =>
									selectedLineIds.has(l.id),
								);
								const targetIndex = filteredLines.findIndex(
									(l) => l.id === line.id,
								);
								if (targetIndex < 0) return;
								state.lyricLines = [
									...filteredLines.slice(0, targetIndex + indexDelta),
									...targetLines,
									...filteredLines.slice(targetIndex + indexDelta),
								];
							});
						}}
						onDragLeave={(evt) => {
							evt.currentTarget.classList.remove(styles.dropTop);
							evt.currentTarget.classList.remove(styles.dropBottom);
						}}
						onClick={(evt) => {
							evt.stopPropagation();
							evt.preventDefault();
							if (evt.ctrlKey) {
								setSelectedLines((v) => {
									if (v.has(line.id)) {
										v.delete(line.id);
									} else {
										v.add(line.id);
									}
								});
							} else if (evt.shiftKey) {
								setSelectedLines((v) => {
									if (v.size > 0) {
										let minBoundry = Number.NaN;
										let maxBoundry = Number.NaN;
										const lyricLines = store.get(lyricLinesAtom).lyricLines;
										lyricLines.forEach((line, i) => {
											if (v.has(line.id)) {
												if (Number.isNaN(minBoundry)) minBoundry = i;
												if (Number.isNaN(maxBoundry)) maxBoundry = i;

												minBoundry = Math.min(minBoundry, i, lineIndex);
												maxBoundry = Math.max(maxBoundry, i, lineIndex);
											}
										});
										for (let i = minBoundry; i <= maxBoundry; i++) {
											v.add(lyricLines[i].id);
										}
									} else {
										v.add(line.id);
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
									if (state.size !== 0) {
										state.clear();
									}
								});
							}
						}}
						asChild
					>
						<div>
							<Flex direction="column" align="center" justify="center" ml="3">
								<Text
									className={classNames(
										styles.lineNumber,
										line.ignoreSync && styles.ignored,
									)}
									align="center"
									color="gray"
								>
									{displayNumber}
								</Text>
								{line.isBG && <VideoBackgroundEffectFilled color="#4466FF" />}
								{line.isDuet && <TextAlignRightFilled color="#44AA33" />}
							</Flex>
							<div
								className={classNames(
									styles.lyricLineContainer,
									toolMode === ToolMode.Edit && styles.edit,
									toolMode === ToolMode.Sync && styles.sync,
								)}
							>
								<div
									className={classNames(
										styles.lyricWordsContainer,
										toolMode === ToolMode.Edit && styles.edit,
										toolMode === ToolMode.Sync && styles.sync,
										!showTimestamps && styles.hideTimestamps,
									)}
									ref={wordsContainerRef}
								>
									{words.map((wordAtom, wi) => {
										const word = store.get(wordAtom);
										return (
											<Fragment key={`word-${word.id}`}>
												{enableInsert && (
													<IconButton
														size="1"
														variant="soft"
														onClick={(evt) => {
															evt.preventDefault();
															evt.stopPropagation();
															editLyricLines((state) => {
																state.lyricLines[lineIndex].words.splice(
																	wi,
																	0,
																	newLyricWord(),
																);
															});
														}}
													>
														<AddFilled />
													</IconButton>
												)}
												<Flex
													direction="column"
													align="stretch"
													gap="3"
													data-word-index={wi}
													className={styles.wordGroup}
												>
													<LyricWordView
														wordAtom={wordAtom}
														wordIndex={wi}
														line={line}
														lineIndex={lineIndex}
													/>
													{toolMode === ToolMode.Edit &&
														showWordRomanizationInput && (
															<RomanWordView
																wordAtom={wordAtom}
																wordIndex={wi}
																editingIndexAtom={editingRomanWordIndexAtom}
																suggestedRoman={suggestedRomans[wi]}
															/>
														)}
												</Flex>
											</Fragment>
										);
									})}
									{enableInsert && (
										<IconButton
											size="1"
											variant="soft"
											onClick={(evt) => {
												evt.preventDefault();
												evt.stopPropagation();
												editLyricLines((state) => {
													state.lyricLines[lineIndex].words.push(
														newLyricWord(),
													);
												});
											}}
										>
											<AddFilled />
										</IconButton>
									)}
									{toolMode === ToolMode.Edit && (
										<TextField.Root
											placeholder={t("lyricLineView.insertWord", "插入单词…")}
											className={classNames(
												styles.insertWordField,
												words.length === 0 && styles.empty,
											)}
											style={{
												alignSelf: "center",
											}}
											onKeyDown={(evt) => {
												if (evt.key === "Enter") {
													evt.preventDefault();
													evt.stopPropagation();
													editLyricLines((state) => {
														state.lyricLines[lineIndex].words.push({
															...newLyricWord(),
															word: evt.currentTarget.value,
														});
													});
													evt.currentTarget.value = "";
												}
											}}
										/>
									)}
								</div>
								{toolMode === ToolMode.Edit && (
									<>
										{showTranslation && (
											<SubLineEdit
												lineAtom={lineAtom}
												lineIndex={lineIndex}
												type="translatedLyric"
											/>
										)}
										{showRomanization && (
											<SubLineEdit
												lineAtom={lineAtom}
												lineIndex={lineIndex}
												type="romanLyric"
											/>
										)}
									</>
								)}
							</div>
							{toolMode === ToolMode.Edit && (
								<Flex p="3">
									<IconButton
										size="1"
										variant={enableInsert ? "solid" : "soft"}
										onClick={(evt) => {
											evt.preventDefault();
											evt.stopPropagation();
											setEnableInsert((v) => !v);
										}}
									>
										<AddFilled />
									</IconButton>
								</Flex>
							)}
							{toolMode === ToolMode.Sync && showTimestamps && (
								<Flex pr="3" gap="1" direction="column" align="stretch">
									<div className={styles.startTime} ref={startTimeRef}>
										{msToTimestamp(line.startTime)}
									</div>
									<button
										type="button"
										className={classNames(styles.endTime, styles.endTimeButton)}
										ref={endTimeRef}
										onClick={onToggleEndTimeLink}
									>
										{endTimeLinked ? (
											<LinkMultiple20Regular />
										) : (
											msToTimestamp(line.endTime)
										)}
									</button>
								</Flex>
							)}
						</div>
					</Flex>
				</ContextMenu.Trigger>
				<ContextMenu.Content>
					<LyricLineMenu lineIndex={lineIndex} />
				</ContextMenu.Content>
			</ContextMenu.Root>
			{enableInsert && (
				<Button
					mx="2"
					my="1"
					variant="soft"
					size="1"
					style={{
						width: "calc(100% - var(--space-4))",
					}}
					onClick={() => {
						editLyricLines((state) => {
							state.lyricLines.splice(lineIndex + 1, 0, newLyricLine());
						});
						// setInsertMode(InsertMode.None);
						setEnableInsert(false);
					}}
				>
					{t("lyricLineView.insertLine", "在此插入新行")}
				</Button>
			)}
		</>
	);
});
