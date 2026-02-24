import { Add20Regular, TranslateRegular } from "@fluentui/react-icons";
import { IconButton, TextField } from "@radix-ui/themes";
import classNames from "classnames";
import { type Atom, useAtomValue, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { type ComponentPropsWithoutRef, useCallback, useRef } from "react";
import {
	recalculateWordTime,
	segmentWord,
} from "$/modules/segmentation/utils/segmentation.ts";
import { useSegmentationConfig } from "$/modules/segmentation/utils/useSegmentationConfig.ts";
import { lyricLinesAtom } from "$/states/main.ts";
import {
	type LyricWord,
	type LyricWordBase,
	newLyricWord,
} from "$/types/ttml.ts";
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

	const addRubyWord = useCallback(() => {
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
	}, [editLyricLines, store, wordAtom]);

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

	const buildRubySegments = useCallback(
		(text: string, baseWord: LyricWordBase) => {
			const sourceWord: LyricWord = {
				...newLyricWord(),
				word: text,
				startTime: baseWord.startTime,
				endTime: baseWord.endTime,
				emptyBeat: 0,
			};
			const segments = segmentWord(sourceWord, segmentationConfig);
			if (segments.length === 0) {
				return [
					{
						word: text,
						startTime: baseWord.startTime,
						endTime: baseWord.endTime,
					},
				];
			}
			return segments.map((segment) => ({
				word: segment.word,
				startTime: segment.startTime,
				endTime: segment.endTime,
			}));
		},
		[segmentationConfig],
	);

	const applyRubyInput = useCallback(
		(index: number, rawValue: string) => {
			const parts = rawValue.split("|");
			const currentWord = store.get(wordAtom);
			editLyricLines((state) => {
				for (const line of state.lyricLines) {
					for (const word of line.words) {
						if (word.id !== currentWord.id) continue;
						if (!word.ruby || !word.ruby[index]) return;
						const baseRuby = word.ruby[index];
						const nextSegments = buildRubySegments(
							parts[0] ?? "",
							baseRuby,
						);
						const fallbackBase = {
							word: "",
							startTime: word.startTime,
							endTime: word.endTime,
						};
						const extraSegments = parts
							.slice(1)
							.flatMap((part) => buildRubySegments(part, fallbackBase));
						word.ruby.splice(index, 1, ...nextSegments, ...extraSegments);
						break;
					}
				}
			});
		},
		[buildRubySegments, editLyricLines, store, wordAtom],
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

	const ignoreBlurRef = useRef(false);

	if (!forceShow && rubyWords.length === 0) return null;

	return (
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
						if (evt.key === "Enter") {
							evt.preventDefault();
							ignoreBlurRef.current = true;
							applyRubyInput(index, evt.currentTarget.value);
							return;
						}
						if (evt.key !== "Backspace") return;
						if (evt.currentTarget.value !== "") return;
						evt.preventDefault();
						removeRubyWord(index);
						if (index > 0) {
							requestAnimationFrame(() => {
								inputRefs.current[index - 1]?.focus();
							});
						}
					}}
					onBlur={(evt) => {
						if (ignoreBlurRef.current) {
							ignoreBlurRef.current = false;
							return;
						}
						applyRubyInput(index, evt.currentTarget.value);
					}}
				/>
			))}
			<IconButton size="1" variant="soft" onClick={addRubyWord}>
				<Add20Regular />
			</IconButton>
		</span>
	);
};
