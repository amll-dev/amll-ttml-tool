export class AudioRenderer {
	private initCounter = 0;

	private workletNode: AudioWorkletNode | null = null;
	private gainNode: GainNode | null;
	private _isWorkletLoaded = false;
	private initPromise: Promise<void> | null = null;
	private stWasmBytes: ArrayBuffer | null = null;

	constructor(
		private audioCtx: AudioContext,
		private workletUrl: string,
		private stWasmUrl: string,
		gainNode?: GainNode,
	) {
		this.gainNode = gainNode || null;
	}

	public onMessage?: (type: string, payload?: unknown) => void;

	/**
	 * Returns true if the AudioWorklet has been completely loaded.
	 */
	public get isWorkletLoaded(): boolean {
		return this._isWorkletLoaded;
	}

	/**
	 * Ensures the AudioWorklet module is added and the node is connected.
	 */
	public async initialize(channels: number): Promise<void> {
		if (!this.stWasmBytes) {
			const resp = await fetch(this.stWasmUrl);
			this.stWasmBytes = await resp.arrayBuffer();
		}

		if (!this.initPromise) {
			this.initPromise = this.audioCtx.audioWorklet.addModule(this.workletUrl);
		}
		await this.initPromise;
		this._isWorkletLoaded = true;

		this.destroyNode();

		this.workletNode = new AudioWorkletNode(this.audioCtx, "ffmpeg-audio", {
			outputChannelCount: [channels],
		});

		if (this.gainNode) {
			this.workletNode.connect(this.gainNode);
		} else {
			this.workletNode.connect(this.audioCtx.destination);
		}
	}

	/**
	 * Sends the SharedArrayBuffer and Wasm binary to the Worklet.
	 */
	public bindQueue(
		sharedBuffer: SharedArrayBuffer,
		channels: number,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this._isWorkletLoaded || !this.workletNode) {
				return reject(new Error("Worklet not loaded"));
			}

			const currentInitId = ++this.initCounter;
			this.workletNode.port.onmessage = (event: MessageEvent) => {
				const { type, payload } = event.data;

				if (type === "INIT_DONE" && payload?.initId === currentInitId) {
					resolve();
				} else {
					this.onMessage?.(type, payload);
				}
			};

			this.workletNode.port.start();
			this.workletNode.port.postMessage({
				type: "INIT",
				payload: {
					sharedBuffer,
					channels,
					wasmBytes: this.stWasmBytes,
					initId: currentInitId,
				},
			});
		});
	}

	public setTempo(tempo: number): void {
		this.workletNode?.port.postMessage({
			type: "SET_TEMPO",
			payload: { tempo },
		});
	}

	public setPitch(pitch: number): void {
		this.workletNode?.port.postMessage({
			type: "SET_PITCH",
			payload: { pitch },
		});
	}

	public setRate(rate: number): void {
		this.workletNode?.port.postMessage({
			type: "SET_RATE",
			payload: { rate },
		});
	}

	/**
	 * Resumes the AudioContext (Required by browser autoplay policies).
	 */
	public async resumeContext(): Promise<void> {
		if (!this._isWorkletLoaded) {
			console.warn(
				"AudioRenderer: Context resumed before Worklet initialization.",
			);
		}
		if (this.audioCtx.state === "suspended") {
			await this.audioCtx.resume();
		}
	}

	/**
	 * Gets properties from the AudioContext.
	 */
	public get sampleRate(): number {
		return this.audioCtx.sampleRate;
	}

	public get maxChannels(): number {
		return this.audioCtx.destination.maxChannelCount;
	}

	/**
	 * Cleans up the audio node graph.
	 */
	public destroyNode(): void {
		if (this.workletNode) {
			this.workletNode.port.postMessage({ type: "DESTROY" });
			this.workletNode.disconnect();
			this.workletNode = null;
		}
	}
}
