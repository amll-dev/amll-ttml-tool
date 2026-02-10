import { Info16Regular } from "@fluentui/react-icons";
import {
	Box,
	Button,
	Callout,
	Checkbox,
	Dialog,
	Flex,
	Text,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	segmentationCustomRulesAtom,
	segmentationIgnoreListTextAtom,
	segmentationLangAtom,
	segmentationPunctuationModeAtom,
	segmentationPunctuationWeightAtom,
	segmentationRemoveEmptySegmentsAtom,
	segmentationSplitCJKAtom,
	segmentationSplitEnglishAtom,
} from "$/modules/segmentation/states";
import type {
	HyphenatorFunc,
	SegmentationConfig,
} from "$/modules/segmentation/types";
import { loadHyphenator } from "$/modules/segmentation/utils/hyphen-loader.ts";
import {
	recalculateWordTime,
	segmentWord,
} from "$/modules/segmentation/utils/segmentation.ts";
import { splitWordDialogAtom } from "$/states/dialogs.ts";
import { editingWordStateAtom, lyricLinesAtom } from "$/states/main";
import type { LyricWord } from "$/types/ttml";
import { ManualWordSplitter } from "./ManualWordSplitter";

export const SplitWordDialog = memo(() => {
	const [splitWordDialog, splitWordDialogOpen] = useAtom(splitWordDialogAtom);
	const editingState = useAtomValue(editingWordStateAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const { t } = useTranslation();

	const [splitIndices, setSplitIndices] = useState(new Set<number>());
	const [targetWordText, setTargetWordText] = useState("");

	const [applyToAll, setApplyToAll] = useState(false);
	const [ignoreCase, setIgnoreCase] = useState(true);

	const splitCJK = useAtomValue(segmentationSplitCJKAtom);
	const splitEnglish = useAtomValue(segmentationSplitEnglishAtom);
	const punctuationMode = useAtomValue(segmentationPunctuationModeAtom);
	const punctuationWeight = useAtomValue(segmentationPunctuationWeightAtom);
	const removeEmptySegments = useAtomValue(segmentationRemoveEmptySegmentsAtom);
	const ignoreListText = useAtomValue(segmentationIgnoreListTextAtom);
	const customRules = useAtomValue(segmentationCustomRulesAtom);
	const lang = useAtomValue(segmentationLangAtom);
	const [activeHyphenator, setActiveHyphenator] = useState<
		HyphenatorFunc | undefined
	>(undefined);

	useEffect(() => {
		let isMounted = true;

		const fetchHyphenator = async () => {
			const func = await loadHyphenator(lang);
			if (isMounted && func) {
				setActiveHyphenator(() => func);
			}
		};

		fetchHyphenator();

		return () => {
			isMounted = false;
		};
	}, [lang]);

	const ignoreList = useMemo(() => {
		return new Set(
			ignoreListText.split("\n").filter((line) => line.trim() !== ""),
		);
	}, [ignoreListText]);

	const segmentationConfig = useMemo((): SegmentationConfig => {
		const weight = parseFloat(punctuationWeight);
		const finalPunctuationWeight = Number.isNaN(weight) ? 0.2 : weight;

		return {
			splitCJK,
			splitEnglish,
			punctuationMode,
			punctuationWeight: finalPunctuationWeight,
			removeEmptySegments,
			ignoreList,
			customRules,
			hyphenator: activeHyphenator,
		};
	}, [
		splitCJK,
		splitEnglish,
		punctuationMode,
		punctuationWeight,
		removeEmptySegments,
		ignoreList,
		customRules,
		activeHyphenator,
	]);

	useEffect(() => {
		if (!splitWordDialog) {
			return;
		}

		setApplyToAll(false);
		setIgnoreCase(true);

		const line = lyricLines.lyricLines[editingState.lineIndex];
		const word = line?.words[editingState.wordIndex];

		if (word) {
			setTargetWordText(word.word);

			const resultWords = segmentWord(word, segmentationConfig);
			if (resultWords.length > 1) {
				const indices = new Set<number>();
				let currentIndex = 0;
				for (let i = 0; i < resultWords.length - 1; i++) {
					currentIndex += resultWords[i].word.length;
					indices.add(currentIndex);
				}
				setSplitIndices(indices);
			} else {
				setSplitIndices(new Set());
			}
		} else {
			setTargetWordText("");
			setSplitIndices(new Set());
		}
	}, [
		splitWordDialog,
		editingState.lineIndex,
		editingState.wordIndex,
		lyricLines,
		segmentationConfig,
	]);

	const toggleSplitPoint = useCallback((index: number) => {
		setSplitIndices((prev) => {
			const next = new Set(prev);
			if (next.has(index)) {
				next.delete(index);
			} else {
				next.add(index);
			}
			return next;
		});
	}, []);

	const handleSplit = useCallback(() => {
		if (!targetWordText) return;

		const parts: string[] = [];
		let lastIndex = 0;
		const sortedIndices = Array.from(splitIndices).sort((a, b) => a - b);

		for (const index of sortedIndices) {
			parts.push(targetWordText.slice(lastIndex, index));
			lastIndex = index;
		}
		parts.push(targetWordText.slice(lastIndex));

		const splittedTextParts = parts.filter((p) => p.length > 0);

		if (splittedTextParts.length === 0) return;

		const createNewWords = (targetWord: LyricWord): LyricWord[] => {
			return recalculateWordTime(
				targetWord,
				splittedTextParts,
				segmentationConfig,
			);
		};

		editLyricLines((state) => {
			if (applyToAll) {
				const targetLower = targetWordText.toLowerCase();

				for (const line of state.lyricLines) {
					line.words = line.words.flatMap((word) => {
						const isMatch = ignoreCase
							? word.word.toLowerCase() === targetLower
							: word.word === targetWordText;

						if (isMatch) {
							return createNewWords(word);
						}
						return word;
					});
				}
			} else {
				const line = state.lyricLines[editingState.lineIndex];
				if (line) {
					const word = line.words[editingState.wordIndex];
					if (word && word.word === targetWordText) {
						line.words.splice(
							editingState.wordIndex,
							1,
							...createNewWords(word),
						);
					}
				}
			}
		});
	}, [
		targetWordText,
		splitIndices,
		editLyricLines,
		applyToAll,
		ignoreCase,
		editingState.lineIndex,
		editingState.wordIndex,
		segmentationConfig,
	]);

	return (
		<Dialog.Root open={splitWordDialog} onOpenChange={splitWordDialogOpen}>
			<Dialog.Content>
				<Dialog.Title>{t("splitWordDialog.title", "拆分单词")}</Dialog.Title>
				<Flex direction="column" gap="2">
					<Callout.Root color="blue">
						<Callout.Icon>
							<Info16Regular />
						</Callout.Icon>
						<Callout.Text>
							{t(
								"splitWordDialog.tip",
								"拆分后新单词将会按自身单词字符平均分配原单词的始末时间，如有空拍则会被清除",
							)}
						</Callout.Text>
					</Callout.Root>

					<Box my="3">
						<ManualWordSplitter
							word={targetWordText}
							splitIndices={splitIndices}
							onSplitIndexToggle={toggleSplitPoint}
						/>
					</Box>

					<Flex direction="column" gap="2">
						<Text as="label" size="2">
							<Flex gap="2" align="center">
								<Checkbox
									checked={applyToAll}
									onCheckedChange={(c) => setApplyToAll(c as boolean)}
								/>
								{t(
									"splitWordDialog.applyToAll",
									"将此拆分规则应用于所有相同的单词",
								)}
							</Flex>
						</Text>

						<Text as="label" size="2">
							<Flex
								gap="2"
								align="center"
								style={{ opacity: applyToAll ? 1 : 0.5 }}
							>
								<Checkbox
									disabled={!applyToAll}
									checked={ignoreCase}
									onCheckedChange={(c) => setIgnoreCase(c as boolean)}
								/>
								{t("splitWordDialog.ignoreCase", "忽略大小写")}
							</Flex>
						</Text>
					</Flex>
				</Flex>

				<Flex justify="end" mt="4">
					<Dialog.Close>
						<Button onClick={handleSplit}>
							{t("splitWordDialog.actionButton", "执行")}
						</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
});
