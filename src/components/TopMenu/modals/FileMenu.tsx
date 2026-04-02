import { Button, DropdownMenu } from "@radix-ui/themes";
import { Toolbar } from "radix-ui";
import type { CSSProperties } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ImportExportLyric } from "$/modules/project/modals/ImportExportLyric";
import { formatKeyBindings } from "$/utils/keybindings";
import { useTopMenuActions } from "../useTopMenuActions";

type FileMenuProps = {
	variant: "toolbar" | "submenu";
	buttonStyle?: CSSProperties;
};

const FileMenuItems = () => {
	const { t } = useTranslation();
	const menu = useTopMenuActions();

	return (
		<>
			<DropdownMenu.Item
				onSelect={menu.onNewFile}
				shortcut={formatKeyBindings(menu.newFileKey)}
			>
				<Trans i18nKey="topBar.menu.newLyric">新建 TTML 文件</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onOpenFile}
				shortcut={formatKeyBindings(menu.openFileKey)}
			>
				<Trans i18nKey="topBar.menu.openLyric">打开 TTML 文件</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenFileFromClipboard}>
				<Trans i18nKey="topBar.menu.openFromClipboard">
					从剪切板打开 TTML 文件
				</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onSaveFile}
				shortcut={formatKeyBindings(menu.saveFileKey)}
			>
				<Trans i18nKey="topBar.menu.saveLyric">保存 TTML 文件</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onOpenHistoryRestore}>
				{t("topBar.menu.restoreFromHistory", "从历史记录恢复...")}
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onSaveFileToClipboard}>
				<Trans i18nKey="topBar.menu.saveLyricToClipboard">
					保存 TTML 文件到剪切板
				</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<ImportExportLyric />
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onSubmitToAMLLDB}>
				<Trans i18nKey="topBar.menu.uploadToAMLLDB">
					上传到 AMLL 歌词数据库
				</Trans>
			</DropdownMenu.Item>
		</>
	);
};

export const FileMenu = (props: FileMenuProps) => {
	if (props.variant === "submenu") {
		return (
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<Trans i18nKey="topBar.menu.file">文件</Trans>
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<FileMenuItems />
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		);
	}

	return (
		<DropdownMenu.Root>
			<Toolbar.Button asChild
			><DropdownMenu.Trigger
				><Button variant="soft" style={props.buttonStyle}>
						<Trans i18nKey="topBar.menu.file">文件</Trans>
					</Button></DropdownMenu.Trigger></Toolbar.Button>
			<DropdownMenu.Content>
				<FileMenuItems />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
