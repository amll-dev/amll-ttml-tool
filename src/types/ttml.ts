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

import type {
	LyricLine as AMLLLyricLine,
	LyricWord as AMLLLyricWord,
} from "@applemusic-like-lyrics/lyric";
import { uid } from "uid";

export interface TTMLMetadata {
	key: string;
	value: string[];
	error?: boolean;
}

export interface TTMLVocalTag {
	key: string;
	value: string;
}

export interface TTMLLyric {
	metadata: TTMLMetadata[];
	lyricLines: LyricLine[];
	vocalTags?: TTMLVocalTag[];
}

export interface LyricWord extends AMLLLyricWord {
	// 用来确定唯一一个单词的标识符，导出时不会保存
	id: string;
	obscene: boolean;
	emptyBeat: number;
	romanWarning?: boolean;
}

export const newLyricWord = (): LyricWord => ({
	id: uid(),
	startTime: 0,
	endTime: 0,
	word: "",
	obscene: false,
	emptyBeat: 0,
	romanWord: "",
});

export interface LyricLine extends AMLLLyricLine {
	// 用来确定唯一一个行的标识符，导出时不会保存
	id: string;
	words: LyricWord[];
	// translatedLyric: string;
	// romanLyric: string;
	// isBG: boolean;
	// isDuet: boolean;
	// startTime: number;
	// endTime: number;
	ignoreSync: boolean;
	vocal?: string | string[];
}

export const newLyricLine = (): LyricLine => ({
	id: uid(),
	words: [],
	translatedLyric: "",
	romanLyric: "",
	isBG: false,
	isDuet: false,
	startTime: 0,
	endTime: 0,
	ignoreSync: false,
	vocal: [],
});
