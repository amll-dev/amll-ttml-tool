import { Button, DropdownMenu } from "@radix-ui/themes";
import type { CSSProperties } from "react";
import { Toolbar } from "radix-ui";
import { Trans, useTranslation } from "react-i18next";
import { ImportExportLyric } from "$/modules/project/modals/ImportExportLyric";
import { formatKeyBindings, type KeyBindingsConfig } from "$/utils/keybindings";

type FileMenuProps = {
	variant: "toolbar" | "submenu";
	newFileKey: KeyBindingsConfig;
	openFileKey: KeyBindingsConfig;
	saveFileKey: KeyBindingsConfig;
	onNewFile: () => void;
	onOpenFile: () => void;
	onOpenFileFromClipboard: () => void;
	onSaveFile: () => void;
	onOpenHistoryRestore: () => void;
	onSaveFileToClipboard: () => void;
	onSubmitToAMLLDB: () => void;
	buttonStyle?: CSSProperties;
};

const FileMenuItems = ({
	newFileKey,
	openFileKey,
	saveFileKey,
	onNewFile,
	onOpenFile,
	onOpenFileFromClipboard,
	onSaveFile,
	onOpenHistoryRestore,
	onSaveFileToClipboard,
	onSubmitToAMLLDB,
}: Omit<FileMenuProps, "variant" | "buttonStyle">) => {
	const { t } = useTranslation();

	return (
		<>
			<DropdownMenu.Item
				onSelect={onNewFile}
				shortcut={formatKeyBindings(newFileKey)}
			>
				<Trans i18nKey="topBar.menu.newLyric">新建 TTML 文件</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={onOpenFile}
				shortcut={formatKeyBindings(openFileKey)}
			>
				<Trans i18nKey="topBar.menu.openLyric">打开 TTML 文件</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={onOpenFileFromClipboard}>
				<Trans i18nKey="topBar.menu.openFromClipboard">
					从剪切板打开 TTML 文件
				</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={onSaveFile}
				shortcut={formatKeyBindings(saveFileKey)}
			>
				<Trans i18nKey="topBar.menu.saveLyric">保存 TTML 文件</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={onOpenHistoryRestore}>
				{t("topBar.menu.restoreFromHistory", "从历史记录恢复...")}
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={onSaveFileToClipboard}>
				<Trans i18nKey="topBar.menu.saveLyricToClipboard">
					保存 TTML 文件到剪切板
				</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<ImportExportLyric />
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={onSubmitToAMLLDB}>
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
					<FileMenuItems {...props} />
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		);
	}

	return (
		<DropdownMenu.Root>
			<Toolbar.Button asChild>
				<DropdownMenu.Trigger>
					<Button variant="soft" style={props.buttonStyle}>
						<Trans i18nKey="topBar.menu.file">文件</Trans>
					</Button>
				</DropdownMenu.Trigger>
			</Toolbar.Button>
			<DropdownMenu.Content>
				<FileMenuItems {...props} />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
