import { HomeRegular } from "@fluentui/react-icons";
import { DropdownMenu, IconButton } from "@radix-ui/themes";
import type { FC } from "react";
import type { KeyBindingsConfig } from "$/utils/keybindings";
import { EditMenu } from "./EditMenu";
import { FileMenu } from "./FileMenu";
import { HelpMenu } from "./HelpMenu";
import { ToolMenu } from "./ToolMenu";

type HomeMenuProps = {
	newFileKey: KeyBindingsConfig;
	openFileKey: KeyBindingsConfig;
	saveFileKey: KeyBindingsConfig;
	undoKey: KeyBindingsConfig;
	redoKey: KeyBindingsConfig;
	selectAllLinesKey: KeyBindingsConfig;
	unselectAllLinesKey: KeyBindingsConfig;
	selectInvertedLinesKey: KeyBindingsConfig;
	selectWordsOfMatchedSelectionKey: KeyBindingsConfig;
	deleteSelectionKey: KeyBindingsConfig;
	undoDisabled: boolean;
	redoDisabled: boolean;
	onNewFile: () => void;
	onOpenFile: () => void;
	onOpenFileFromClipboard: () => void;
	onSaveFile: () => void;
	onOpenHistoryRestore: () => void;
	onSaveFileToClipboard: () => void;
	onSubmitToAMLLDB: () => void;
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
	onAutoSegment: () => void;
	onOpenAdvancedSegmentation: () => void;
	onSyncLineTimestamps: () => void;
	onOpenDistributeRomanization: () => void;
	onCheckRomanizationWarnings: () => void;
	onOpenLatencyTest: () => void;
	onOpenGitHub: () => void;
	onOpenWiki: () => void;
};

export const HomeMenu: FC<HomeMenuProps> = (props) => {
	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				<IconButton variant="soft">
					<HomeRegular />
				</IconButton>
			</DropdownMenu.Trigger>
			<DropdownMenu.Content>
				<FileMenu
					variant="submenu"
					newFileKey={props.newFileKey}
					openFileKey={props.openFileKey}
					saveFileKey={props.saveFileKey}
					onNewFile={props.onNewFile}
					onOpenFile={props.onOpenFile}
					onOpenFileFromClipboard={props.onOpenFileFromClipboard}
					onSaveFile={props.onSaveFile}
					onOpenHistoryRestore={props.onOpenHistoryRestore}
					onSaveFileToClipboard={props.onSaveFileToClipboard}
					onSubmitToAMLLDB={props.onSubmitToAMLLDB}
				/>
				<EditMenu
					variant="submenu"
					undoKey={props.undoKey}
					redoKey={props.redoKey}
					selectAllLinesKey={props.selectAllLinesKey}
					unselectAllLinesKey={props.unselectAllLinesKey}
					selectInvertedLinesKey={props.selectInvertedLinesKey}
					selectWordsOfMatchedSelectionKey={
						props.selectWordsOfMatchedSelectionKey
					}
					deleteSelectionKey={props.deleteSelectionKey}
					undoDisabled={props.undoDisabled}
					redoDisabled={props.redoDisabled}
					onUndo={props.onUndo}
					onRedo={props.onRedo}
					onSelectAll={props.onSelectAll}
					onUnselectAll={props.onUnselectAll}
					onSelectInverted={props.onSelectInverted}
					onSelectWordsOfMatchedSelection={props.onSelectWordsOfMatchedSelection}
					onDeleteSelection={props.onDeleteSelection}
					onOpenTimeShift={props.onOpenTimeShift}
					onOpenMetadataEditor={props.onOpenMetadataEditor}
					onOpenSettings={props.onOpenSettings}
				/>
				<ToolMenu
					variant="submenu"
					onAutoSegment={props.onAutoSegment}
					onOpenAdvancedSegmentation={props.onOpenAdvancedSegmentation}
					onSyncLineTimestamps={props.onSyncLineTimestamps}
					onOpenDistributeRomanization={props.onOpenDistributeRomanization}
					onCheckRomanizationWarnings={props.onCheckRomanizationWarnings}
					onOpenLatencyTest={props.onOpenLatencyTest}
				/>
				<HelpMenu
					variant="submenu"
					onOpenGitHub={props.onOpenGitHub}
					onOpenWiki={props.onOpenWiki}
				/>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
