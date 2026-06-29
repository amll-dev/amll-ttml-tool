export interface WorkerClientCallbacks {
	onInitDone: (payload: {
		duration: number;
		metadata: Record<string, string>;
		coverBytes: ArrayBuffer | null;
		coverMime: string | null;
	}) => void;
	onEnded: () => void;
	onError: (code: number, message: string) => void;
}

export class DecoderWorkerClient {
	private worker: Worker | null = null;

	constructor(
		private workerUrl: string,
		private callbacks: WorkerClientCallbacks,
	) {}

	public init(
		file: File,
		sampleRate: number,
		channels: number,
		sharedBuffer: SharedArrayBuffer,
		ffmpegWasmUrl: string,
	): void {
		this.destroy();

		this.worker = new Worker(this.workerUrl, { type: "module" });
		this.worker.onmessage = this.handleMessage.bind(this);
		this.worker.onerror = (e) => {
			this.callbacks.onError(4, `Worker error: ${e.message}`);
		};

		this.worker.postMessage({
			type: "INIT",
			payload: { file, sampleRate, channels, sharedBuffer, ffmpegWasmUrl },
		});
	}

	public play(): void {
		this.worker?.postMessage({ type: "PLAY" });
	}

	public pause(): void {
		this.worker?.postMessage({ type: "PAUSE" });
	}

	public seek(targetSeconds: number): void {
		this.worker?.postMessage({
			type: "SEEK",
			payload: { targetSeconds },
		});
	}

	public destroy(): void {
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}
	}

	private handleMessage(e: MessageEvent): void {
		const { type, payload } = e.data;

		switch (type) {
			case "INIT_DONE":
				this.callbacks.onInitDone(payload);
				break;
			case "DECODE_EOF":
				this.callbacks.onEnded();
				break;
			case "DECODE_ERROR":
				this.callbacks.onError(2, "Fatal decoding error");
				break;
			case "INIT_ERROR":
				this.callbacks.onError(3, payload?.error ?? "Initialization failed");
				break;
		}
	}
}
