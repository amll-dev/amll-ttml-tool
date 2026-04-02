// 打轴设置

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export interface Callback<Args extends unknown[], Result = void> {
	onEmit?: (...args: Args) => Result;
}

const c = <Args extends unknown[], Result = void>(
	_onEmit: (...args: Args) => Result,
): Callback<Args, Result> => ({});

export const showTouchSyncPanelAtom = atomWithStorage("touchSyncPanel", false);
export const visualizeTimestampUpdateAtom = atomWithStorage(
	"visualizeTimestampUpdate",
	false,
);
export const syncTimeOffsetAtom = atomWithStorage("syncTimeOffset", 0);

export const enableUpcomingWordHighlightAtom = atomWithStorage(
	"enableUpcomingWordHighlight",
	true,
);
export const upcomingWordHighlightThresholdAtom = atomWithStorage(
	"upcomingWordHighlightThreshold",
	500,
);
export const upcomingWordHighlightColorAtom = atomWithStorage(
	"upcomingWordHighlightColor",
	"var(--green-9)",
);

export const currentEmptyBeatAtom = atom(0);
export const smartFirstWordActiveIdAtom = atom<string | null>(null);

export const callbackSyncStartAtom = atom(c(() => {}));
export const callbackSyncNextAtom = atom(c(() => {}));
export const callbackSyncEndAtom = atom(c(() => {}));
