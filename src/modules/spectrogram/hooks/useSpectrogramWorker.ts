import { useCallback, useEffect, useRef, useState } from "react";
import { LRUCache } from "$/modules/spectrogram/utils/lru-cache";
import type {
	SpectrogramWorker,
	TileGenerationParams,
	WorkerResponse,
} from "$/modules/spectrogram/workers/types";

const MAX_CACHED_TILES = 70;

export type TileEntry = {
	bitmap: ImageBitmap;
	width: number;
	height: number;
	gain: number;
	paletteId: string;
};

class SpectrogramWorkerClient {
	private worker: SpectrogramWorker;
	private reqIdCounter = 0;
	private pendingRequests = new Map<
		number,
		{
			resolve: (bmp: ImageBitmap) => void;
			reject: (err: Error) => void;
		}
	>();

	constructor() {
		this.worker = new Worker(
			new URL("../workers/spectrogram.worker.ts", import.meta.url),
			{ type: "module" },
		);
		this.worker.onmessage = this.handleMessage.bind(this);
	}

	private handleMessage(event: MessageEvent<WorkerResponse>) {
		const msg = event.data;
		if (msg.type === "TILE_READY") {
			const request = this.pendingRequests.get(msg.reqId);
			if (request) {
				request.resolve(msg.imageBitmap);
				this.pendingRequests.delete(msg.reqId);
			} else {
				msg.imageBitmap.close();
			}
		} else if (msg.type === "ERROR") {
			const request = this.pendingRequests.get(msg.reqId);
			if (request) {
				console.warn(`Worker Error req ${msg.reqId}:`, msg.message);
				request.reject(new Error(msg.message));
				this.pendingRequests.delete(msg.reqId);
			}
		}
	}

	public getTile(params: TileGenerationParams): Promise<ImageBitmap> {
		const reqId = this.reqIdCounter++;
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(reqId, { resolve, reject });
			this.worker.postMessage({
				type: "GET_TILE",
				reqId,
				params,
			});
		});
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
	const tileCache = useRef<LRUCache<string, TileEntry>>(
		new LRUCache(MAX_CACHED_TILES, (_key, entry) => {
			entry.bitmap.close();
		}),
	);
	const activeRequests = useRef<Set<string>>(new Set());
	const [lastTileTimestamp, setLastTileTimestamp] = useState(0);

	const paletteDataRef = useRef(paletteData);
	useEffect(() => {
		paletteDataRef.current = paletteData;
		if (clientRef.current) {
			clientRef.current.setPalette(paletteData);
		}
	}, [paletteData]);

	useEffect(() => {
		const client = new SpectrogramWorkerClient();
		clientRef.current = client;

		if (paletteDataRef.current) {
			client.setPalette(paletteDataRef.current);
		}

		return () => client.terminate();
	}, []);

	useEffect(() => {
		if (pcmDataReady && clientRef.current && durationInMs > 0) {
			tileCache.current.clear();
			activeRequests.current.clear();

			const durationInSeconds = durationInMs / 1000;
			clientRef.current.initAudio(48000, durationInSeconds);

			if (paletteDataRef.current) {
				clientRef.current.setPalette(paletteDataRef.current);
			}

			setTimeout(() => {
				setLastTileTimestamp(Date.now());
			}, 100);
		} else if (!pcmDataReady && clientRef.current) {
			clientRef.current.releaseAudio();
		}
	}, [pcmDataReady, durationInMs]);

	const requestTileIfNeeded = useCallback(
		async (params: TileGenerationParams) => {
			if (!clientRef.current) return;

			const cacheKey = `tile-${params.tileIndex}`;
			const requestFingerprint = `${params.tileIndex}-w${params.tileWidthPx}-h${params.height}-g${params.gain}-p${params.paletteId}`;

			const cacheEntry = tileCache.current.get(cacheKey);

			const isStale =
				!cacheEntry ||
				cacheEntry.width < params.tileWidthPx ||
				cacheEntry.height !== params.height ||
				cacheEntry.gain !== params.gain ||
				cacheEntry.paletteId !== params.paletteId;

			if (isStale && !activeRequests.current.has(requestFingerprint)) {
				activeRequests.current.add(requestFingerprint);

				try {
					const bitmap = await clientRef.current.getTile(params);

					tileCache.current.set(cacheKey, {
						bitmap,
						width: params.tileWidthPx,
						height: params.height,
						gain: params.gain,
						paletteId: params.paletteId,
					});

					setLastTileTimestamp(Date.now());
				} catch (err) {
					console.error("生成频谱图瓦片失败", err);
				} finally {
					activeRequests.current.delete(requestFingerprint);
				}
			}
		},
		[],
	);

	return { tileCache, requestTileIfNeeded, lastTileTimestamp };
};
