import { atomWithStorage } from "jotai/utils";

export enum SyncJudgeMode {
	FirstKeyDownTime = "first-keydown-time",
	FirstKeyDownTimeLegacy = "first-keydown-time-legacy",
	LastKeyUpTime = "last-keyup-time",
	MiddleKeyTime = "middle-key-time",
}

export enum LayoutMode {
	Simple = "simple",
	Advance = "advance",
}

export const latencyTestBPMAtom = atomWithStorage("latencyTestBPM", 120);

export const syncJudgeModeAtom = atomWithStorage(
	"syncJudgeMode",
	SyncJudgeMode.FirstKeyDownTime,
);

export const layoutModeAtom = atomWithStorage("layoutMode", LayoutMode.Simple);

export const showWordRomanizationInputAtom = atomWithStorage(
	"showWordRomanizationInput",
	false,
);

export const displayRomanizationInSyncAtom = atomWithStorage(
	"displayRomanizationInSync",
	false,
);

export const showLineTranslationAtom = atomWithStorage(
	"showLineTranslation",
	true,
);

export const showLineRomanizationAtom = atomWithStorage(
	"showLineRomanization",
	true,
);

export const hideSubmitAMLLDBWarningAtom = atomWithStorage(
	"hideSubmitAMLLDBWarning",
	false,
);
export const generateNameFromMetadataAtom = atomWithStorage(
	"generateNameFromMetadata",
	true,
);

export const autosaveEnabledAtom = atomWithStorage("autosaveEnabled", true);
export const autosaveIntervalAtom = atomWithStorage("autosaveInterval", 10);
export const autosaveLimitAtom = atomWithStorage("autosaveLimit", 10);

export const showTimestampsAtom = atomWithStorage("showTimestamps", true);

export const highlightActiveWordAtom = atomWithStorage(
	"highlightActiveWord",
	true,
);

export const highlightErrorsAtom = atomWithStorage("highlightErrors", false);

export const smartFirstWordAtom = atomWithStorage("smartFirstWord", false);
export const smartLastWordAtom = atomWithStorage("smartLastWord", false);

export const enableAutoRomanizationPredictionAtom = atomWithStorage(
	"enableAutoRomanizationPrediction",
	false,
);

export const enableColorFeaturesAtom = atomWithStorage(
	"enableColorFeatures",
	false,
);
