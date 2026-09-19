import { computeReassignedBaseField } from "$/modules/spectrogram/utils/reassigned-spectrogram";
import type { ReassignComputeWorkerScope } from "$/modules/spectrogram/workers/reassign-worker-types";

const ctx: ReassignComputeWorkerScope = self as ReassignComputeWorkerScope;

ctx.onmessage = (event) => {
	const msg = event.data;
	if (msg.type !== "COMPUTE_FIELD") return;

	try {
		const field = computeReassignedBaseField(msg.audio, msg.options);
		ctx.postMessage({ type: "FIELD_READY", taskId: msg.taskId, field }, [
			field.buffer,
		]);
	} catch (e) {
		ctx.postMessage({
			type: "ERROR",
			taskId: msg.taskId,
			message: (e as Error).message,
		});
	}
};
