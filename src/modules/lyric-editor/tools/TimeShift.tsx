/**
 * @description “平移时间” 模态框
 */
import { ArrowLeftRegular, ArrowRightRegular } from "@fluentui/react-icons";
import {
	Button,
	Dialog,
	Flex,
	IconButton,
	RadioGroup,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { timeShiftDialogAtom } from "$/states/dialogs.ts";
import { lyricLinesAtom, selectedLinesAtom } from "$/states/main.ts";

type ShiftDirection = "delay" | "advance";
type ShiftScope = "all" | "selected" | "selected-following" | "custom";

export const TimeShiftDialog = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(timeShiftDialogAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const setLyricLines = useSetImmerAtom(lyricLinesAtom);

	const [offsetStr, setOffsetStr] = useState("100");
	const [direction, setDirection] = useState<ShiftDirection>("delay");
	const [scope, setScope] = useState<ShiftScope>("all");
	const [customStart, setCustomStart] = useState("1");
	const [customEnd, setCustomEnd] = useState("1");

	const hasSelection = selectedLines.size > 0;
	const totalLines = lyricLines.lyricLines.length;

	const adjustOffset = (delta: number) => {
		const current = parseInt(offsetStr, 10);
		const val = Number.isNaN(current) ? 0 : current;
		setOffsetStr(Math.max(0, val + delta).toString());
	};

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
		const amount = parseInt(offsetStr, 10);
		if (Number.isNaN(amount) || amount === 0) {
			setOpen(false);
			return;
		}

		const finalOffset = direction === "delay" ? amount : -amount;

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
					line.startTime = Math.max(0, line.startTime + finalOffset);
					line.endTime = Math.max(0, line.endTime + finalOffset);

					line.words.forEach((word) => {
						word.startTime = Math.max(0, word.startTime + finalOffset);
						word.endTime = Math.max(0, word.endTime + finalOffset);
						if (word.ruby && word.ruby.length > 0) {
							word.ruby.forEach((rubyWord) => {
								rubyWord.startTime = Math.max(
									0,
									rubyWord.startTime + finalOffset,
								);
								rubyWord.endTime = Math.max(
									0,
									rubyWord.endTime + finalOffset,
								);
							});
						}
					});
				}
			});
		});

		setOpen(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="450px">
				<Dialog.Title>{t("timeShiftDialog.title", "平移时间")}</Dialog.Title>
				<Flex direction="column" gap="4">
					<Flex direction="column" gap="1">
						<Text size="2" weight="bold">
							{t("timeShiftDialog.amount", "偏移量 (ms)")}
						</Text>
						<Flex gap="2" align="center">
							<IconButton
								variant="soft"
								onClick={() => adjustOffset(-50)}
								title="- 50ms"
							>
								<ArrowLeftRegular />
							</IconButton>
							<TextField.Root
								type="number"
								min="0"
								value={offsetStr}
								onChange={(e) => setOffsetStr(e.target.value)}
								placeholder="100"
								style={{ flexGrow: 1 }}
							/>
							<IconButton
								variant="soft"
								onClick={() => adjustOffset(50)}
								title="+ 50ms"
							>
								<ArrowRightRegular />
							</IconButton>
						</Flex>
					</Flex>

					<Flex direction="column" gap="1">
						<Text size="2" weight="bold">
							{t("timeShiftDialog.direction", "方向")}
						</Text>
						<RadioGroup.Root
							value={direction}
							onValueChange={(v) => setDirection(v as ShiftDirection)}
							style={{ flexDirection: "row", gap: "16px" }}
						>
							<RadioGroup.Item value="advance">
								{t("timeShiftDialog.advance", "提前 (-)")}
							</RadioGroup.Item>
							<RadioGroup.Item value="delay">
								{t("timeShiftDialog.delay", "延后 (+)")}
							</RadioGroup.Item>
						</RadioGroup.Root>
					</Flex>

					<Flex direction="column" gap="2">
						<Text size="2" weight="bold">
							{t("timeShiftDialog.scopeLabel", "应用于")}
						</Text>
						<RadioGroup.Root
							value={scope}
							onValueChange={(v) => setScope(v as ShiftScope)}
						>
							<RadioGroup.Item value="all">
								{t("timeShiftDialog.scope.all", "所有行")}
							</RadioGroup.Item>

							<RadioGroup.Item value="selected" disabled={!hasSelection}>
								{t("timeShiftDialog.scope.selected", "所选行")}
								{hasSelection && ` (${selectedLines.size})`}
							</RadioGroup.Item>

							<RadioGroup.Item
								value="selected-following"
								disabled={!hasSelection}
							>
								{t("timeShiftDialog.scope.selectedFollowing", "所选行及其后续")}
							</RadioGroup.Item>

							<RadioGroup.Item value="custom">
								{t("timeShiftDialog.scope.custom", "自定义范围")}
							</RadioGroup.Item>
						</RadioGroup.Root>
					</Flex>

					{scope === "custom" && (
						<Flex align="center" gap="2" ml="4">
							<Text size="2">{t("timeShiftDialog.fromLine", "从")}</Text>
							<TextField.Root
								style={{ width: "60px" }}
								size="1"
								type="number"
								value={customStart}
								onChange={(e) => setCustomStart(e.target.value)}
							/>
							<Text size="2">{t("timeShiftDialog.toLine", "行 到")}</Text>
							<TextField.Root
								style={{ width: "60px" }}
								size="1"
								type="number"
								value={customEnd}
								onChange={(e) => setCustomEnd(e.target.value)}
							/>
							<Text size="2">{t("timeShiftDialog.line", "行")}</Text>
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
