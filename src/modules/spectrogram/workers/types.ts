export interface TileGenerationParams {
	tileIndex: number;
	startTime: number;
	endTime: number;
	gain: number;
	height: number;
	tileWidthPx: number;
	paletteId: string;
}

export type WorkerRequest =
	| { type: "INIT"; sampleRate: number; duration: number }
	| { type: "RELEASE" }
	| { type: "SET_PALETTE"; palette: Uint8Array }
	| { type: "GET_TILE"; reqId: number; params: TileGenerationParams };

export type WorkerResponse =
	| { type: "INIT_COMPLETE" }
	| { type: "TILE_READY"; reqId: number; imageBitmap: ImageBitmap }
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
