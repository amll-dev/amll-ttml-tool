import { useCallback, useEffect, useRef, useState } from "react";
import { LRUCache } from "$/modules/spectrogram/utils/lru-cache";
import type { NaturalWeightingScope } from "$/modules/spectrogram/utils/natural-weighting";
import type {
	SpectrogramWorker,
	TileGenerationParams,
	WorkerResponse,
} from "$/modules/spectrogram/workers/types";
import { spectrogramLogger } from "../logger";

const MAX_CACHED_TILES = 70;

export type TileEntry = {
	bitmap: ImageBitmap;
	width: number;
	height: number;
	gain: number;
	paletteId: string;
	logAmount: number;
	reassign: boolean;
	fftSize: number;
	hopLength: number;
	naturalWeightingScope: NaturalWeightingScope;
	naturalWeightingTilt: number;
};

class SpectrogramWorkerClient {
	private worker: SpectrogramWorker;
	private reqIdCounter = 0;
	/** 共享内存里的「代」计数器；不可用时为 null（退化为不跳过） */
	private epochArray: Int32Array | null = null;
	private pendingRequests = new Map<
		number,
		{
			resolve: (bmp: ImageBitmap | null) => void;
			reject: (err: Error) => void;
		}
	>();
	private onInitCompleteCallback?: () => void;

	constructor(onInitComplete?: () => void) {
		this.onInitCompleteCallback = onInitComplete;
		this.worker = new Worker(
			new URL("../workers/spectrogram.worker.ts", import.meta.url),
			{ type: "module" },
		);
		this.worker.onmessage = this.handleMessage.bind(this);

		// 只有跨源隔离（COOP/COEP）时 SharedArrayBuffer 才可用；不可用时
		// 自动退化为「不做请求跳过」，行为与之前一致。
		try {
			if (typeof SharedArrayBuffer !== "undefined") {
				const buffer = new SharedArrayBuffer(4);
				this.epochArray = new Int32Array(buffer);
				this.worker.postMessage({ type: "SET_EPOCH_BUFFER", buffer });
			}
		} catch {
			this.epochArray = null;
		}
	}

	private handleMessage(event: MessageEvent<WorkerResponse>) {
		const msg = event.data;
		if (msg.type === "INIT_COMPLETE") {
			this.onInitCompleteCallback?.();
		} else if (msg.type === "TILE_READY") {
			const request = this.pendingRequests.get(msg.reqId);
			if (request) {
				request.resolve(msg.imageBitmap);
				this.pendingRequests.delete(msg.reqId);
			} else {
				msg.imageBitmap.close();
			}
		} else if (msg.type === "TILE_SKIPPED") {
			const request = this.pendingRequests.get(msg.reqId);
			if (request) {
				request.resolve(null);
				this.pendingRequests.delete(msg.reqId);
			}
		} else if (msg.type === "ERROR") {
			const request = this.pendingRequests.get(msg.reqId);
			if (request) {
				spectrogramLogger.warn(`Worker Error req ${msg.reqId}:`, msg.message);
				request.reject(new Error(msg.message));
				this.pendingRequests.delete(msg.reqId);
			}
		}
	}

	public getTile(params: TileGenerationParams): Promise<ImageBitmap | null> {
		const reqId = this.reqIdCounter++;
		const epoch = this.currentEpoch;
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(reqId, { resolve, reject });
			this.worker.postMessage({
				type: "GET_TILE",
				reqId,
				epoch,
				params,
			});
		});
	}

	/** @description 当前的「代」 */
	public get currentEpoch(): number {
		return this.epochArray ? Atomics.load(this.epochArray, 0) : 0;
	}

	/**
	 * @description 开启新的一代
	 *
	 * worker 会跳过所有属于旧一代的排队请求，避免参数连改时白算。
	 */
	public invalidateGeneration() {
		if (this.epochArray) {
			Atomics.add(this.epochArray, 0, 1);
		}
	}

	public initAudio(sampleRate: number, duration: number) {
		this.worker.postMessage({ type: "INIT", sampleRate, duration });
	}

	public releaseAudio() {
		this.worker.postMessage({ type: "RELEASE" });
	}

	public setPalette(palette: Uint8Array) {
		this.worker.postMessage({ type: "SET_PALETTE", palette });
	}

	public terminate() {
		this.worker.terminate();
		this.pendingRequests.clear();
	}
}

export const useSpectrogramWorker = (
	pcmDataReady: boolean,
	durationInMs: number,
	paletteData: Uint8Array,
) => {
	const clientRef = useRef<SpectrogramWorkerClient | null>(null);
	const [isWorkerReady, setIsWorkerReady] = useState(false);
	const tileCache = useRef<LRUCache<string, TileEntry>>(
		new LRUCache(MAX_CACHED_TILES, (_key, entry) => {
			entry.bitmap.close();
		}),
	);
	const activeRequests = useRef<Set<string>>(new Set());
	/** 当前的「代」签名；变化时开启新的一代 */
	const generationRef = useRef<string | null>(null);
	const [lastTileTimestamp, setLastTileTimestamp] = useState(0);

	const paletteDataRef = useRef(paletteData);
	useEffect(() => {
		paletteDataRef.current = paletteData;
		if (clientRef.current) {
			clientRef.current.setPalette(paletteData);
		}
	}, [paletteData]);

	useEffect(() => {
		const client = new SpectrogramWorkerClient(() => {
			setIsWorkerReady(true);
			setLastTileTimestamp(Date.now());
		});
		clientRef.current = client;

		if (paletteDataRef.current) {
			client.setPalette(paletteDataRef.current);
		}

		return () => client.terminate();
	}, []);

	useEffect(() => {
		if (pcmDataReady && clientRef.current && durationInMs > 0) {
			setIsWorkerReady(false);
			tileCache.current.clear();
			activeRequests.current.clear();

			const durationInSeconds = durationInMs / 1000;
			clientRef.current.initAudio(44100, durationInSeconds);

			if (paletteDataRef.current) {
				clientRef.current.setPalette(paletteDataRef.current);
			}
		} else if (!pcmDataReady && clientRef.current) {
			setIsWorkerReady(false);
			clientRef.current.releaseAudio();
		}
	}, [pcmDataReady, durationInMs]);

	const requestTileIfNeeded = useCallback(
		async (params: TileGenerationParams) => {
			const client = clientRef.current;
			if (!client || !isWorkerReady) return;

			// 只有真正会触发重算的参数才开启新的一代；增益 / 调色板是廉价的
			// 重新上色，换代反而会丢掉实时反馈，所以不计入签名。
			const generation = `${params.height}|${params.logAmount}|${params.reassign}|${params.fftSize}|${params.hopLength}|${params.naturalWeightingScope}|${params.naturalWeightingTilt}`;
			if (generation !== generationRef.current) {
				generationRef.current = generation;
				client.invalidateGeneration();
			}

			const cacheKey = `tile-${params.tileIndex}`;
			const requestFingerprint = `${params.tileIndex}-w${params.tileWidthPx}-h${params.height}-g${params.gain}-p${params.paletteId}-l${params.logAmount}-r${params.reassign}-f${params.fftSize}-s${params.hopLength}-nw${params.naturalWeightingScope}-nt${params.naturalWeightingTilt}`;

			const cacheEntry = tileCache.current.get(cacheKey);

			const isStale =
				!cacheEntry ||
				cacheEntry.width < params.tileWidthPx ||
				cacheEntry.height !== params.height ||
				cacheEntry.gain !== params.gain ||
				cacheEntry.paletteId !== params.paletteId ||
				cacheEntry.logAmount !== params.logAmount ||
				cacheEntry.reassign !== params.reassign ||
				cacheEntry.fftSize !== params.fftSize ||
				cacheEntry.hopLength !== params.hopLength ||
				cacheEntry.naturalWeightingScope !== params.naturalWeightingScope ||
				cacheEntry.naturalWeightingTilt !== params.naturalWeightingTilt;

			if (isStale && !activeRequests.current.has(requestFingerprint)) {
				activeRequests.current.add(requestFingerprint);
				const epochAtRequest = client.currentEpoch;

				try {
					const bitmap = await client.getTile(params);

					if (!bitmap) {
						// 排队期间参数又被改过，worker 直接跳过了这块钱
						return;
					}

					if (client.currentEpoch !== epochAtRequest) {
						// 计算期间参数又变了，结果已经过期，丢弃以免闪一帧旧图
						bitmap.close();
						return;
					}

					tileCache.current.set(cacheKey, {
						bitmap,
						width: params.tileWidthPx,
						height: params.height,
						gain: params.gain,
						paletteId: params.paletteId,
						logAmount: params.logAmount,
						reassign: params.reassign,
						fftSize: params.fftSize,
						hopLength: params.hopLength,
						naturalWeightingScope: params.naturalWeightingScope,
						naturalWeightingTilt: params.naturalWeightingTilt,
					});

					setLastTileTimestamp(Date.now());
				} catch (err) {
					spectrogramLogger.error("生成频谱图瓦片失败", err);
				} finally {
					activeRequests.current.delete(requestFingerprint);
				}
			}
		},
		[isWorkerReady],
	);

	return { tileCache, requestTileIfNeeded, lastTileTimestamp, isWorkerReady };
};
