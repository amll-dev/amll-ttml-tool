import { Button, DropdownMenu } from "@radix-ui/themes";
import type { CSSProperties } from "react";
import { Toolbar } from "radix-ui";
import { Trans, useTranslation } from "react-i18next";
import { formatKeyBindings, type KeyBindingsConfig } from "$/utils/keybindings";

type EditMenuProps = {
	variant: "toolbar" | "submenu";
	undoKey: KeyBindingsConfig;
	redoKey: KeyBindingsConfig;
	selectAllLinesKey: KeyBindingsConfig;
	unselectAllLinesKey: KeyBindingsConfig;
	selectInvertedLinesKey: KeyBindingsConfig;
	selectWordsOfMatchedSelectionKey: KeyBindingsConfig;
	deleteSelectionKey: KeyBindingsConfig;
	undoDisabled: boolean;
	redoDisabled: boolean;
	onUndo: () => void;
	onRedo: () => void;
	onSelectAll: () => void;
	onUnselectAll: () => void;
	onSelectInverted: () => void;
	onSelectWordsOfMatchedSelection: () => void;
	onDeleteSelection: () => void;
	onOpenTimeShift: () => void;
	onOpenMetadataEditor: () => void;
	onOpenSettings: () => void;
	triggerStyle?: CSSProperties;
	buttonStyle?: CSSProperties;
};

const EditMenuItems = ({
	undoKey,
	redoKey,
	selectAllLinesKey,
	unselectAllLinesKey,
	selectInvertedLinesKey,
	selectWordsOfMatchedSelectionKey,
	deleteSelectionKey,
	undoDisabled,
	redoDisabled,
	onUndo,
	onRedo,
	onSelectAll,
	onUnselectAll,
	onSelectInverted,
	onSelectWordsOfMatchedSelection,
	onDeleteSelection,
	onOpenTimeShift,
	onOpenMetadataEditor,
	onOpenSettings,
}: Omit<EditMenuProps, "variant" | "triggerStyle" | "buttonStyle">) => {
	const { t } = useTranslation();

	return (
		<>
			<DropdownMenu.Item
				onSelect={onUndo}
				shortcut={formatKeyBindings(undoKey)}
				disabled={undoDisabled}
			>
				<Trans i18nKey="topBar.menu.undo">撤销</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={onRedo}
				shortcut={formatKeyBindings(redoKey)}
				disabled={redoDisabled}
			>
				<Trans i18nKey="topBar.menu.redo">重做</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				onSelect={onSelectAll}
				shortcut={formatKeyBindings(selectAllLinesKey)}
			>
				<Trans i18nKey="topBar.menu.selectAllLines">选中所有歌词行</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={onUnselectAll}
				shortcut={formatKeyBindings(unselectAllLinesKey)}
			>
				<Trans i18nKey="topBar.menu.unselectAllLines">取消选中所有歌词行</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={onSelectInverted}
				shortcut={formatKeyBindings(selectInvertedLinesKey)}
			>
				<Trans i18nKey="topBar.menu.invertSelectAllLines">反选所有歌词行</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={onSelectWordsOfMatchedSelection}
				shortcut={formatKeyBindings(selectWordsOfMatchedSelectionKey)}
			>
				<Trans i18nKey="topBar.menu.selectWordsOfMatchedSelection">
					选择单词匹配项
				</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				onSelect={onDeleteSelection}
				shortcut={formatKeyBindings(deleteSelectionKey)}
			>
				<Trans i18nKey="contextMenu.deleteWords">删除选定单词</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={onOpenTimeShift}>
				{t("topBar.menu.timeShift", "平移时间...")}
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={onOpenMetadataEditor}>
				<Trans i18nKey="topBar.menu.editMetadata">编辑歌词元数据</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={onOpenSettings}>
				<Trans i18nKey="settingsDialog.title">首选项</Trans>
			</DropdownMenu.Item>
		</>
	);
};

export const EditMenu = (props: EditMenuProps) => {
	if (props.variant === "submenu") {
		return (
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<Trans i18nKey="topBar.menu.edit">编辑</Trans>
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<EditMenuItems {...props} />
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		);
	}

	return (
		<DropdownMenu.Root>
			<Toolbar.Button asChild>
				<DropdownMenu.Trigger style={props.triggerStyle}>
					<Button variant="soft" style={props.buttonStyle}>
						<Trans i18nKey="topBar.menu.edit">编辑</Trans>
					</Button>
				</DropdownMenu.Trigger>
			</Toolbar.Button>
			<DropdownMenu.Content>
				<EditMenuItems {...props} />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
