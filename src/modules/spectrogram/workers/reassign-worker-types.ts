import type { ReassignedFieldOptions } from "$/modules/spectrogram/utils/reassigned-spectrogram";

/** 主 worker 派发给计算 worker 的请求 */
export type ReassignComputeRequest = {
	type: "COMPUTE_FIELD";
	taskId: number;
	/** 音频切片（transfer 进来，用完即弃） */
	audio: Float32Array;
	options: ReassignedFieldOptions;
};

/** 计算 worker 返回给主 worker 的响应 */
export type ReassignComputeResponse =
	| { type: "FIELD_READY"; taskId: number; field: Float32Array }
	| { type: "ERROR"; taskId: number; message: string };

export interface ReassignComputeWorker extends Omit<Worker, "postMessage"> {
	postMessage(message: ReassignComputeRequest, transfer?: Transferable[]): void;
}

export type ReassignComputeWorkerScope = Omit<
	DedicatedWorkerGlobalScope,
	"postMessage" | "onmessage"
> & {
	postMessage(message: ReassignComputeResponse, transfer?: Transferable[]): void;
	onmessage:
		| ((
				this: ReassignComputeWorkerScope,
				ev: MessageEvent<ReassignComputeRequest>,
		  ) => void)
		| null;
};
