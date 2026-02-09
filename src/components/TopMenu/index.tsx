import { Box, Flex } from "@radix-ui/themes";
import { open } from "@tauri-apps/plugin-shell";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom, withImmer } from "jotai-immer";
import { Toolbar } from "radix-ui";
import { type FC, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import saveFile from "save-file";
import { uid } from "uid";
import { useFileOpener } from "$/hooks/useFileOpener.ts";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import { applyRomanizationWarnings } from "$/modules/segmentation/utils/Transliteration/roman-warning";
import { segmentLyricLines } from "$/modules/segmentation/utils/segmentation";
import { useSegmentationConfig } from "$/modules/segmentation/utils/useSegmentationConfig";
import {
	advancedSegmentationDialogAtom,
	confirmDialogAtom,
	distributeRomanizationDialogAtom,
	historyRestoreDialogAtom,
	latencyTestDialogAtom,
	metadataEditorDialogAtom,
	settingsDialogAtom,
	submitToAMLLDBDialogAtom,
	timeShiftDialogAtom,
} from "$/states/dialogs.ts";
import {
	keyDeleteSelectionAtom,
	keyNewFileAtom,
	keyOpenFileAtom,
	keyRedoAtom,
	keySaveFileAtom,
	keySelectAllAtom,
	keySelectInvertedAtom,
	keySelectWordsOfMatchedSelectionAtom,
	keyUndoAtom,
} from "$/states/keybindings.ts";
import {
	isDirtyAtom,
	lyricLinesAtom,
	newLyricLinesAtom,
	projectIdAtom,
	redoLyricLinesAtom,
	saveFileNameAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	undoableLyricLinesAtom,
	undoLyricLinesAtom,
} from "$/states/main.ts";
import { useKeyBindingAtom } from "$/utils/keybindings.ts";
import { error, log } from "$/utils/logging.ts";
import { HeaderFileInfo } from "./HeaderFileInfo";
import { EditMenu } from "./modals/EditMenu";
import { FileMenu } from "./modals/FileMenu";
import { HelpMenu } from "./modals/HelpMenu";
import { HomeMenu } from "./modals/HomeMenu";
import { ToolMenu } from "./modals/ToolMenu";

const useWindowSize = () => {
	const [windowSize, setWindowSize] = useState({
		width: window.innerWidth,
		height: window.innerHeight,
	});

	useEffect(() => {
		const handleResize = () => {
			setWindowSize({
				width: window.innerWidth,
				height: window.innerHeight,
			});
		};

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	return windowSize;
};

export const TopMenu: FC = () => {
	const { width } = useWindowSize();
	const showHomeButton = width < 800;
	const [saveFileName, setSaveFileName] = useAtom(saveFileNameAtom);
	const newLyricLine = useSetAtom(newLyricLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setMetadataEditorOpened = useSetAtom(metadataEditorDialogAtom);
	const setSettingsDialogOpened = useSetAtom(settingsDialogAtom);
	const undoLyricLines = useAtomValue(undoableLyricLinesAtom);
	const store = useStore();
	const { t } = useTranslation();
	const isDirty = useAtomValue(isDirtyAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const setHistoryRestoreDialog = useSetAtom(historyRestoreDialogAtom);
	const setAdvancedSegmentationDialog = useSetAtom(
		advancedSegmentationDialogAtom,
	);
	const setTimeShiftDialog = useSetAtom(timeShiftDialogAtom);
	const { openFile } = useFileOpener();
	const setProjectId = useSetAtom(projectIdAtom);
	const setDistributeRomanizationDialog = useSetAtom(
		distributeRomanizationDialogAtom,
	);

	const onNewFile = useCallback(() => {
		const action = () => {
			newLyricLine();
			setProjectId(uid());
			setSaveFileName("lyric.ttml");
		};

		if (isDirty) {
			setConfirmDialog({
				open: true,
				title: t("confirmDialog.newFile.title", "确认新建文件"),
				description: t(
					"confirmDialog.newFile.description",
					"当前文件有未保存的更改。如果继续，这些更改将会丢失。确定要新建文件吗？",
				),
				onConfirm: action,
			});
		} else {
			action();
		}
	}, [
		isDirty,
		newLyricLine,
		setConfirmDialog,
		t,
		setProjectId,
		setSaveFileName,
	]);

	const newFileKey = useKeyBindingAtom(keyNewFileAtom, onNewFile, [onNewFile]);

	const onOpenFile = useCallback(() => {
		const inputEl = document.createElement("input");
		inputEl.type = "file";
		inputEl.accept = ".ttml,.lrc,.qrc,.eslrc,.lys,.yrc,*/*";
		inputEl.addEventListener(
			"change",
			() => {
				const file = inputEl.files?.[0];
				if (!file) return;
				openFile(file);
			},
			{
				once: true,
			},
		);
		inputEl.click();
	}, [openFile]);

	const openFileKey = useKeyBindingAtom(keyOpenFileAtom, onOpenFile, [
		onOpenFile,
	]);

	const onOpenFileFromClipboard = useCallback(async () => {
		try {
			const ttmlText = await navigator.clipboard.readText();
			const file = new File([ttmlText], "lyric.ttml", {
				type: "application/xml",
			});
			openFile(file);
		} catch (e) {
			error("Failed to parse TTML file from clipboard", e);
		}
	}, [openFile]);

	const onSaveFile = useCallback(() => {
		try {
			const ttmlText = exportTTMLText(store.get(lyricLinesAtom));
			const b = new Blob([ttmlText], { type: "text/plain" });
			saveFile(b, saveFileName).catch(error);
		} catch (e) {
			error("Failed to save TTML file", e);
		}
	}, [saveFileName, store]);
	const saveFileKey = useKeyBindingAtom(keySaveFileAtom, onSaveFile, [
		onSaveFile,
	]);

	const onSaveFileToClipboard = useCallback(async () => {
		try {
			const lyric = store.get(lyricLinesAtom);
			const ttml = exportTTMLText(lyric);
			await navigator.clipboard.writeText(ttml);
		} catch (e) {
			error("Failed to save TTML file into clipboard", e);
		}
	}, [store]);

	const onSubmitToAMLLDB = useCallback(() => {
		store.set(submitToAMLLDBDialogAtom, true);
	}, [store]);

	const onOpenMetadataEditor = useCallback(() => {
		setMetadataEditorOpened(true);
	}, [setMetadataEditorOpened]);

	const onOpenSettings = useCallback(() => {
		setSettingsDialogOpened(true);
	}, [setSettingsDialogOpened]);

	const onOpenLatencyTest = useCallback(() => {
		store.set(latencyTestDialogAtom, true);
	}, [store]);

	const onOpenGitHub = useCallback(async () => {
		if (import.meta.env.TAURI_ENV_PLATFORM) {
			await open("https://github.com/Steve-xmh/amll-ttml-tool");
		} else {
			window.open("https://github.com/Steve-xmh/amll-ttml-tool");
		}
	}, []);

	const onOpenWiki = useCallback(async () => {
		if (import.meta.env.TAURI_ENV_PLATFORM) {
			await open("https://github.com/Steve-xmh/amll-ttml-tool/wiki");
		} else {
			window.open("https://github.com/Steve-xmh/amll-ttml-tool/wiki");
		}
	}, []);

	const onUndo = useCallback(() => {
		store.set(undoLyricLinesAtom);
	}, [store]);
	const undoKey = useKeyBindingAtom(keyUndoAtom, onUndo, [onUndo]);

	const onRedo = useCallback(() => {
		store.set(redoLyricLinesAtom);
	}, [store]);
	const redoKey = useKeyBindingAtom(keyRedoAtom, onRedo, [onRedo]);

	const onUnselectAll = useCallback(() => {
		const immerSelectedLinesAtom = withImmer(selectedLinesAtom);
		const immerSelectedWordsAtom = withImmer(selectedWordsAtom);
		store.set(immerSelectedLinesAtom, (old) => {
			old.clear();
		});
		store.set(immerSelectedWordsAtom, (old) => {
			old.clear();
		});
	}, [store]);
	const unselectAllLinesKey = useKeyBindingAtom(
		keySelectAllAtom,
		onUnselectAll,
		[onUnselectAll],
	);

	const onSelectAll = useCallback(() => {
		const lines = store.get(lyricLinesAtom).lyricLines;
		const selectedLineIds = store.get(selectedLinesAtom);
		const selectedLines = lines.filter((l) => selectedLineIds.has(l.id));
		const selectedWordIds = store.get(selectedWordsAtom);
		const selectedWords = lines
			.flatMap((l) => l.words)
			.filter((w) => selectedWordIds.has(w.id));
		if (selectedWords.length > 0) {
			const tmpWordIds = new Set(selectedWordIds);
			for (const selLine of selectedLines) {
				for (const word of selLine.words) {
					tmpWordIds.delete(word.id);
				}
			}
			if (tmpWordIds.size === 0) {
				// 选中所有单词
				store.set(
					selectedWordsAtom,
					new Set(selectedLines.flatMap((line) => line.words.map((w) => w.id))),
				);
				return;
			}
		} else {
			// 选中所有歌词行
			store.set(
				selectedLinesAtom,
				new Set(store.get(lyricLinesAtom).lyricLines.map((l) => l.id)),
			);
		}
		const sel = window.getSelection();
		if (sel) {
			if (sel.empty) {
				// Chrome
				sel.empty();
			} else if (sel.removeAllRanges) {
				// Firefox
				sel.removeAllRanges();
			}
		}
	}, [store]);
	const selectAllLinesKey = useKeyBindingAtom(keySelectAllAtom, onSelectAll, [
		onSelectAll,
	]);

	const onSelectInverted = useCallback(() => {}, []);
	const selectInvertedLinesKey = useKeyBindingAtom(
		keySelectInvertedAtom,
		onSelectInverted,
		[onSelectInverted],
	);

	const onSelectWordsOfMatchedSelection = useCallback(() => {}, []);
	const selectWordsOfMatchedSelectionKey = useKeyBindingAtom(
		keySelectWordsOfMatchedSelectionAtom,
		onSelectWordsOfMatchedSelection,
		[onSelectWordsOfMatchedSelection],
	);

	const onDeleteSelection = useCallback(() => {
		const selectedWordIds = store.get(selectedWordsAtom);
		const selectedLineIds = store.get(selectedLinesAtom);
		log("deleting selections", selectedWordIds, selectedLineIds);
		if (selectedWordIds.size === 0) {
			// 删除选中的行
			editLyricLines((prev) => {
				prev.lyricLines = prev.lyricLines.filter(
					(l) => !selectedLineIds.has(l.id),
				);
			});
		} else {
			// 删除选中的单词
			editLyricLines((prev) => {
				for (const line of prev.lyricLines) {
					line.words = line.words.filter((w) => !selectedWordIds.has(w.id));
				}
			});
		}
		store.set(selectedWordsAtom, new Set());
		store.set(selectedLinesAtom, new Set());
	}, [store, editLyricLines]);
	const deleteSelectionKey = useKeyBindingAtom(
		keyDeleteSelectionAtom,
		onDeleteSelection,
		[onDeleteSelection],
	);

	const { config: segmentationConfig } = useSegmentationConfig();

	const onAutoSegment = useCallback(() => {
		editLyricLines((draft) => {
			draft.lyricLines = segmentLyricLines(
				draft.lyricLines,
				segmentationConfig,
			);
		});
	}, [editLyricLines, segmentationConfig]);

	const onOpenTimeShift = useCallback(() => {
		setTimeShiftDialog(true);
	}, [setTimeShiftDialog]);

	const onSyncLineTimestamps = useCallback(() => {
		const action = () => {
			editLyricLines((draft) => {
				for (let i = 0; i < draft.lyricLines.length; i++) {
					const line = draft.lyricLines[i];
					if (line.words.length === 0) continue;

					let startTime = line.words[0].startTime;
					let endTime = line.words[line.words.length - 1].endTime;

					// 同步背景人声行
					if (i + 1 < draft.lyricLines.length) {
						const nextLine = draft.lyricLines[i + 1];
						if (nextLine.isBG && nextLine.words.length > 0) {
							const nextLineStart = nextLine.words[0].startTime;
							const nextLineEnd =
								nextLine.words[nextLine.words.length - 1].endTime;
							startTime = Math.min(startTime, nextLineStart);
							endTime = Math.max(endTime, nextLineEnd);
						}
					}

					line.startTime = startTime;
					line.endTime = endTime;
				}
			});
		};

		setConfirmDialog({
			open: true,
			title: t("confirmDialog.syncLineTimestamps.title", "确认同步行时间戳"),
			description: t(
				"confirmDialog.syncLineTimestamps.description",
				"此操作将根据每行单词的时间戳自动同步所有行的起始和结束时间为第一个和最后一个音节的开始和结束时间。确定要继续吗？",
			),
			onConfirm: action,
		});
	}, [editLyricLines, setConfirmDialog, t]);

	const onOpenDistributeRomanization = useCallback(() => {
		setDistributeRomanizationDialog(true);
	}, [setDistributeRomanizationDialog]);

	const onCheckRomanizationWarnings = useCallback(() => {
		editLyricLines((draft) => {
			for (const line of draft.lyricLines) {
				applyRomanizationWarnings(line.words);
			}
		});
	}, [editLyricLines]);

	return (
		<Flex
			p="2"
			pr="0"
			align="center"
			gap="2"
			style={{
				whiteSpace: "nowrap",
			}}
		>
			{showHomeButton ? (
				<HomeMenu
					newFileKey={newFileKey}
					openFileKey={openFileKey}
					saveFileKey={saveFileKey}
					undoKey={undoKey}
					redoKey={redoKey}
					selectAllLinesKey={selectAllLinesKey}
					unselectAllLinesKey={unselectAllLinesKey}
					selectInvertedLinesKey={selectInvertedLinesKey}
					selectWordsOfMatchedSelectionKey={selectWordsOfMatchedSelectionKey}
					deleteSelectionKey={deleteSelectionKey}
					undoDisabled={!undoLyricLines.canUndo}
					redoDisabled={!undoLyricLines.canRedo}
					onNewFile={onNewFile}
					onOpenFile={onOpenFile}
					onOpenFileFromClipboard={onOpenFileFromClipboard}
					onSaveFile={onSaveFile}
					onOpenHistoryRestore={() => setHistoryRestoreDialog(true)}
					onSaveFileToClipboard={onSaveFileToClipboard}
					onSubmitToAMLLDB={onSubmitToAMLLDB}
					onUndo={onUndo}
					onRedo={onRedo}
					onSelectAll={onSelectAll}
					onUnselectAll={onUnselectAll}
					onSelectInverted={onSelectInverted}
					onSelectWordsOfMatchedSelection={onSelectWordsOfMatchedSelection}
					onDeleteSelection={onDeleteSelection}
					onOpenTimeShift={onOpenTimeShift}
					onOpenMetadataEditor={onOpenMetadataEditor}
					onOpenSettings={onOpenSettings}
					onAutoSegment={onAutoSegment}
					onOpenAdvancedSegmentation={() => setAdvancedSegmentationDialog(true)}
					onSyncLineTimestamps={onSyncLineTimestamps}
					onOpenDistributeRomanization={onOpenDistributeRomanization}
					onCheckRomanizationWarnings={onCheckRomanizationWarnings}
					onOpenLatencyTest={onOpenLatencyTest}
					onOpenGitHub={onOpenGitHub}
					onOpenWiki={onOpenWiki}
				/>
			) : (
				<Toolbar.Root>
					<FileMenu
						variant="toolbar"
						newFileKey={newFileKey}
						openFileKey={openFileKey}
						saveFileKey={saveFileKey}
						onNewFile={onNewFile}
						onOpenFile={onOpenFile}
						onOpenFileFromClipboard={onOpenFileFromClipboard}
						onSaveFile={onSaveFile}
						onOpenHistoryRestore={() => setHistoryRestoreDialog(true)}
						onSaveFileToClipboard={onSaveFileToClipboard}
						onSubmitToAMLLDB={onSubmitToAMLLDB}
						buttonStyle={{
							borderTopRightRadius: "0",
							borderBottomRightRadius: "0",
							marginRight: "0px",
						}}
					/>
					<EditMenu
						variant="toolbar"
						undoKey={undoKey}
						redoKey={redoKey}
						selectAllLinesKey={selectAllLinesKey}
						unselectAllLinesKey={unselectAllLinesKey}
						selectInvertedLinesKey={selectInvertedLinesKey}
						selectWordsOfMatchedSelectionKey={selectWordsOfMatchedSelectionKey}
						deleteSelectionKey={deleteSelectionKey}
						undoDisabled={!undoLyricLines.canUndo}
						redoDisabled={!undoLyricLines.canRedo}
						onUndo={onUndo}
						onRedo={onRedo}
						onSelectAll={onSelectAll}
						onUnselectAll={onUnselectAll}
						onSelectInverted={onSelectInverted}
						onSelectWordsOfMatchedSelection={onSelectWordsOfMatchedSelection}
						onDeleteSelection={onDeleteSelection}
						onOpenTimeShift={onOpenTimeShift}
						onOpenMetadataEditor={onOpenMetadataEditor}
						onOpenSettings={onOpenSettings}
						triggerStyle={{
							borderRadius: "0",
							marginRight: "0px",
						}}
					/>
					<ToolMenu
						variant="toolbar"
						onAutoSegment={onAutoSegment}
						onOpenAdvancedSegmentation={() => setAdvancedSegmentationDialog(true)}
						onSyncLineTimestamps={onSyncLineTimestamps}
						onOpenDistributeRomanization={onOpenDistributeRomanization}
						onCheckRomanizationWarnings={onCheckRomanizationWarnings}
						onOpenLatencyTest={onOpenLatencyTest}
						triggerStyle={{
							borderRadius: "0",
							marginRight: "0px",
						}}
					/>
					<HelpMenu
						variant="toolbar"
						onOpenGitHub={onOpenGitHub}
						onOpenWiki={onOpenWiki}
						buttonStyle={{
							borderTopLeftRadius: "0",
							borderBottomLeftRadius: "0",
						}}
					/>
				</Toolbar.Root>
			)}
			<Box style={{ marginLeft: "16px" }}>
				<HeaderFileInfo />
			</Box>
		</Flex>
	);
};
