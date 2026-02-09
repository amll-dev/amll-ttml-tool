import { Button, DropdownMenu } from "@radix-ui/themes";
import type { CSSProperties } from "react";
import { Toolbar } from "radix-ui";
import { Trans, useTranslation } from "react-i18next";

type ToolMenuProps = {
	variant: "toolbar" | "submenu";
	onAutoSegment: () => void;
	onOpenAdvancedSegmentation: () => void;
	onSyncLineTimestamps: () => void;
	onOpenDistributeRomanization: () => void;
	onCheckRomanizationWarnings: () => void;
	onOpenLatencyTest: () => void;
	triggerStyle?: CSSProperties;
	buttonStyle?: CSSProperties;
};

const ToolMenuItems = ({
	onAutoSegment,
	onOpenAdvancedSegmentation,
	onSyncLineTimestamps,
	onOpenDistributeRomanization,
	onCheckRomanizationWarnings,
	onOpenLatencyTest,
}: Omit<ToolMenuProps, "variant" | "triggerStyle" | "buttonStyle">) => {
	const { t } = useTranslation();

	return (
		<>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{t("topBar.menu.segmentationTools", "分词")}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<DropdownMenu.Item onSelect={onAutoSegment}>
						{t("topBar.menu.autoSegment", "自动分词")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={onOpenAdvancedSegmentation}>
						{t("topBar.menu.advancedSegment", "高级分词...")}
					</DropdownMenu.Item>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Item onSelect={onSyncLineTimestamps}>
				{t("topBar.menu.syncLineTimestamps", "同步行时间戳")}
			</DropdownMenu.Item>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{t("topBar.menu.perWordRomanization.index", "逐字音译")}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<DropdownMenu.Item onSelect={onOpenDistributeRomanization}>
						{t("topBar.menu.perWordRomanization.distribute", "自动分配罗马音...")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={onCheckRomanizationWarnings}>
						{t("topBar.menu.perWordRomanization.check", "检查")}
					</DropdownMenu.Item>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Item onSelect={onOpenLatencyTest}>
				{t("settingsDialog.common.latencyTest", "音频/输入延迟测试")}
			</DropdownMenu.Item>
		</>
	);
};

export const ToolMenu = (props: ToolMenuProps) => {
	if (props.variant === "submenu") {
		return (
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<Trans i18nKey="topBar.menu.tool">工具</Trans>
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<ToolMenuItems {...props} />
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		);
	}

	return (
		<DropdownMenu.Root>
			<Toolbar.Button asChild>
				<DropdownMenu.Trigger style={props.triggerStyle}>
					<Button variant="soft" style={props.buttonStyle}>
						<Trans i18nKey="topBar.menu.tool">工具</Trans>
					</Button>
				</DropdownMenu.Trigger>
			</Toolbar.Button>
			<DropdownMenu.Content>
				<ToolMenuItems {...props} />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
