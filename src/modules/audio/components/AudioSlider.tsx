import { Card } from "@radix-ui/themes";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	audioEngineStateAtom,
	currentDurationAtom,
	loadedAudioAtom,
	pcmDataReadyAtom,
} from "$/modules/audio/states";
import AnalyzerWorker from "$/modules/ffmpeg/worker/analyzer.worker.ts?worker";
import ffmpegWasmUrl from "$/modules/ffmpeg/worker/wasm/ffmpeg_wasm.wasm?url";
import { lyricLinesAtom, selectedLinesAtom } from "$/states/main";
import { useHoverGuide } from "../hooks";
import { AudioRegion } from "./AudioRegion";
import styles from "./AudioSlider.module.css";
import { HoverGuide } from "./HoverGuide";

export const AudioSlider = () => {
	const currentDuration = useAtomValue(currentDurationAtom);
	const engineState = useAtomValue(audioEngineStateAtom);
	const audioFile = useAtomValue(loadedAudioAtom);
	const setPcmDataReady = useSetAtom(pcmDataReadyAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);

	const wsContainerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const cursorRef = useRef<HTMLDivElement>(null);

	const workerRef = useRef<Worker | null>(null);
	const offscreenTransferred = useRef(false);

	const [sliderWidthPx, setSliderWidthPx] = useState(0);

	const {
		hoverState,
		handleContainerMouseMove,
		handleContainerMouseLeave,
		isDraggingRef,
	} = useHoverGuide(sliderWidthPx);

	useEffect(() => {
		workerRef.current = new AnalyzerWorker();

		workerRef.current.onmessage = (e) => {
			if (e.data.type === "ANALYZE_DONE") {
				setPcmDataReady(true);
			}
		};
		return () => {
			workerRef.current?.terminate();
		};
	}, [setPcmDataReady]);

	useEffect(() => {
		const container = wsContainerRef.current;
		if (!container) return;

		const observer = new ResizeObserver((entries) => {
			if (entries[0]) {
				setSliderWidthPx(entries[0].contentRect.width);
			}
		});
		observer.observe(container);
		setSliderWidthPx(container.clientWidth);

		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (
			!audioFile ||
			audioFile.size === 0 ||
			!workerRef.current ||
			!canvasRef.current ||
			!wsContainerRef.current
		) {
			return;
		}

		setPcmDataReady(false);

		let canvasPayload: OffscreenCanvas | undefined;
		let transfer: Transferable[] = [];

		if (!offscreenTransferred.current) {
			const offscreen = canvasRef.current.transferControlToOffscreen();
			canvasPayload = offscreen;
			transfer = [offscreen];
			offscreenTransferred.current = true;
		}
		const styles = getComputedStyle(wsContainerRef.current);
		const waveColor =
			styles.getPropertyValue("--accent-a4").trim() || "#00ffa21e";
		workerRef.current.postMessage(
			{
				type: "INIT",
				payload: {
					file: audioFile,
					ffmpegWasmUrl,
					canvas: canvasPayload,
					width: wsContainerRef.current.clientWidth,
					height: wsContainerRef.current.clientHeight,
					dpr: window.devicePixelRatio || 1,
					color: waveColor,
				},
			},
			transfer,
		);
	}, [audioFile, setPcmDataReady]);

	useEffect(() => {
		if (sliderWidthPx > 0 && workerRef.current && wsContainerRef.current) {
			const timeoutId = setTimeout(() => {
				if (!wsContainerRef.current || !workerRef.current) return;
				const styles = getComputedStyle(wsContainerRef.current);
				const waveColor =
					styles.getPropertyValue("--accent-a4").trim() || "#00ffa21e";
				workerRef.current.postMessage({
					type: "RESIZE",
					payload: {
						width: sliderWidthPx,
						height: wsContainerRef.current.clientHeight,
						dpr: window.devicePixelRatio || 1,
						color: waveColor,
					},
				});
			}, 1000);
			return () => clearTimeout(timeoutId);
		}
	}, [sliderWidthPx]);

	useEffect(() => {
		if (engineState === "idle" && workerRef.current && sliderWidthPx > 0) {
			workerRef.current.postMessage({
				type: "RESIZE",
				payload: { width: 0, height: 0 },
			});
		}
	}, [engineState, sliderWidthPx]);

	useEffect(() => {
		let rafId: number;
		const renderCursor = () => {
			if (currentDuration > 0 && cursorRef.current && sliderWidthPx > 0) {
				const progress =
					audioEngine.musicCurrentTime / (currentDuration / 1000);
				const xPos = progress * sliderWidthPx;
				cursorRef.current.style.transform = `translateX(${xPos}px)`;
			}
			rafId = requestAnimationFrame(renderCursor);
		};
		rafId = requestAnimationFrame(renderCursor);
		return () => cancelAnimationFrame(rafId);
	}, [currentDuration, sliderWidthPx]);

	const selectedRegions = useMemo(() => {
		if (currentDuration <= 0 || sliderWidthPx <= 0) return [];

		const pixelsPerMs = sliderWidthPx / currentDuration;
		const regions: { id: string; left: number; width: number }[] = [];

		for (const line of lyricLines.lyricLines) {
			if (selectedLines.has(line.id)) {
				const left = line.startTime * pixelsPerMs;
				const width = (line.endTime - line.startTime) * pixelsPerMs;
				regions.push({ id: line.id, left, width });
			}
		}
		return regions;
	}, [lyricLines.lyricLines, selectedLines, currentDuration, sliderWidthPx]);

	const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (currentDuration <= 0 || sliderWidthPx <= 0) return;
		if (isDraggingRef.current) return;

		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const progress = Math.max(0, Math.min(x / rect.width, 1));
		audioEngine.seekMusic((progress * currentDuration) / 1000);
	};

	return (
		<Card
			style={{
				alignSelf: "center",
				width: "100%",
				height: "2.5em",
				padding: "0",
			}}
		>
			<section
				className={styles.waveformContainer}
				aria-label="Audio Waveform"
				ref={wsContainerRef}
				style={{
					width: "100%",
					height: "100%",
					overflow: "hidden",
					position: "relative",
					cursor: "text",
				}}
				onMouseMove={handleContainerMouseMove}
				onMouseLeave={handleContainerMouseLeave}
				onMouseDown={handleTimelineClick}
			>
				<canvas
					ref={canvasRef}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: "100%",
						height: "100%",
						pointerEvents: "none",
					}}
				/>

				<HoverGuide hoverState={hoverState} />

				{selectedRegions.map((region) => (
					<div
						key={region.id}
						className={styles.selectedLyricRegion}
						style={{
							left: `${region.left}px`,
							width: `${region.width}px`,
						}}
					/>
				))}

				{currentDuration > 0 && (
					<div
						ref={cursorRef}
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							width: "1px",
							height: "100%",
							backgroundColor: "var(--accent-a11)",
							pointerEvents: "none",
							zIndex: 20,
							willChange: "transform",
						}}
					/>
				)}

				<AudioRegion
					sliderWidthPx={sliderWidthPx}
					containerRef={wsContainerRef}
					isDraggingRef={isDraggingRef}
				/>
			</section>
		</Card>
	);
};
