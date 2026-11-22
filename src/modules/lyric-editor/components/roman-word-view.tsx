import { Button, TextField } from "@radix-ui/themes";
import classNames from "classnames";
import { type Atom, useAtom, useAtomValue, type WritableAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { lyricLinesAtom } from "$/states/main";
import type { LyricWord } from "$/types/ttml";
import { handleTabNavigation } from "../utils/tab-navigation.ts";
import styles from "./roman-word-view.module.css";

interface RomanWordViewProps {
	wordAtom: Atom<LyricWord>;
	wordIndex: number;
	editingIndexAtom: WritableAtom<number | null, [number | null], void>;
	suggestedRoman?: string;
}

export const RomanWordView = ({
	wordAtom,
	wordIndex,
	editingIndexAtom,
	suggestedRoman,
}: RomanWordViewProps) => {
	const word = useAtomValue(wordAtom);
	const [editingIndex, setEditingIndex] = useAtom(editingIndexAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const [inputValue, setInputValue] = useState(word.romanWord);
	const inputRef = useRef<HTMLInputElement>(null);

	const isEditing = editingIndex === wordIndex;

	const saveAndStopEditing = useCallback(
		(newValue: string) => {
			if (newValue !== word.romanWord) {
				editLyricLines((draft) => {
					for (const line of draft.lyricLines) {
						const targetWord = line.words.find((w) => w.id === word.id);
						if (targetWord) {
							targetWord.romanWord = newValue;
							break;
						}
					}
				});
			}
			setEditingIndex(null);
		},
		[word.id, word.romanWord, editLyricLines, setEditingIndex],
	);

	useEffect(() => {
		if (isEditing) {
			setInputValue(word.romanWord || suggestedRoman || "");
		}
	}, [isEditing, word.romanWord, suggestedRoman]);

	useEffect(() => {
		if (isEditing) {
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [isEditing]);

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		const value = e.currentTarget.value;
		switch (e.key) {
			case "Enter":
				e.preventDefault();
				saveAndStopEditing(value);
				break;
			case "Escape":
				e.preventDefault();
				setEditingIndex(null);
				break;
			case "Tab":
				handleTabNavigation(e, "word-roman");
				break;
			case "Backspace":
				if (value === "") {
					e.preventDefault();
					saveAndStopEditing("");
					setEditingIndex(wordIndex - 1);
				}
				break;
			default:
				break;
		}
	};

	if (isEditing) {
		return (
			<TextField.Root
				ref={inputRef}
				size="1"
				className={classNames(
					styles.romanWordView,
					word.romanWarning && styles.warning,
				)}
				data-tab-group="word-roman"
				data-tab-key={word.id}
				value={inputValue}
				onChange={(e) => setInputValue(e.currentTarget.value)}
				onBlur={(e) => saveAndStopEditing(e.currentTarget.value)}
				onKeyDown={handleKeyDown}
			/>
		);
	}

	return (
		<Button
			size="1"
			variant="soft"
			color="gray"
			className={classNames(
				styles.romanWordView,
				!word.romanWord && styles.placeholder,
				word.romanWarning && styles.warning,
			)}
			data-tab-group="word-roman"
			data-tab-key={word.id}
			data-tab-activate="click"
			onKeyDown={(e) => handleTabNavigation(e, "word-roman")}
			onClick={(e) => {
				e.stopPropagation();
				setEditingIndex(wordIndex);
			}}
		>
			{word.romanWord || ""}
		</Button>
	);
};
