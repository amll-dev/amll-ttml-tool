import type { NaturalWeightingScope } from "$/modules/spectrogram/utils/natural-weighting";

export interface TileGenerationParams {
	tileIndex: number;
	startTime: number;
	endTime: number;
	gain: number;
	height: number;
	tileWidthPx: number;
	paletteId: string;
	/** 频率轴的对数程度，0 为线性，1 为完全对数 */
	logAmount: number;
	/** 是否使用相位声码器频率重分配 */
	reassign: boolean;
	/** 重分配 FFT 窗口大小 */
	fftSize: number;
	/** 重分配帧移（由 FFT 大小与重叠百分比换算） */
	hopLength: number;
	/** 自然加权（频谱倾斜）作用的范围 */
	naturalWeightingScope: NaturalWeightingScope;
	/** 自然加权倾斜度（dB/倍频程，0 表示不倾斜） */
	naturalWeightingTilt: number;
}

export type WorkerRequest =
	| { type: "INIT"; sampleRate: number; duration: number }
	| { type: "RELEASE" }
	| { type: "SET_PALETTE"; palette: Uint8Array }
	/**
	 * 共享内存里的「代」计数器
	 *
	 * 主线程修改参数时把它加一，worker 会在开始计算每块之前读一次，
	 * 跳过所有属于旧一代的排队请求，避免参数连改时白算。
	 */
	| { type: "SET_EPOCH_BUFFER"; buffer: SharedArrayBuffer }
	| { type: "GET_TILE"; reqId: number; epoch: number; params: TileGenerationParams };

export type WorkerResponse =
	| { type: "INIT_COMPLETE" }
	| { type: "TILE_READY"; reqId: number; imageBitmap: ImageBitmap }
	/** 请求在开始计算前就已经被更新的参数取代 */
	| { type: "TILE_SKIPPED"; reqId: number }
	| { type: "ERROR"; reqId: number; message: string };

export interface SpectrogramWorker extends Omit<Worker, "postMessage"> {
	postMessage(message: WorkerRequest, transfer?: Transferable[]): void;
}

export type SpectrogramWorkerScope = Omit<
	DedicatedWorkerGlobalScope,
	"postMessage" | "onmessage"
> & {
	postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
	onmessage:
		| ((this: SpectrogramWorkerScope, ev: MessageEvent<WorkerRequest>) => void)
		| null;
};
