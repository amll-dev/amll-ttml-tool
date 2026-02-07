/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/Steve-xmh/amll-ttml-tool/blob/main/LICENSE
 */

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { REDO, UNDO, withHistory } from "jotai-history";
import { uid } from "uid";
import { identifyProject } from "$/modules/project/logic/project-info";
import type { TTMLLyric } from "../types/ttml";

export enum DarkMode {
	Auto = "auto",
	Light = "light",
	Dark = "dark",
}

export enum ToolMode {
	Edit = "edit",
	Sync = "sync",
	Preview = "preview",
}

export const toolModeAtom = atom(ToolMode.Edit);
export const darkModeAtom = atom(DarkMode.Auto);
export const isDarkThemeAtom = atom((get) => {
	if (get(darkModeAtom) === DarkMode.Auto) return get(autoDarkModeAtom);
	return get(darkModeAtom) === DarkMode.Dark;
});
export const autoDarkModeAtom = atom(true);

// 歌词行编辑上下文
export const lyricLinesAtom = atom({
	lyricLines: [],
	metadata: [],
} as TTMLLyric);

/**
 * @description 当前项目的唯一标识符
 *
 * - 打开应用和新建文件时会生成一个随机的 UUID
 * - 打开文件时会尝试与数据库中的历史项目进行匹配，如果匹配成功，则复用旧项目的 ID，否则生成新 ID
 */
export const projectIdAtom = atom(uid());

/**
 * @description 当前项目的显示身份信息，主要用于在 UI 上显示项目名称
 * @readonly
 */
export const projectIdentityAtom = atom((get) => {
	const lyrics = get(lyricLinesAtom);
	return identifyProject(lyrics);
});

/**
 * @description 自动保存的状态
 */
export enum SaveStatus {
	/**
	 * @description 已保存，当前编辑器的内容和数据库的一致
	 */
	Saved = "saved",
	/**
	 * @description 等待保存
	 */
	Pending = "pending",
	/**
	 * @description 正在保存
	 */
	Saving = "saving",
}

/**
 * @description 当前自动保存的状态
 */
export const saveStatusAtom = atom<SaveStatus>(SaveStatus.Saved);

/**
 * @description 上次自动保存的时间戳
 */
export const lastSavedTimeAtom = atom<number | null>(null);

export const undoableLyricLinesAtom = withHistory(lyricLinesAtom, 256);
export const isDirtyAtom = atom((get) => get(undoableLyricLinesAtom).canUndo);
export const undoLyricLinesAtom = atom(null, (_get, set) => {
	set(undoableLyricLinesAtom, UNDO);
});
export const redoLyricLinesAtom = atom(null, (_get, set) => {
	set(undoableLyricLinesAtom, REDO);
});
export const editingWordStateAtom = atom({
	wordIndex: -1,
	lineIndex: -1,
	word: "",
});
export const newLyricLinesAtom = atom(
	null,
	(
		_get,
		set,
		newState: TTMLLyric = {
			lyricLines: [],
			metadata: [],
		},
	) => {
		set(lyricLinesAtom, newState);
		set(selectedLinesAtom, new Set());
		set(selectedWordsAtom, new Set());
	},
);
export const selectedLinesAtom = atom(new Set<string>());
export const selectedWordsAtom = atom(new Set<string>());

export const saveFileNameAtom = atom("lyric.ttml");

export const showUnselectedLinesAtom = atomWithStorage(
	"showUnselectedLines",
	true,
);
export const bgLyricIgnoreSyncAtom = atom(false);

export interface EditingTimeFieldState {
	isWord: boolean;
	field: "startTime" | "endTime";
}

export const editingTimeFieldAtom = atom<EditingTimeFieldState | null>(null);

export const requestFocusAtom = atom<string | null>(null);

/**
 * @description 用于控制全局文件拖拽遮罩层的显示
 */
export const isGlobalFileDraggingAtom = atom(false);
