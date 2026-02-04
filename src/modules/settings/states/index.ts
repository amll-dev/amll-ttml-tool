import { type DBSchema, openDB } from "idb";
import { atomWithStorage } from "jotai/utils";

interface SettingsDBSchema extends DBSchema {
	kv: {
		key: string;
		value: string;
	};
}

const SETTINGS_DB_NAME = "amll-settings-db";
const SETTINGS_DB_VERSION = 1;
const settingsDbPromise =
	typeof indexedDB === "undefined"
		? null
		: openDB<SettingsDBSchema>(SETTINGS_DB_NAME, SETTINGS_DB_VERSION, {
				upgrade(db) {
					if (!db.objectStoreNames.contains("kv")) {
						db.createObjectStore("kv");
					}
				},
			});

const customBackgroundStorage = {
	async getItem(key: string, initialValue: string | null) {
		if (!settingsDbPromise) {
			if (typeof localStorage === "undefined") return initialValue;
			const raw = localStorage.getItem(key);
			return raw ?? initialValue;
		}
		const db = await settingsDbPromise;
		const value = await db.get("kv", key);
		if (value !== undefined) return value;
		if (typeof localStorage === "undefined") return initialValue;
		const raw = localStorage.getItem(key);
		if (raw === null) return initialValue;
		let parsed: unknown = raw;
		try {
			parsed = JSON.parse(raw);
		} catch {
			parsed = raw;
		}
		if (typeof parsed === "string") {
			await db.put("kv", parsed, key);
			localStorage.removeItem(key);
			return parsed;
		}
		if (parsed === null) {
			await db.delete("kv", key);
			localStorage.removeItem(key);
			return null;
		}
		return initialValue;
	},
	async setItem(key: string, value: string | null) {
		if (!settingsDbPromise) {
			if (typeof localStorage === "undefined") return;
			if (value === null) localStorage.removeItem(key);
			else localStorage.setItem(key, value);
			return;
		}
		const db = await settingsDbPromise;
		if (value === null) await db.delete("kv", key);
		else await db.put("kv", value, key);
		if (typeof localStorage !== "undefined") {
			localStorage.removeItem(key);
		}
	},
	async removeItem(key: string) {
		if (!settingsDbPromise) {
			if (typeof localStorage !== "undefined") {
				localStorage.removeItem(key);
			}
			return;
		}
		const db = await settingsDbPromise;
		await db.delete("kv", key);
		if (typeof localStorage !== "undefined") {
			localStorage.removeItem(key);
		}
	},
};

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

export const customBackgroundImageAtom = atomWithStorage<string | null>(
	"customBackgroundImage",
	null,
	customBackgroundStorage,
	{ getOnInit: true },
);

export const customBackgroundOpacityAtom = atomWithStorage(
	"customBackgroundOpacity",
	0.4,
);

export const customBackgroundMaskAtom = atomWithStorage(
	"customBackgroundMask",
	0.2,
);

export const customBackgroundBlurAtom = atomWithStorage(
	"customBackgroundBlur",
	0,
);

export const customBackgroundBrightnessAtom = atomWithStorage(
	"customBackgroundBrightness",
	1,
);
