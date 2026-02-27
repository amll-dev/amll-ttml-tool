import { Add20Regular, TranslateRegular, Warning48Color } from "@fluentui/react-icons";
import { Button, Dialog, Flex, IconButton, Text, TextField } from "@radix-ui/themes";
import classNames from "classnames";
import { type Atom, useAtomValue, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { type ComponentPropsWithoutRef, useCallback, useRef, useState } from "react";
import { recalculateWordTime } from "$/modules/segmentation/utils/segmentation.ts";
import { useSegmentationConfig } from "$/modules/segmentation/utils/useSegmentationConfig.ts";
import { lyricLinesAtom, projectIdAtom, rubyWarningShownProjectIdsAtom } from "$/states/main.ts";
import type { LyricWord } from "$/types/ttml.ts";
import styles from "../components/index.module.css";

const AutoSizeTextField = ({
	value,
	className,
	style,
	placeholder,
	inputRef,
	...rest
}: ComponentPropsWithoutRef<typeof TextField.Root> & {
	inputRef?: React.Ref<HTMLInputElement>;
}) => {
	const valueString = value === undefined || value === null ? "" : String(value);
	const mirrorText =
		valueString.length > 0
			? valueString
			: typeof placeholder === "string" && placeholder.length > 0
				? placeholder
				: "    ";
	return (
		<span className={classNames(styles.autoSizeInput, className)} style={style}>
			<span className={styles.autoSizeInputText}>{mirrorText}</span>
			<TextField.Root
				className={styles.autoSizeInputField}
				value={value}
				placeholder={placeholder}
				ref={inputRef}
				{...rest}
			/>
		</span>
	);
};

export const RubyEditor = ({
	wordAtom,
	forceShow,
	showIcon,
	className,
}: {
	wordAtom: Atom<LyricWord>;
	forceShow?: boolean;
	showIcon?: boolean;
	className?: string;
}) => {
	const word = useAtomValue(wordAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const store = useStore();
	const rubyWords = word.ruby ?? [];
	const { config: segmentationConfig } = useSegmentationConfig();
	const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
	const [warningOpen, setWarningOpen] = useState(false);
	const projectId = useAtomValue(projectIdAtom);

	const addRubyWord = useCallback(() => {
		const shownProjectIds = store.get(rubyWarningShownProjectIdsAtom);
		if (!shownProjectIds.has(projectId)) {
			const lyricState = store.get(lyricLinesAtom);
			const hasRuby = lyricState.lyricLines.some((line) =>
				line.words.some((word) => (word.ruby?.length ?? 0) > 0),
			);
			const nextShown = new Set(shownProjectIds);
			nextShown.add(projectId);
			store.set(rubyWarningShownProjectIdsAtom, nextShown);
			if (!hasRuby) {
				setWarningOpen(true);
			}
		}
		const currentWord = store.get(wordAtom);
		const nextIndex = currentWord.ruby?.length ?? 0;
		editLyricLines((state) => {
			for (const line of state.lyricLines) {
				for (const word of line.words) {
					if (word.id !== currentWord.id) continue;
					if (!word.ruby) word.ruby = [];
					word.ruby.push({
						word: "",
						startTime: word.startTime,
						endTime: word.endTime,
					});
					break;
				}
			}
		});
		requestAnimationFrame(() => {
			inputRefs.current[nextIndex]?.focus();
		});
	}, [editLyricLines, projectId, store, wordAtom]);

	const updateRubyWord = useCallback(
		(index: number, value: string) => {
			const currentWord = store.get(wordAtom);
			editLyricLines((state) => {
				for (const line of state.lyricLines) {
					for (const word of line.words) {
						if (word.id !== currentWord.id) continue;
						if (!word.ruby || !word.ruby[index]) return;
						word.ruby[index].word = value;
						break;
					}
				}
			});
		},
		[editLyricLines, store, wordAtom],
	);

	const removeRubyWord = useCallback(
		(index: number) => {
			const currentWord = store.get(wordAtom);
			editLyricLines((state) => {
				for (const line of state.lyricLines) {
					for (const word of line.words) {
						if (word.id !== currentWord.id) continue;
						if (!word.ruby || !word.ruby[index]) return;
						word.ruby.splice(index, 1);
						break;
					}
				}
			});
		},
		[editLyricLines, store, wordAtom],
	);

	const mergeRubyWithPrevious = useCallback(
		(index: number) => {
			const currentWord = store.get(wordAtom);
			const prevText = currentWord.ruby?.[index - 1]?.word ?? "";
			const currentText = currentWord.ruby?.[index]?.word ?? "";
			const mergedText = `${prevText}${currentText}`;

			editLyricLines((state) => {
				for (const line of state.lyricLines) {
					for (const word of line.words) {
						if (word.id !== currentWord.id) continue;
						if (!word.ruby || !word.ruby[index] || !word.ruby[index - 1])
							return;
						const prevRuby = word.ruby[index - 1];
						const currentRuby = word.ruby[index];
						prevRuby.word = mergedText;
						prevRuby.startTime = Math.min(
							prevRuby.startTime,
							currentRuby.startTime,
						);
						prevRuby.endTime = Math.max(
							prevRuby.endTime,
							currentRuby.endTime,
						);
						word.ruby.splice(index, 1);
						break;
					}
				}
			});

			requestAnimationFrame(() => {
				const target = inputRefs.current[index - 1];
				if (target) {
					target.focus();
					target.setSelectionRange(mergedText.length, mergedText.length);
				}
			});
		},
		[editLyricLines, store, wordAtom],
	);

	const applyRubyToAllSameWords = useCallback(() => {
		const currentWord = store.get(wordAtom);
		const rubySegments = currentWord.ruby?.map((ruby) => ruby.word) ?? [];
		if (rubySegments.length === 0) return;

		editLyricLines((state) => {
			for (const line of state.lyricLines) {
				for (const word of line.words) {
					if (word.word !== currentWord.word) continue;
					const recalculated = recalculateWordTime(
						word,
						rubySegments,
						segmentationConfig,
					);
					word.ruby = recalculated.map((segment) => ({
						word: segment.word,
						startTime: segment.startTime,
						endTime: segment.endTime,
					}));
				}
			}
		});
	}, [editLyricLines, segmentationConfig, store, wordAtom]);

	if (!forceShow && word.ruby === undefined) return null;

	return (
		<>
			<Dialog.Root open={warningOpen} onOpenChange={setWarningOpen}>
				<Dialog.Content
					style={{
						position: "fixed",
						inset: 0,
						width: "100vw",
						height: "100vh",
						maxWidth: "100vw",
						maxHeight: "100vh",
						borderRadius: 0,
						padding: 0,
						background: "transparent",
					}}
				>
					<Flex
						direction="column"
						align="center"
						justify="center"
						height="100%"
						style={{
							backdropFilter: "blur(10px)",
							background: "rgba(0, 0, 0, 0.35)",
							padding: "var(--space-6)",
						}}
					>
						<Flex
							direction="column"
							align="center"
							justify="center"
							gap="4"
							style={{
								background: "var(--color-panel)",
								borderRadius: "var(--radius-4)",
								padding: "var(--space-6)",
								maxWidth: "720px",
								width: "min(90vw, 720px)",
								boxShadow: "0 24px 48px rgba(0, 0, 0, 0.2)",
							}}
						>
							<Warning48Color />
							<Text size="5">
								你正在使用测试中的
								<Text as="span" weight="bold">
									{" "}
									注音
									{" "}
								</Text>
								功能
							</Text>
							<Text size="4" align="center">
								一旦你添加了注音内容，保存的文件将无法被不支持该结构的解析器使用
							</Text>
							<Text size="4" align="center">
								如果仍要在不支持的解析器中使用，可能会出现缺少文字等现象
							</Text>
							<Dialog.Close>
								<Button>我已了解</Button>
							</Dialog.Close>
						</Flex>
					</Flex>
				</Dialog.Content>
			</Dialog.Root>
			<span className={classNames(styles.rubyEditor, className)}>
			{showIcon && (
				<IconButton
					size="1"
					variant="soft"
					onClick={applyRubyToAllSameWords}
				>
					<TranslateRegular />
				</IconButton>
			)}
			{rubyWords.map((rubyWord, index) => (
				<AutoSizeTextField
					key={`${word.id}-ruby-${index}`}
					size="1"
					inputRef={(el) => {
						inputRefs.current[index] = el;
					}}
					value={rubyWord.word}
					onChange={(evt) => updateRubyWord(index, evt.currentTarget.value)}
					onKeyDown={(evt) => {
						if (evt.key !== "Backspace") return;
						const selectionStart = evt.currentTarget.selectionStart ?? 0;
						const selectionEnd = evt.currentTarget.selectionEnd ?? 0;
						const isAtStart = selectionStart === 0 && selectionEnd === 0;
						if (isAtStart && index > 0) {
							evt.preventDefault();
							mergeRubyWithPrevious(index);
							return;
						}
						if (evt.currentTarget.value !== "") return;
						evt.preventDefault();
						removeRubyWord(index);
						if (index > 0) {
							requestAnimationFrame(() => {
								inputRefs.current[index - 1]?.focus();
							});
						}
					}}
				/>
			))}
			<IconButton size="1" variant="soft" onClick={addRubyWord}>
				<Add20Regular />
			</IconButton>
			</span>
		</>
	);
};
