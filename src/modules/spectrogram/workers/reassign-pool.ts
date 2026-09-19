import type { ReassignedFieldOptions } from "$/modules/spectrogram/utils/reassigned-spectrogram";
import type {
	ReassignComputeResponse,
	ReassignComputeWorker,
} from "$/modules/spectrogram/workers/reassign-worker-types";

/** 计算 worker 的数量上限 */
const MAX_COMPUTE_WORKERS = 8;

interface ReassignTask {
	taskId: number;
	/** 派发时的「代」；排队期间如果换代了就放弃 */
	epoch: number;
	audio: Float32Array;
	options: ReassignedFieldOptions;
	resolve: (field: Float32Array | null) => void;
	reject: (error: Error) => void;
}

interface ReassignSlot {
	worker: ReassignComputeWorker;
	current: ReassignTask | null;
}

let epochArray: Int32Array | null = null;
let pool: ReassignSlot[] | null = null;
let nextTaskId = 0;
const pendingTasks: ReassignTask[] = [];

/** @description 让计算池能读到主线程写入的「代」计数器 */
export function setReassignEpochSource(array: Int32Array | null) {
	epochArray = array;
}

function currentEpoch(): number {
	return epochArray ? Atomics.load(epochArray, 0) : 0;
}

function getComputeWorkerCount(): number {
	const cores = navigator.hardwareConcurrency || 4;
	return Math.max(1, Math.min(MAX_COMPUTE_WORKERS, cores));
}

function createPool(): ReassignSlot[] {
	const slots: ReassignSlot[] = [];
	for (let i = 0; i < getComputeWorkerCount(); i++) {
		const worker = new Worker(new URL("./reassign.worker.ts", import.meta.url), {
			type: "module",
		}) as ReassignComputeWorker;
		const slot: ReassignSlot = { worker, current: null };
		worker.onmessage = (event: MessageEvent<ReassignComputeResponse>) => {
			settleSlot(slot, event.data);
		};
		worker.onerror = (event) => {
			settleSlot(slot, {
				type: "ERROR",
				taskId: -1,
				message: event.message || "计算 worker 出错",
			});
		};
		slots.push(slot);
	}
	return slots;
}

function settleSlot(slot: ReassignSlot, msg: ReassignComputeResponse) {
	const task = slot.current;
	slot.current = null;

	if (task) {
		if (msg.type === "FIELD_READY") {
			task.resolve(msg.field);
		} else {
			task.reject(new Error(msg.message));
		}
	}

	pumpQueue();
}

function pumpQueue() {
	if (!pool) return;

	while (pendingTasks.length > 0) {
		const slot = pool.find((s) => s.current === null);
		if (!slot) return;

		const task = pendingTasks.shift();
		if (!task) return;

		// 排队期间参数又被改过：这块钱已经过期，直接放弃不浪费计算
		if (task.epoch < currentEpoch()) {
			task.resolve(null);
			continue;
		}

		slot.current = task;
		slot.worker.postMessage(
			{
				type: "COMPUTE_FIELD",
				taskId: task.taskId,
				audio: task.audio,
				options: task.options,
			},
			[task.audio.buffer],
		);
	}
}

/**
 * @description 在计算池里算一块瓦片的基础值场
 *
 * 返回 null 表示这块在排队期间已经被更新的参数取代。
 */
export function computeReassignFieldInPool(
	audio: Float32Array,
	options: ReassignedFieldOptions,
): Promise<Float32Array | null> {
	if (!pool) {
		pool = createPool();
	}

	return new Promise((resolve, reject) => {
		pendingTasks.push({
			taskId: nextTaskId++,
			epoch: currentEpoch(),
			audio,
			options,
			resolve,
			reject,
		});
		pumpQueue();
	});
}

/** @description 销毁计算池，未完成的任务一律以 null 结束 */
export function disposeReassignPool() {
	if (pool) {
		for (const slot of pool) {
			if (slot.current) {
				slot.current.resolve(null);
				slot.current = null;
			}
			slot.worker.terminate();
		}
		pool = null;
	}

	while (pendingTasks.length > 0) {
		pendingTasks.shift()?.resolve(null);
	}
}
