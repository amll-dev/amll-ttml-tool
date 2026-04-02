import { Button, DropdownMenu } from "@radix-ui/themes";
import { Toolbar } from "radix-ui";
import type { CSSProperties } from "react";
import { Trans, useTranslation } from "react-i18next";
import { formatKeyBindings } from "$/utils/keybindings";
import { useTopMenuActions } from "../useTopMenuActions";

type EditMenuProps = {
	variant: "toolbar" | "submenu";
	triggerStyle?: CSSProperties;
	buttonStyle?: CSSProperties;
};

const EditMenuItems = () => {
	const { t } = useTranslation();
	const menu = useTopMenuActions();

	return (
		<>
			<DropdownMenu.Item
				onSelect={menu.onUndo}
				shortcut={formatKeyBindings(menu.undoKey)}
				disabled={menu.undoDisabled}
			>
				<Trans i18nKey="topBar.menu.undo">撤销</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onRedo}
				shortcut={formatKeyBindings(menu.redoKey)}
				disabled={menu.redoDisabled}
			>
				<Trans i18nKey="topBar.menu.redo">重做</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				onSelect={menu.onSelectAll}
				shortcut={formatKeyBindings(menu.selectAllLinesKey)}
			>
				<Trans i18nKey="topBar.menu.selectAllLines">选中所有歌词行</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onUnselectAll}
				shortcut={formatKeyBindings(menu.unselectAllLinesKey)}
			>
				<Trans i18nKey="topBar.menu.unselectAllLines">取消选中所有歌词行</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onSelectInverted}
				shortcut={formatKeyBindings(menu.selectInvertedLinesKey)}
			>
				<Trans i18nKey="topBar.menu.invertSelectAllLines">反选所有歌词行</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onSelectWordsOfMatchedSelection}
				shortcut={formatKeyBindings(menu.selectWordsOfMatchedSelectionKey)}
			>
				<Trans i18nKey="topBar.menu.selectWordsOfMatchedSelection">
					选择单词匹配项
				</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				onSelect={menu.onDeleteSelection}
				shortcut={formatKeyBindings(menu.deleteSelectionKey)}
			>
				<Trans i18nKey="contextMenu.deleteWords">删除选定单词</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onOpenTimeShift}>
				{t("topBar.menu.timeShift", "平移时间...")}
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onOpenMetadataEditor}>
				<Trans i18nKey="topBar.menu.editMetadata">编辑歌词元数据</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onOpenSettings}>
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
					<EditMenuItems />
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		);
	}

	return (
		<DropdownMenu.Root>
			<Toolbar.Button asChild
			><DropdownMenu.Trigger style={props.triggerStyle}
				><Button variant="soft" style={props.buttonStyle}>
						<Trans i18nKey="topBar.menu.edit">编辑</Trans>
					</Button></DropdownMenu.Trigger></Toolbar.Button>
			<DropdownMenu.Content>
				<EditMenuItems />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
