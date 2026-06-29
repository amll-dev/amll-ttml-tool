import {
	audioEngineStateAtom,
	audioErrorAtom,
	audioPlayingAtom,
	auditionTimeAtom,
	currentDurationAtom,
	currentTimeAtom,
	loadedAudioAtom,
} from "$/modules/audio/states/index.ts";
import { FFmpegAudioEngine } from "$/modules/ffmpeg/index.ts";
import workerUrl from "$/modules/ffmpeg/worker/decoder.worker.ts?worker&url";
import ffmpegWasmUrl from "$/modules/ffmpeg/worker/wasm/ffmpeg_wasm.wasm?url";
import workletUrl from "$/modules/ffmpeg/worklet/audio.worklet.ts?worker&url";
import soundtouchWasmUrl from "$/modules/ffmpeg/worklet/wasm/soundtouch_bg.wasm?url";
import { globalStore } from "$/states/store.ts";
import type { TTMLMetadata } from "$/types/ttml";

let auditionRafId: number | null = null;

class AudioEngineWrapper extends EventTarget {
	public engine: FFmpegAudioEngine;
	private timeUpdateRafId: number | null = null;

	//#region Audio context basics
	private _ctx: AudioContext | null = null;
	get ctx() {
		if (this._ctx) return this._ctx;
		this._ctx = new AudioContext({
			latencyHint: "interactive",
		});
		return this._ctx;
	}

	private gainNode: GainNode | null = null;
	private get gain() {
		if (this.gainNode) return this.gainNode;
		this.gainNode = this.ctx.createGain();
		this.gainNode.gain.value = 0.5;
		this.gainNode.connect(this.ctx.destination);
		return this.gainNode;
	}
	//#endregion

	constructor() {
		super();

		this.engine = new FFmpegAudioEngine({
			audioContext: this.ctx,
			gainNode: this.gain,
			assets: {
				workerUrl,
				workletUrl,
				ffmpegWasmUrl,
				soundtouchWasmUrl,
			},
		});

		this.setupEngineListeners();
	}

	private startTimeUpdateLoop = () => {
		this.stopTimeUpdateLoop();

		const loop = () => {
			globalStore.set(currentTimeAtom, (this.engine.currentTime * 1000) | 0);
			this.timeUpdateRafId = requestAnimationFrame(loop);
		};
		this.timeUpdateRafId = requestAnimationFrame(loop);
	};

	private stopTimeUpdateLoop = () => {
		if (this.timeUpdateRafId !== null) {
			cancelAnimationFrame(this.timeUpdateRafId);
			this.timeUpdateRafId = null;
		}

		globalStore.set(currentTimeAtom, (this.engine.currentTime * 1000) | 0);
	};

	private setupEngineListeners() {
		this.engine.addEventListener("play", () => {
			globalStore.set(audioPlayingAtom, true);
			globalStore.set(audioEngineStateAtom, this.engine.state);
			this.startTimeUpdateLoop();
		});

		this.engine.addEventListener("pause", () => {
			globalStore.set(audioPlayingAtom, false);
			globalStore.set(audioEngineStateAtom, this.engine.state);
			this.stopTimeUpdateLoop();
		});

		this.engine.addEventListener("timeupdate", () => {
			if (!this.musicPlaying) {
				globalStore.set(currentTimeAtom, (this.engine.currentTime * 1000) | 0);
			}
		});

		this.engine.addEventListener("loadedmetadata", () => {
			globalStore.set(currentDurationAtom, (this.engine.duration * 1000) | 0);
			globalStore.set(audioEngineStateAtom, this.engine.state);
		});

		this.engine.addEventListener("ended", () => {
			globalStore.set(audioPlayingAtom, false);
			this.stopTimeUpdateLoop();
		});

		this.engine.addEventListener("error", (e) => {
			globalStore.set(audioEngineStateAtom, this.engine.state);
			globalStore.set(audioErrorAtom, e.detail.message);
			console.error("[AudioEngine] Error:", e.detail.message);
			this.stopTimeUpdateLoop();
		});
	}

	//#region Playback APIs
	get musicLoaded() {
		return (
			this.engine.state === "ready" ||
			this.engine.state === "playing" ||
			this.engine.state === "paused"
		);
	}

	get musicPlaying() {
		return this.engine.state === "playing";
	}

	get musicCurrentTime() {
		return this.engine.currentTime;
	}

	get musicDuration() {
		return this.engine.duration;
	}

	get musicPlayBackRate() {
		return this.engine.rate;
	}
	set musicPlayBackRate(v: number) {
		this.engine.tempo = v;
	}

	get volume() {
		return this.engine.volume;
	}
	set volume(v: number) {
		this.engine.volume = v;
		this.dispatchEvent(new Event("volume-change"));
	}

	get ctxCurrentTime() {
		return this.ctx.currentTime;
	}
	get ctxBaseLatency() {
		return this.ctx.baseLatency;
	}
	get ctxOutputLatency() {
		return this.ctx.outputLatency;
	}

	playNode(node: AudioScheduledSourceNode, when?: number, stop?: number) {
		node.connect(this.gain);
		node.start(when);
		node.addEventListener("ended", () => node.disconnect());
		if (stop) node.stop(stop);
	}

	private clampMusicTime(offset: number) {
		if (!Number.isFinite(offset)) return 0;
		return Math.max(0, Math.min(offset, this.musicDuration || offset));
	}

	seekMusic(offset: number) {
		this.engine.currentTime = this.clampMusicTime(offset);
		if (!this.musicPlaying) {
			globalStore.set(currentTimeAtom, (this.engine.currentTime * 1000) | 0);
		}
	}

	async resumeMusic() {
		await this.engine.play();
	}

	pauseMusic() {
		this.engine.pause();
	}

	/**
	 * 试听一个音频片段
	 *
	 * @param startTimeInSeconds 音频片段的开始时间
	 * @param endTimeInSeconds 音频片段的结束时间
	 * @returns
	 */
	auditionRange(startTimeInSeconds: number, endTimeInSeconds: number) {
		if (!this.musicLoaded) {
			console.warn("音频未加载, 无法预览音频");
			return;
		}

		if (auditionRafId) {
			cancelAnimationFrame(auditionRafId);
			auditionRafId = null;
		}
		globalStore.set(auditionTimeAtom, null);

		const durationInSeconds = endTimeInSeconds - startTimeInSeconds;
		if (durationInSeconds <= 0) return;

		this.engine.currentTime = startTimeInSeconds;
		this.engine.play();

		const checkLoop = () => {
			if (!this.musicPlaying) {
				globalStore.set(auditionTimeAtom, null);
				auditionRafId = null;
				return;
			}

			const currentAuditionTime = this.engine.currentTime;
			if (currentAuditionTime >= endTimeInSeconds) {
				this.engine.pause();
				this.engine.currentTime = endTimeInSeconds;
				globalStore.set(currentTimeAtom, (endTimeInSeconds * 1000) | 0);
				globalStore.set(auditionTimeAtom, null);
				auditionRafId = null;
			} else {
				globalStore.set(auditionTimeAtom, currentAuditionTime);
				auditionRafId = requestAnimationFrame(checkLoop);
			}
		};

		auditionRafId = requestAnimationFrame(checkLoop);
	}
	//#endregion

	//#region Load
	async loadMusic(src: File): Promise<TTMLMetadata[]> {
		if (this.musicLoaded) {
			this.pauseMusic();
		}
		globalStore.set(audioEngineStateAtom, "loading");

		globalStore.set(loadedAudioAtom, src);
		await this.engine.loadFile(src);

		return this.mapFFmpegMetadataToTTML(this.engine.metadata);
	}

	private mapFFmpegMetadataToTTML(raw: Record<string, string>): TTMLMetadata[] {
		const mappingRules: Record<string, string> = {
			title: "musicName",
			artist: "artists",
			album: "album",
			composer: "songwriter",
			isrc: "isrc",
		};

		const result: TTMLMetadata[] = [];
		for (const [rawKey, rawValue] of Object.entries(raw)) {
			const targetKey = mappingRules[rawKey.toLowerCase()];
			if (targetKey && rawValue.trim() !== "") {
				const values = rawValue
					.split(/[\n,;/，；、|\\]/)
					.map((s) => s.trim())
					.filter(Boolean);

				if (values.length > 0) {
					result.push({
						key: targetKey,
						value: Array.from(new Set(values)),
					});
				}
			}
		}
		return result;
	}
	//#endregion
}

export const audioEngine = new AudioEngineWrapper();
