import {
	Button,
	Checkbox,
	Dialog,
	Flex,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { replaceWordDialogAtom } from "$/states/dialogs";
import { editingWordStateAtom, lyricLinesAtom } from "$/states/main";

export const ReplaceWordDialog = memo(() => {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useAtom(replaceWordDialogAtom);
	const editingState = useAtomValue(editingWordStateAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);

	const [replacementText, setReplacementText] = useState("");
	const [applyToAll, setApplyToAll] = useState(false);
	const [ignoreCase, setIgnoreCase] = useState(true);

	useEffect(() => {
		if (isOpen) {
			setReplacementText(editingState.word);
			setApplyToAll(false);
			setIgnoreCase(true);
		}
	}, [isOpen, editingState.word]);

	const handleConfirm = () => {
		const targetWord = editingState.word;
		const newWord = replacementText;

		if (targetWord === newWord) {
			setIsOpen(false);
			return;
		}

		editLyricLines((state) => {
			if (applyToAll) {
				const targetLower = targetWord.toLowerCase();
				for (const line of state.lyricLines) {
					for (const word of line.words) {
						const isMatch = ignoreCase
							? word.word.toLowerCase() === targetLower
							: word.word === targetWord;

						if (isMatch) {
							word.word = newWord;
						}
					}
				}
			} else {
				const line = state.lyricLines[editingState.lineIndex];
				if (line) {
					const word = line.words[editingState.wordIndex];
					if (word && word.word === targetWord) {
						word.word = newWord;
					}
				}
			}
		});
		setIsOpen(false);
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content maxWidth="400px">
				<Dialog.Title>{t("replaceWordDialog.title", "替换单词")}</Dialog.Title>
				<Dialog.Description size="2" mb="4">
					{t("replaceWordDialog.description", "新的单词内容:")}
				</Dialog.Description>

				<Flex direction="column" gap="3">
					<TextField.Root
						value={replacementText}
						onChange={(e) => setReplacementText(e.target.value)}
						placeholder={t("replaceWordDialog.placeholder", "新单词")}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleConfirm();
						}}
						autoFocus
					/>

					<Flex direction="column" gap="2">
						<Text as="label" size="2">
							<Flex gap="2" align="center">
								<Checkbox
									checked={applyToAll}
									onCheckedChange={(c) => setApplyToAll(c as boolean)}
								/>
								{t(
									"replaceWordDialog.applyToAll",
									"将替换应用于所有相同的单词",
								)}
							</Flex>
						</Text>

						<Text
							as="label"
							size="2"
							style={{
								opacity: applyToAll ? 1 : 0.5,
								pointerEvents: applyToAll ? "auto" : "none",
							}}
						>
							<Flex gap="2" align="center">
								<Checkbox
									checked={ignoreCase}
									onCheckedChange={(c) => setIgnoreCase(c as boolean)}
									disabled={!applyToAll}
								/>
								{t("replaceWordDialog.ignoreCase", "忽略大小写")}
							</Flex>
						</Text>
					</Flex>
				</Flex>

				<Flex gap="3" mt="4" justify="end">
					<Dialog.Close><Button variant="soft" color="gray">
							{t("common.cancel", "取消")}
						</Button>
					</Dialog.Close>
					<Button onClick={handleConfirm}>{t("common.confirm", "确认")}</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
});
