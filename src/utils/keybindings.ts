import { atom, type createStore, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { type DependencyList, useEffect } from "react";
import { warn } from "./logging.ts";

export type KeyBindingsConfig = string[];
export interface KeyBindingEvent {
	downTime: number;
	downTimeOffset: number;
}
export type KeyBindingCallback = (evt: KeyBindingEvent) => void;

/**
 * 触发模式枚举
 */
export enum KeyBindingTriggerMode {
	KeyDown = "keydown",
	KeyUp = "keyup",
}

/**
 * 用于在事件监听器中快速读取当前模式
 */
let currentTriggerMode: KeyBindingTriggerMode = KeyBindingTriggerMode.KeyDown;

// TODO: 把这个组件变成 hook 这样就可以直接读取 atom 而不是手动解析 localStorage 了
if (typeof localStorage !== "undefined") {
	const raw = localStorage.getItem("keyBindingTriggerMode");
	if (raw) {
		try {
			const parsed = JSON.parse(raw);
			currentTriggerMode = parsed as KeyBindingTriggerMode;
		} catch {
			currentTriggerMode = raw as KeyBindingTriggerMode;
		}
	}
}

if (
	currentTriggerMode !== KeyBindingTriggerMode.KeyDown &&
	currentTriggerMode !== KeyBindingTriggerMode.KeyUp
) {
	currentTriggerMode = KeyBindingTriggerMode.KeyDown;
}

const internalTriggerModeAtom = atomWithStorage<KeyBindingTriggerMode>(
	"keyBindingTriggerMode",
	currentTriggerMode,
	undefined,
	{ getOnInit: true },
);

export const keyBindingTriggerModeAtom = atom(
	(get) => get(internalTriggerModeAtom),
	(_get, set, newValue: KeyBindingTriggerMode) => {
		set(internalTriggerModeAtom, newValue);
		currentTriggerMode = newValue;
	},
);

export function formatKeyBindings(cfg: KeyBindingsConfig): string {
	return cfg
		.map((key) => {
			if (key.startsWith("Key")) return key.substring(3);
			if (key.endsWith("Right")) return key.substring(0, key.length - 5);
			if (key.endsWith("Left")) return key.substring(0, key.length - 4);
			if (navigator.userAgent.includes("Mac")) {
				if (key === "Control") return "⌃";
				if (key === "Alt") return "⌥";
				if (key === "Shift") return "⇧";
				if (key === "Meta") return "⌘";
				if (key === "Backspace") return "⌫";
			} else if (navigator.userAgent.includes("Windows")) {
				if (key.startsWith("Control")) return "Ctrl";
				if (key === "Meta") return "Win";
			}
			return key;
		})
		.join(navigator.userAgent.includes("Mac") ? " " : " + ");
}

export function formatKeyBindingsAsArray(cfg: KeyBindingsConfig): string[] {
	return cfg.map((key) => {
		if (key.startsWith("Key")) return key.substring(3);
		if (navigator.userAgent.includes("Mac")) {
			if (key === "Control") return "⌃";
			if (key === "Alt") return "⌥";
			if (key === "Shift") return "⇧";
			if (key === "Meta") return "⌘";
		} else if (navigator.userAgent.includes("Windows")) {
			if (key.startsWith("Control")) return "Ctrl";
			if (key === "Meta") return "Win";
		}
		return key;
	});
}

export const RESET_KEYBINDING = Symbol("reset-keybinding");

export function atomWithKeybindingStorage(
	storageName: string,
	defaultValue: KeyBindingsConfig,
) {
	const key = `keybindings:${storageName}`;
	const keyAtom = atomWithStorage(key, defaultValue);
	return atom(
		(get) => get(keyAtom),
		async (_get, set, update?: KeyBindingsConfig | typeof RESET_KEYBINDING) => {
			if (update) {
				if (update === RESET_KEYBINDING) set(keyAtom, defaultValue);
				else set(keyAtom, update);
			} else {
				try {
					set(keyAtom, await recordShortcut());
				} catch {
					set(keyAtom, defaultValue);
				}
			}
		},
	);
}

const blackListedKeys = new Set(["Bracket", "Arrow"]);
function removeSideOfKeyCode(code: string) {
	for (const key of blackListedKeys) {
		if (code.startsWith(key)) return code;
	}
	if (code.endsWith("Left")) return code.substring(0, code.length - 4);
	if (code.endsWith("Right")) return code.substring(0, code.length - 5);
	return code;
}

const pressingKeys = new Set<string>();
const registeredKeyBindings = new Map<string, Set<KeyBindingCallback>>();
let downTime = 0;

function triggerCallbacks(
	joinedKey: string,
	evt: KeyboardEvent,
	targetTime: number,
) {
	const callbacks = registeredKeyBindings.get(joinedKey);
	if (callbacks) {
		const downTimeOffset = evt.timeStamp - targetTime;
		const e: KeyBindingEvent = {
			downTime: targetTime,
			downTimeOffset,
		};
		for (const cb of callbacks) {
			try {
				cb(e);
			} catch (err) {
				warn("Error in key binding ", joinedKey, "callback", err);
			}
		}
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();
	}
}

window.addEventListener("keydown", (evt) => {
	if (evt.repeat) return;
	if (isEditing(evt)) {
		pressingKeys.clear();
		return;
	}
	if (pressingKeys.size === 0) {
		downTime = evt.timeStamp;
	}

	const code = removeSideOfKeyCode(evt.code);

	// 阻止空格滚动
	if (
		(evt.code === "Space" || evt.code === "Home" || evt.code === "End") &&
		evt.target === document.body
	) {
		evt.preventDefault();
		evt.stopPropagation();
	}

	pressingKeys.add(code);

	if (currentTriggerMode === KeyBindingTriggerMode.KeyDown) {
		const joined = [...pressingKeys].join(" + ").trim();
		triggerCallbacks(joined, evt, downTime);
	}
});

window.addEventListener("keyup", (evt) => {
	if (isEditing(evt)) {
		pressingKeys.clear();
		return;
	}

	const code = removeSideOfKeyCode(evt.code);

	if (currentTriggerMode === KeyBindingTriggerMode.KeyUp) {
		const joined = [...pressingKeys].join(" + ").trim();
		triggerCallbacks(joined, evt, downTime);
	}

	pressingKeys.delete(code);
});
window.addEventListener("blur", () => {
	pressingKeys.clear();
});
window.addEventListener("focus", () => {
	pressingKeys.clear();
});

export function forceInvokeKeyBindingAtom(
	store: ReturnType<typeof createStore>,
	thisAtom: ReturnType<typeof atomWithKeybindingStorage>,
	evt?: MouseEvent | KeyboardEvent | TouchEvent,
) {
	const keyBinding = store.get(thisAtom);
	const joined = keyBinding.join(" + ").trim();
	const callbacks = registeredKeyBindings.get(joined);

	if (callbacks) {
		const downTimeOffset = 0;

		const e: KeyBindingEvent = {
			downTime,
			downTimeOffset,
		};
		for (const cb of callbacks) {
			try {
				cb(e);
			} catch (err) {
				warn("Error in key binding ", joined, "callback", err);
			}
		}
		evt?.preventDefault();
		evt?.stopPropagation();
		evt?.stopImmediatePropagation();
	}
}

// From https://wangchujiang.com/hotkeys-js/
export function isEditing(event: KeyboardEvent | MouseEvent) {
	const checkElement = (target: HTMLElement | null) => {
		const tagName = target?.tagName;
		return (
			target?.isContentEditable ||
			tagName === "INPUT" ||
			tagName === "SELECT" ||
			tagName === "TEXTAREA" ||
			!!currentKeyDownEvent ||
			!!currentKeyUpEvent
		);
	};
	return (
		checkElement((event.target || event.srcElement) as HTMLElement | null) ||
		checkElement(document.activeElement as HTMLElement | null)
	);
}

export function isInteracting(event: KeyboardEvent | MouseEvent) {
	const checkElement = (target: HTMLElement | null) => {
		const tagName = target?.tagName;
		return (
			target?.isContentEditable ||
			tagName === "INPUT" ||
			tagName === "SELECT" ||
			tagName === "TEXTAREA" ||
			tagName === "BUTTON" ||
			!!currentKeyDownEvent ||
			!!currentKeyUpEvent
		);
	};
	return (
		checkElement((event.target || event.srcElement) as HTMLElement | null) ||
		checkElement(document.activeElement as HTMLElement | null)
	);
}

export function registerKeyBindings(
	cfg: KeyBindingsConfig,
	callback: KeyBindingCallback,
) {
	if (cfg.length === 0) {
		return () => {};
	}
	const joined = [...cfg].join(" + ");
	let set = registeredKeyBindings.get(joined);
	if (!set) {
		set = new Set();
		registeredKeyBindings.set(joined, set);
	}
	set.add(callback);
	return () => {
		set?.delete(callback);
	};
}

export function useKeyBinding(
	cfg: KeyBindingsConfig,
	callback: KeyBindingCallback,
	deps?: DependencyList,
) {
	useEffect(() => {
		return registerKeyBindings(cfg, callback);
	}, [cfg, callback, ...(deps || [])]);
}

/**
 * @deprecated 请使用 useCommand
 */
export function useKeyBindingAtom(
	thisAtom: ReturnType<typeof atomWithKeybindingStorage>,
	callback: KeyBindingCallback,
	deps?: DependencyList,
): KeyBindingsConfig {
	const keyBindings = useAtomValue(thisAtom);
	useEffect(() => {
		return registerKeyBindings(keyBindings, callback);
	}, [keyBindings, callback, ...(deps || [])]);
	return keyBindings;
}

let currentKeyDownEvent: ((evt: KeyboardEvent) => void) | undefined;
let currentKeyUpEvent: ((evt: KeyboardEvent) => void) | undefined;

export function stopRecordingShortcut() {
	if (currentKeyDownEvent) {
		window.removeEventListener("keydown", currentKeyDownEvent);
		currentKeyDownEvent = undefined;
	}
	if (currentKeyUpEvent) {
		window.removeEventListener("keyup", currentKeyUpEvent);
		currentKeyUpEvent = undefined;
	}
}

export function recordShortcut(): Promise<KeyBindingsConfig> {
	return new Promise((resolve, reject) => {
		stopRecordingShortcut();
		const recorded = new Set<string>();
		const stack = new Set<string>();
		const onKeyDown = (evt: KeyboardEvent) => {
			recorded.add(evt.code);
			stack.add(evt.code);
			evt.preventDefault();
			evt.stopPropagation();
			evt.stopImmediatePropagation();
		};
		const onKeyUp = (evt: KeyboardEvent) => {
			stack.delete(evt.code);
			if (stack.size === 0) {
				stopRecordingShortcut();
				if (stack.has("Escape")) {
					reject(new Error("User canceled"));
				} else {
					resolve([...recorded]);
				}
			}
			evt.preventDefault();
			evt.stopPropagation();
			evt.stopImmediatePropagation();
		};
		currentKeyDownEvent = onKeyDown;
		currentKeyUpEvent = onKeyUp;
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
	});
}
