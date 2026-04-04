import {
	type LyricLine,
	stringifyAss,
	stringifyEslrc,
	stringifyLrc,
	stringifyLys,
	stringifyQrc,
	stringifyYrc,
} from "@applemusic-like-lyrics/lyric";
import { DropdownMenu } from "@radix-ui/themes";
import { useSetAtom, useStore } from "jotai";
import { useTranslation } from "react-i18next";
import saveFile from "save-file";
import { useFileOpener } from "$/hooks/useFileOpener.ts";
import {
	importFromLRCLIBDialogAtom,
	importFromTextDialogAtom,
} from "$/states/dialogs.ts";
import { lyricLinesAtom, saveFileNameAtom } from "$/states/main.ts";
import { error } from "$/utils/logging.ts";

export const ImportExportLyric = () => {
	const store = useStore();
	const setImportFromTextDialog = useSetAtom(importFromTextDialogAtom);
	const setImportFromLRCLIBDialog = useSetAtom(importFromLRCLIBDialogAtom);
	const { openFile } = useFileOpener();
	const { t } = useTranslation();

	const onImportLyric = (extension: string) => {
		const inputEl = document.createElement("input");
		inputEl.type = "file";
		inputEl.accept = `.${extension},*/*`;
		inputEl.addEventListener(
			"change",
			() => {
				const file = inputEl.files?.[0];
				if (!file) return;

				openFile(file, extension);
			},
			{
				once: true,
			},
		);
		inputEl.click();
	};
	const onExportLyric =
		(stringifier: (lines: LyricLine[]) => string, extension: string) =>
		async () => {
			const lyricState = store.get(lyricLinesAtom);
			const lyric = lyricState.lyricLines;
			const metadata = lyricState.metadata;

			const songwriter = metadata.find((m) => m.key === "songwriter");
			if (!songwriter || songwriter.value.every((v) => !v.trim())) {
				const confirm = window.confirm(
					t(
						"confirmDialog.noSongwriter.description",
						"The song has no songwriters. Do you want to continue saving?",
					),
				);
				if (!confirm) return;
			}

			const lyricForExport = lyric.map((line) => ({
				...line,
				startTime: Math.round(line.startTime),
				endTime: Math.round(line.endTime),
				words: line.words.map((word) => ({
					...word,
					startTime: Math.round(word.startTime),
					endTime: Math.round(word.endTime),
				})),
			}));
			const saveFileName = store.get(saveFileNameAtom);
			const baseName = saveFileName.replace(/\.[^.]*$/, "");
			const fileName = `${baseName}.${extension}`;
			try {
				const data = stringifier(lyricForExport);
				const b = new Blob([data], { type: "text/plain" });
				await saveFile(b, fileName);
			} catch (e) {
				error(`Failed to export lyric with format "${extension}"`, e);
			}
		};

	return (
		<>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{t("topBar.menu.importLyric.import", "导入歌词...")}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<DropdownMenu.Item onClick={() => setImportFromTextDialog(true)}>
						{t("topBar.menu.importLyric.fromPlainText", "从纯文本导入")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={() => setImportFromLRCLIBDialog(true)}>
						{t("topBar.menu.importLyric.fromLRCLIB", "从 LRCLIB 导入...")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={() => onImportLyric("lrc")}>
						{t("topBar.menu.importLyric.fromLyRiC", "从 LyRiC 文件导入")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={() => onImportLyric("eslrc")}>
						{t("topBar.menu.importLyric.fromESLyRiC", "从 ESLyRiC 文件导入")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={() => onImportLyric("qrc")}>
						{t("topBar.menu.importLyric.fromQRC", "从 QRC 文件导入")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={() => onImportLyric("yrc")}>
						{t("topBar.menu.importLyric.fromYRC", "从 YRC 文件导入")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={() => onImportLyric("lys")}>
						{t(
							"topBar.menu.importLyric.fromLrcfySylb",
							"从 Lyricify Syllable 文件导入",
						)}
					</DropdownMenu.Item>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{t("topBar.menu.exportLyric.export", "导出歌词...")}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<DropdownMenu.Item onClick={onExportLyric(stringifyLrc, "lrc")}>
						{t("topBar.menu.exportLyric.toLyRiC", "导出到 LyRiC")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={onExportLyric(stringifyEslrc, "lrc")}>
						{t("topBar.menu.exportLyric.toESLyRiC", "导出到 ESLyRiC")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={onExportLyric(stringifyQrc, "qrc")}>
						{t("topBar.menu.exportLyric.toQRC", "导出到 QRC")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={onExportLyric(stringifyYrc, "yrc")}>
						{t("topBar.menu.exportLyric.toYRC", "导出到 YRC")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={onExportLyric(stringifyLys, "lys")}>
						{t(
							"topBar.menu.exportLyric.toLrcfySylb",
							"导出到 Lyricify Syllable",
						)}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={onExportLyric(stringifyAss, "ass")}>
						{t("topBar.menu.exportLyric.toASS", "导出到 ASS 字幕")}
					</DropdownMenu.Item>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		</>
	);
};
