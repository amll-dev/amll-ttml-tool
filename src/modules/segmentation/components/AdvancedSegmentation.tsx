/**
 * @description 高级分词组件
 */

import {
	DeleteRegular,
	EditRegular,
	Info16Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Callout,
	Checkbox,
	Dialog,
	Flex,
	IconButton,
	RadioGroup,
	Select,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	segmentationCustomRulesAtom,
	segmentationIgnoreListTextAtom,
	segmentationLangAtom,
	segmentationPunctuationModeAtom,
	segmentationPunctuationWeightAtom,
	segmentationRangeEndAtom,
	segmentationRangeStartAtom,
	segmentationRemoveEmptySegmentsAtom,
	segmentationScopeAtom,
	segmentationSplitCJKAtom,
	segmentationSplitEnglishAtom,
} from "$/modules/segmentation/states";
import { SUPPORTED_LANGUAGES } from "$/modules/segmentation/utils/hyphen-loader";
import { segmentLyricLines } from "$/modules/segmentation/utils/segmentation.ts";
import { advancedSegmentationDialogAtom } from "$/states/dialogs.ts";
import { lyricLinesAtom } from "$/states/main.ts";
import { type LyricWord, newLyricLine, newLyricWord } from "$/types/ttml";
import { useSegmentationConfig } from "../utils/useSegmentationConfig";
import styles from "./AdvancedSegmentation.module.css";
import { ManualWordSplitter } from "./ManualWordSplitter";

export const AdvancedSegmentationDialog = memo(() => {
	const [open, setOpen] = useAtom(advancedSegmentationDialogAtom);
	const [scope, setScope] = useAtom(segmentationScopeAtom);
	const { config: segmentationConfig, isLoading: isLoadingLang } =
		useSegmentationConfig();
	const [rangeStart, setRangeStart] = useAtom(segmentationRangeStartAtom);
	const [rangeEnd, setRangeEnd] = useAtom(segmentationRangeEndAtom);
	const [splitCJK, setSplitCJK] = useAtom(segmentationSplitCJKAtom);
	const [splitEnglish, setSplitEnglish] = useAtom(segmentationSplitEnglishAtom);
	const [punctuationMode, setPunctuationMode] = useAtom(
		segmentationPunctuationModeAtom,
	);
	const [punctuationWeight, setPunctuationWeight] = useAtom(
		segmentationPunctuationWeightAtom,
	);
	const [removeEmptySegments, setRemoveEmptySegments] = useAtom(
		segmentationRemoveEmptySegmentsAtom,
	);
	const [ignoreListText, setIgnoreListText] = useAtom(
		segmentationIgnoreListTextAtom,
	);
	const [customRules, setCustomRules] = useAtom(segmentationCustomRulesAtom);

	const [testInput, setTestInput] = useState("");
	const [manualWordInput, setManualWordInput] = useState("");
	const [manualSplitIndices, setManualSplitIndices] = useState(
		new Set<number>(),
	);

	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const currentLyric = useAtomValue(lyricLinesAtom);

	const [lang, setLang] = useAtom(segmentationLangAtom);

	const { t } = useTranslation();

	const toggleSplitPoint = useCallback((index: number) => {
		setManualSplitIndices((prev) => {
			const next = new Set(prev);
			if (next.has(index)) {
				next.delete(index);
			} else {
				next.add(index);
			}
			return next;
		});
	}, []);

	const handleAddRule = useCallback(() => {
		if (!manualWordInput) return;

		const parts: string[] = [];
		let lastIndex = 0;
		const sortedIndices = Array.from(manualSplitIndices).sort((a, b) => a - b);

		for (const index of sortedIndices) {
			parts.push(manualWordInput.slice(lastIndex, index));
			lastIndex = index;
		}
		parts.push(manualWordInput.slice(lastIndex));

		const next = new Map(customRules);
		next.set(manualWordInput, parts);
		setCustomRules(next);

		setManualWordInput("");
		setManualSplitIndices(new Set());
	}, [manualWordInput, manualSplitIndices, customRules, setCustomRules]);

	const handleDeleteRule = useCallback(
		(word: string) => {
			const next = new Map(customRules);
			next.delete(word);
			setCustomRules(next);
		},
		[customRules, setCustomRules],
	);

	const handleEditRule = useCallback((word: string, parts: string[]) => {
		setManualWordInput(word);

		const indices = new Set<number>();
		let currentIndex = 0;
		for (let i = 0; i < parts.length - 1; i++) {
			currentIndex += parts[i].length;
			indices.add(currentIndex);
		}
		setManualSplitIndices(indices);
	}, []);

	const testPreview = useMemo(() => {
		if (!testInput.trim()) {
			return;
		}

		const testWord: LyricWord = {
			...newLyricWord(),
			word: testInput,
			startTime: 0,
			endTime: 10000,
		};

		try {
			const tempLine = { ...newLyricLine(), words: [testWord] };
			const processedLines = segmentLyricLines([tempLine], segmentationConfig);
			const resultWords = processedLines[0].words;

			if (resultWords.length === 0) return;

			return (
				<Flex gap="1" wrap="wrap" align="center">
					{resultWords.map((w, i) => (
						<span
							className={styles.previewWord}
							key={`preview-word-${i}-${w.id}`}
						>
							{w.word.trim() === "" ? (
								<Text color="gray" as="span">
									{w.word.length > 0
										? t("splitWordDialog.spaceCount", "空格x{count}", {
												count: w.word.length,
											})
										: t("splitWordDialog.empty", "空白")}
								</Text>
							) : (
								w.word
							)}
						</span>
					))}
				</Flex>
			);
		} catch (error) {
			console.error("分词预览出错:", error);
			return (
				<Text color="gray">
					{t("advancedSegmentDialog.test.outputError", "分词预览出错")}
				</Text>
			);
		}
	}, [testInput, t, segmentationConfig]);

	const onApply = useCallback(() => {
		const maxLines = currentLyric.lyricLines.length;
		let startIndex = 0;
		let endIndex = maxLines;

		if (scope === "range") {
			startIndex = (parseInt(rangeStart, 10) || 1) - 1;
			endIndex = parseInt(rangeEnd, 10) || maxLines;
			startIndex = Math.max(0, Math.min(startIndex, maxLines));
			endIndex = Math.max(startIndex, Math.min(endIndex, maxLines));
		}

		editLyricLines((draft) => {
			const linesToProcess = draft.lyricLines.slice(startIndex, endIndex);
			const processedLines = segmentLyricLines(
				linesToProcess,
				segmentationConfig,
			);
			draft.lyricLines.splice(
				startIndex,
				processedLines.length,
				...processedLines,
			);
		});

		setOpen(false);
	}, [
		segmentationConfig,
		scope,
		rangeStart,
		rangeEnd,
		editLyricLines,
		currentLyric.lyricLines.length,
		setOpen,
	]);

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="800px">
				<Dialog.Title>
					{t("advancedSegmentDialog.title", "高级分词")}
				</Dialog.Title>

				<Flex direction="column" gap="4">
					<Flex direction="column" gap="2">
						<Text>{t("advancedSegmentDialog.scope.title", "应用范围")}</Text>
						<Text as="label" size="2">
							<RadioGroup.Root
								value={scope}
								onValueChange={(value: string) =>
									setScope(value as "all" | "range")
								}
							>
								<Text as="label" size="2">
									<Flex gap="2" align="center">
										<RadioGroup.Item value="all" />
										<Text>
											{t("advancedSegmentDialog.scope.all", "所有歌词行")}
										</Text>
									</Flex>
								</Text>
								<Text as="label" size="2">
									<Flex gap="2" align="center" mt="2">
										<RadioGroup.Item value="range" />
										<Text>
											{t("advancedSegmentDialog.scope.range.from", "从第")}
										</Text>
										<TextField.Root
											type="number"
											value={rangeStart}
											onChange={(e) => setRangeStart(e.target.value)}
											disabled={scope !== "range"}
											style={{ maxWidth: 80 }}
										/>
										<Text>
											{t("advancedSegmentDialog.scope.range.to", "行到第")}
										</Text>
										<TextField.Root
											type="number"
											value={rangeEnd}
											onChange={(e) => setRangeEnd(e.target.value)}
											disabled={scope !== "range"}
											style={{ maxWidth: 80 }}
										/>
										<Text>
											{t("advancedSegmentDialog.scope.range.end", "行")}
										</Text>
									</Flex>
								</Text>
							</RadioGroup.Root>
						</Text>
					</Flex>
					<Flex direction="column" gap="2">
						<Text>
							{t("advancedSegmentDialog.rules.title", "自动分词规则")}
						</Text>
						<Text as="label" size="2">
							<Flex gap="2" align="center">
								<Checkbox
									checked={splitCJK}
									onCheckedChange={(c) => setSplitCJK(c as boolean)}
								/>
								{t("advancedSegmentDialog.rules.cjk", "CJK 按字符分词")}
							</Flex>
						</Text>

						<Flex direction="column" gap="2">
							<Text as="label" size="2">
								<Flex gap="2" align="center">
									<Checkbox
										checked={splitEnglish}
										onCheckedChange={(c) => setSplitEnglish(c as boolean)}
									/>
									{t(
										"advancedSegmentDialog.rules.syllable",
										"西文单词按音节分词",
									)}
								</Flex>
							</Text>

							{splitEnglish && (
								<Flex direction="column" gap="1" ml="5">
									<Text size="2" color="gray">
										{t(
											"advancedSegmentDialog.language.select",
											"选择一个分词语言模型：",
										)}
									</Text>
									<Select.Root
										value={lang}
										onValueChange={setLang}
										disabled={isLoadingLang}
									>
										<Select.Trigger style={{ width: "100%" }} /><Select.Content>
											{SUPPORTED_LANGUAGES.map((l) => (
												<Select.Item key={l.value} value={l.value}>
													{l.label}
												</Select.Item>
											))}
										</Select.Content>
									</Select.Root>
								</Flex>
							)}
						</Flex>

						<Callout.Root color="blue">
							<Callout.Icon>
								<Info16Regular />
							</Callout.Icon>
							<Callout.Text>
								{t(
									"advancedSegmentDialog.tip",
									"分词后，原音节的时长会按照字符数和权重重新分配给新的音节",
								)}
							</Callout.Text>
						</Callout.Root>
					</Flex>

					<Flex direction="column" gap="3">
						<Text>
							{t("advancedSegmentDialog.postProcess.title", "后处理")}
						</Text>
						<Text as="label" size="2">
							<Flex direction="column" gap="2">
								<Text>
									{t(
										"advancedSegmentDialog.postProcess.punct.caption",
										"标点符号处理:",
									)}
								</Text>
								<RadioGroup.Root
									value={punctuationMode}
									onValueChange={(value: string) =>
										setPunctuationMode(value as "merge" | "standalone")
									}
								>
									<Text as="label" size="2">
										<Flex gap="2" align="center">
											<RadioGroup.Item value="merge" />
											<Text>
												{t(
													"advancedSegmentDialog.postProcess.punct.merge",
													"合并到相邻音节",
												)}
											</Text>
										</Flex>
									</Text>
									<Text as="label" size="2">
										<Flex gap="2" align="center" mt="2">
											<RadioGroup.Item value="standalone" />
											<Text>
												{t(
													"advancedSegmentDialog.postProcess.punct.standalone",
													"设为新音节",
												)}
											</Text>
										</Flex>
									</Text>
								</RadioGroup.Root>
							</Flex>
						</Text>

						<Text as="label" size="2">
							<Flex direction="column" gap="2">
								<Text>
									{t(
										"advancedSegmentDialog.postProcess.punct.weight",
										"标点时长权重:",
									)}
								</Text>
								<TextField.Root
									type="number"
									value={punctuationWeight}
									onChange={(e) => setPunctuationWeight(e.target.value)}
									disabled={punctuationMode !== "standalone"}
									style={{ maxWidth: 100 }}
								/>
							</Flex>
						</Text>

						<Text as="label" size="2">
							<Flex gap="2" align="center">
								<Checkbox
									checked={removeEmptySegments}
									onCheckedChange={(c) => setRemoveEmptySegments(c as boolean)}
								/>
								<Text>
									{t("advancedSegmentDialog.postProcess.empty", "移除空白音节")}
								</Text>
							</Flex>
						</Text>
					</Flex>

					<Flex direction="column" gap="2">
						<Text>
							{t("advancedSegmentDialog.custom.title", "自定义分词规则")}
						</Text>
						<TextField.Root
							placeholder={t(
								"advancedSegmentDialog.custom.input",
								"输入单词进行手动分割...",
							)}
							value={manualWordInput}
							onChange={(e) => {
								setManualWordInput(e.target.value);
								setManualSplitIndices(new Set());
							}}
						/>
						<ManualWordSplitter
							word={manualWordInput}
							splitIndices={manualSplitIndices}
							onSplitIndexToggle={toggleSplitPoint}
						/>
						<Button onClick={handleAddRule} disabled={!manualWordInput}>
							{t("advancedSegmentDialog.custom.add", "添加到自定义规则")}
						</Button>
						{customRules.size > 0 && (
							<Flex direction="column" gap="2">
								<Text size="2">
									{t("advancedSegmentDialog.custom.list", "自定义规则列表:")}
								</Text>
								<Box className={styles.ruleList}>
									{Array.from(customRules.entries()).map(([word, parts]) => (
										<Flex
											key={word}
											justify="between"
											align="center"
											style={{
												paddingTop: "var(--space-1)",
												paddingBottom: "var(--space-2)",
												marginBottom: "var(--space-2)",
												borderBottom: "3px solid var(--gray-3)",
											}}
										>
											<Flex align="center" gap="2" wrap="wrap">
												<span className={styles.previewWord}>{word}</span>
												<Text color="gray" as="span">
													→
												</Text>
												{parts.map((part, i) => (
													<span
														className={styles.previewWord}
														key={`${word}-${part}-${
															// biome-ignore lint/suspicious/noArrayIndexKey: 这个列表顺序完全不会发生变化
															i
														}`}
													>
														{part.trim() === "" ? (
															<Text color="gray" as="span">
																{part.length > 0
																	? t(
																			"splitWordDialog.spaceCount",
																			"空格x{count}",
																			{
																				count: part.length,
																			},
																		)
																	: t("splitWordDialog.empty", "空白")}
															</Text>
														) : (
															part
														)}
													</span>
												))}
											</Flex>

											<Flex gap="1">
												<IconButton
													size="1"
													variant="ghost"
													color="gray"
													onClick={() => handleEditRule(word, parts)}
												>
													<EditRegular />
												</IconButton>
												<IconButton
													size="1"
													variant="ghost"
													color="gray"
													onClick={() => handleDeleteRule(word)}
												>
													<DeleteRegular />
												</IconButton>
											</Flex>
										</Flex>
									))}
								</Box>
							</Flex>
						)}
					</Flex>

					<Text as="label" size="2">
						<Flex direction="column" gap="2">
							<Text>{t("advancedSegmentDialog.ignore.title", "忽略列表")}</Text>
							<TextArea
								placeholder={t(
									"advancedSegmentDialog.ignore.placeholder",
									"每行一个单词，在此列表中的单词将不会被自动分词",
								)}
								value={ignoreListText}
								onChange={(e) => setIgnoreListText(e.target.value)}
								style={{ minHeight: 100, resize: "vertical" }}
							/>
						</Flex>
					</Text>

					<Text as="label" size="2">
						<Flex direction="column" gap="2">
							<Text>{t("advancedSegmentDialog.test.title", "分词测试")}</Text>
							<TextField.Root
								placeholder={t(
									"advancedSegmentDialog.test.input",
									"输入一行歌词或单词进行测试...",
								)}
								value={testInput}
								onChange={(e) => setTestInput(e.target.value)}
							/>
							<Text size="2">
								{t("advancedSegmentDialog.test.output", "预览结果:")}
							</Text>
							<Box
								style={{
									backgroundColor: "var(--gray-4)",
									borderRadius: "var(--radius-2)",
									padding: "var(--space-2)",
									minHeight: "4em",
								}}
							>
								{testPreview}
							</Box>
						</Flex>
					</Text>
				</Flex>

				<Flex gap="3" mt="4" justify="end">
					<Dialog.Close><Button variant="soft" color="gray">
							{t("common.cancel", "取消")}
						</Button>
					</Dialog.Close>
					<Button onClick={onApply}>{t("common.apply", "应用")}</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
});
