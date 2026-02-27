import { InfoRegular } from "@fluentui/react-icons";
import {
	Button,
	Callout,
	Dialog,
	Flex,
	RadioGroup,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { predictLineRomanization } from "$/modules/segmentation/utils/Transliteration/distributor";
import { applyRomanizationWarnings } from "$/modules/segmentation/utils/Transliteration/roman-warning";
import { applyGeneratedRuby } from "$/modules/lyric-editor/utils/ruby-generator";
import { distributeRomanizationDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom, selectedLinesAtom } from "$/states/main";

type Scope = "all" | "selected" | "selected-following" | "custom";

export const DistributeRomanizationDialog = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(distributeRomanizationDialogAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const setLyricLines = useSetImmerAtom(lyricLinesAtom);

	const [scope, setScope] = useState<Scope>("all");
	const [customStart, setCustomStart] = useState("1");
	const [customEnd, setCustomEnd] = useState("1");

	const hasSelection = selectedLines.size > 0;
	const totalLines = lyricLines.lyricLines.length;

	useEffect(() => {
		if (open) {
			if (hasSelection) {
				setScope("selected");
			} else {
				setScope("all");
			}
			setCustomEnd(totalLines.toString());
		}
	}, [open, hasSelection, totalLines]);

	const handleConfirm = () => {
		const targetLineIndices = new Set<number>();

		if (scope === "all") {
			for (let i = 0; i < totalLines; i++) targetLineIndices.add(i);
		} else if (scope === "selected") {
			lyricLines.lyricLines.forEach((line, index) => {
				if (selectedLines.has(line.id)) {
					targetLineIndices.add(index);
				}
			});
		} else if (scope === "selected-following") {
			let firstSelectedIndex = -1;
			lyricLines.lyricLines.forEach((line, index) => {
				if (selectedLines.has(line.id)) {
					if (firstSelectedIndex === -1 || index < firstSelectedIndex) {
						firstSelectedIndex = index;
					}
				}
			});
			if (firstSelectedIndex !== -1) {
				for (let i = firstSelectedIndex; i < totalLines; i++) {
					targetLineIndices.add(i);
				}
			}
		} else if (scope === "custom") {
			const start = parseInt(customStart, 10);
			const end = parseInt(customEnd, 10);
			if (!Number.isNaN(start) && !Number.isNaN(end)) {
				for (
					let i = Math.max(0, start - 1);
					i < Math.min(totalLines, end);
					i++
				) {
					targetLineIndices.add(i);
				}
			}
		}

		setLyricLines((draft) => {
			draft.lyricLines.forEach((line, index) => {
				if (targetLineIndices.has(index)) {
					const fullRoman = line.romanLyric || "";
					if (line.words.length > 0 && fullRoman.trim() !== "") {
						try {
							const results = predictLineRomanization(line.words, fullRoman);

							line.words.forEach((word, wordIndex) => {
								if (results[wordIndex]) {
									word.romanWord = results[wordIndex];
									applyGeneratedRuby(word);
								}
							});
							applyRomanizationWarnings(line.words);
						} catch (e) {
							console.error(
								`Failed to distribute romanization for line ${index + 1}`,
								e,
							);
						}
					}
				}
			});
		});

		setOpen(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="450px">
				<Dialog.Title>
					{t("distributeRomanDialog.title", "应用逐行音译到逐字")}
				</Dialog.Title>

				<Flex direction="column" gap="4">
					<Callout.Root color="gray" size="1">
						<Callout.Icon>
							<InfoRegular />
						</Callout.Icon>
						<Callout.Text>
							{t(
								"distributeRomanDialog.warning",
								"此功能将读取整行音译并自动分配给每个单词。算法专为日语罗马音设计，对其他语言可能效果不佳。",
							)}
						</Callout.Text>
					</Callout.Root>

					<Flex direction="column" gap="2">
						<Text size="2" weight="bold">
							{t("common.applyScope", "应用于")}
						</Text>
						<RadioGroup.Root
							value={scope}
							onValueChange={(v) => setScope(v as Scope)}
						>
							<RadioGroup.Item value="all">
								{t("common.scope.all", "所有行")}
							</RadioGroup.Item>

							<RadioGroup.Item value="selected" disabled={!hasSelection}>
								{t("common.scope.selected", "所选行")}
								{hasSelection && ` (${selectedLines.size})`}
							</RadioGroup.Item>

							<RadioGroup.Item
								value="selected-following"
								disabled={!hasSelection}
							>
								{t("common.scope.selectedFollowing", "所选行及其后续")}
							</RadioGroup.Item>

							<RadioGroup.Item value="custom">
								{t("common.scope.custom", "自定义范围")}
							</RadioGroup.Item>
						</RadioGroup.Root>
					</Flex>

					{scope === "custom" && (
						<Flex align="center" gap="2" ml="4">
							<Text size="2">{t("common.fromLine", "从")}</Text>
							<TextField.Root
								style={{ width: "60px" }}
								size="1"
								type="number"
								value={customStart}
								onChange={(e) => setCustomStart(e.target.value)}
							/>
							<Text size="2">{t("common.toLine", "行 到")}</Text>
							<TextField.Root
								style={{ width: "60px" }}
								size="1"
								type="number"
								value={customEnd}
								onChange={(e) => setCustomEnd(e.target.value)}
							/>
							<Text size="2">{t("common.line", "行")}</Text>
						</Flex>
					)}
				</Flex>

				<Flex gap="3" mt="5" justify="end">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.cancel", "取消")}
						</Button>
					</Dialog.Close>
					<Button onClick={handleConfirm}>{t("common.apply", "应用")}</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
