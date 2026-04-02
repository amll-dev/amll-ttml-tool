/**
 * @fileoverview 只用于兼容旧代码
 */

import type { WritableAtom } from "jotai";
import {
	cmdDeleteSelection,
	cmdMoveFirstWordAndPlay,
	cmdMoveLastWordAndPlay,
	cmdMoveNextLine,
	cmdMoveNextWord,
	cmdMoveNextWordAndPlay,
	cmdMovePrevLine,
	cmdMovePrevWord,
	cmdMovePrevWordAndPlay,
	cmdNewFile,
	cmdOpenAudio,
	cmdOpenFile,
	cmdPlaybackRateDown,
	cmdPlaybackRateReset,
	cmdPlaybackRateUp,
	cmdPlayPause,
	cmdRedo,
	cmdSaveFile,
	cmdSeekBackward,
	cmdSeekForward,
	cmdSelectAll,
	cmdSelectInverted,
	cmdSelectWordsOfMatchedSelection,
	cmdSwitchEditMode,
	cmdSwitchPreviewMode,
	cmdSwitchSyncMode,
	cmdSyncEnd,
	cmdSyncNext,
	cmdSyncStart,
	cmdUndo,
	cmdUnselectAll,
	cmdVolumeDown,
	cmdVolumeUp,
} from "$/modules/keyboard/commands";
import type { KeyBindingsConfig } from "$/utils/keybindings";

export type KeyBindingAtom = WritableAtom<
	KeyBindingsConfig,
	[update?: KeyBindingsConfig | undefined],
	Promise<void>
>;

export const keyNewFileAtom = cmdNewFile.atom;
export const keyOpenFileAtom = cmdOpenFile.atom;
export const keySaveFileAtom = cmdSaveFile.atom;
export const keyOpenAudioAtom = cmdOpenAudio.atom;

export const keyUndoAtom = cmdUndo.atom;
export const keyRedoAtom = cmdRedo.atom;
export const keySelectAllAtom = cmdSelectAll.atom;
export const keyUnselectAllAtom = cmdUnselectAll.atom;
export const keySelectInvertedAtom = cmdSelectInverted.atom;
export const keySelectWordsOfMatchedSelectionAtom =
	cmdSelectWordsOfMatchedSelection.atom;
export const keyDeleteSelectionAtom = cmdDeleteSelection.atom;

export const keySwitchEditModeAtom = cmdSwitchEditMode.atom;
export const keySwitchSyncModeAtom = cmdSwitchSyncMode.atom;
export const keySwitchPreviewModeAtom = cmdSwitchPreviewMode.atom;

export const keyMoveNextWordAtom = cmdMoveNextWord.atom;
export const keyMovePrevWordAtom = cmdMovePrevWord.atom;
export const keyMoveNextLineAtom = cmdMoveNextLine.atom;
export const keyMovePrevLineAtom = cmdMovePrevLine.atom;
export const keyMovePrevWordAndPlayAtom = cmdMovePrevWordAndPlay.atom;
export const keyMoveNextWordAndPlayAtom = cmdMoveNextWordAndPlay.atom;

export const keySyncStartAtom = cmdSyncStart.atom;
export const keySyncNextAtom = cmdSyncNext.atom;
export const keySyncEndAtom = cmdSyncEnd.atom;

export const keyMoveFirstWordAndPlayAtom = cmdMoveFirstWordAndPlay.atom;
export const keyMoveLastWordAndPlayAtom = cmdMoveLastWordAndPlay.atom;

export const keyPlayPauseAtom = cmdPlayPause.atom;
export const keySeekForwardAtom = cmdSeekForward.atom;
export const keySeekBackwardAtom = cmdSeekBackward.atom;
export const keyVolumeUpAtom = cmdVolumeUp.atom;
export const keyVolumeDownAtom = cmdVolumeDown.atom;
export const keyPlaybackRateUpAtom = cmdPlaybackRateUp.atom;
export const keyPlaybackRateDownAtom = cmdPlaybackRateDown.atom;
export const keyPlaybackRateResetAtom = cmdPlaybackRateReset.atom;
