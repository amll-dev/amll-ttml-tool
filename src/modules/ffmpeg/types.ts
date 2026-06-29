/**
 * Configuration required to initialize the audio engine.
 */
export interface EngineConfig {
	/**
	 * The AudioContext injected by the host environment.
	 */
	audioContext: AudioContext;

	/**
	 * Injected GainNode for volume control
	 */
	gainNode?: GainNode;

	/**
	 * URLs for external static resources, typically resolved by the host's build tool.
	 */
	assets: {
		workerUrl: string;
		workletUrl: string;
		ffmpegWasmUrl: string;
		soundtouchWasmUrl: string;
	};
}

/**
 * Represents the current playback state of the engine.
 */
export type EngineState = "idle" | "loading" | "ready" | "playing" | "paused";

/**
 * Structure for engine-level errors.
 */
export interface EngineError {
	code: number;
	message: string;
}

/**
 * Structure for extracted cover art data.
 */
export interface PlayerCover {
	bytes: ArrayBuffer;
	mime: string | null;
}

/**
 * Event map matching the DOM CustomEvent style.
 */
export interface EngineEventMap {
	play: CustomEvent<void>;
	pause: CustomEvent<void>;
	loadedmetadata: CustomEvent<void>;
	timeupdate: CustomEvent<void>;
	ended: CustomEvent<void>;
	error: CustomEvent<EngineError>;
}
