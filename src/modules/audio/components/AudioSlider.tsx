import { Card } from "@radix-ui/themes";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	audioBufferAtom,
	audioPlayingAtom,
	currentDurationAtom,
	currentTimeAtom,
} from "$/modules/audio/states";
import { lyricLinesAtom, selectedLinesAtom } from "$/states/main";
import { useHoverGuide } from "../hooks";
import { AudioRegion } from "./AudioRegion";
import styles from "./AudioSlider.module.css";
import { HoverGuide } from "./HoverGuide";

export const AudioSlider = () => {
	const setCurrentTime = useSetAtom(currentTimeAtom);
	const setCurrentDuration = useSetAtom(currentDurationAtom);
	const setAudioPlaying = useSetAtom(audioPlayingAtom);

	const currentDuration = useAtomValue(currentDurationAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const audioBuffer = useAtomValue(audioBufferAtom);

	const wsContainerRef = useRef<HTMLDivElement>(null);
	const waveSurferRef = useRef<WaveSurfer | null>(null);

	const [sliderWidthPx, setSliderWidthPx] = useState(0);

	const {
		hoverState,
		handleContainerMouseMove,
		handleContainerMouseLeave,
		isDraggingRef,
	} = useHoverGuide(sliderWidthPx);

	const destroyWaveSurfer = useCallback(() => {
		if (waveSurferRef.current) {
			waveSurferRef.current.destroy();
			waveSurferRef.current = null;
		}
	}, []);

	const createWaveSurfer = useCallback(() => {
		if (!wsContainerRef.current || !audioBuffer) {
			return null;
		}
		const height = wsContainerRef.current.clientHeight;
		const canvasStyles = getComputedStyle(wsContainerRef.current);
		const fontColor =
			canvasStyles.getPropertyValue("--accent-a11") || "#00ffa21e";
		const primaryFillColor =
			canvasStyles.getPropertyValue("--accent-a4") || "#00ffa21e";

		const peaks = [audioBuffer.getChannelData(0)];
		const duration = audioBuffer.duration;

		const ws = WaveSurfer.create({
			container: wsContainerRef.current,
			height,
			hideScrollbar: true,
			waveColor: primaryFillColor,
			progressColor: fontColor,
			cursorColor: fontColor,
			dragToSeek: true,
			cursorWidth: 0,
			barHeight: 0.8,
			media: audioEngine.audioEl,
			peaks: peaks,
			duration: duration,
		});
		waveSurferRef.current = ws;
		return ws;
	}, [audioBuffer]);

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
		if (audioBuffer && audioEngine.audioEl) {
			destroyWaveSurfer();
			setCurrentDuration((audioBuffer.duration * 1000) | 0);
			createWaveSurfer();
		}
	}, [audioBuffer, createWaveSurfer, destroyWaveSurfer, setCurrentDuration]);

	useEffect(() => {
		const handleMusicUnload = () => {
			destroyWaveSurfer();
			setCurrentDuration(0);
			setCurrentTime(0);
			setAudioPlaying(false);
		};

		let frame = 0;
		let lastAudioTime = -1;
		let lastRealTime = performance.now();
		let interpolatedTime = 0;

		const onFrame = () => {
			if (!audioEngine.musicPlaying) {
				cancelAnimationFrame(frame);
				frame = 0;
				return;
			}

			const currentRealTime = performance.now();
			const currentAudioTime = audioEngine.musicCurrentTime;

			// Interpolate playhead linearly between hardware audio time updates
			if (currentAudioTime !== lastAudioTime) {
				interpolatedTime = currentAudioTime;
				lastAudioTime = currentAudioTime;
			} else {
				const dt = (currentRealTime - lastRealTime) / 1000;
				interpolatedTime += dt * audioEngine.musicPlayBackRate;
			}
			lastRealTime = currentRealTime;

			setCurrentTime((interpolatedTime * 1000) | 0);
			frame = requestAnimationFrame(onFrame);
		};

		const handlePlay = () => {
			lastAudioTime = audioEngine.musicCurrentTime;
			interpolatedTime = lastAudioTime;
			lastRealTime = performance.now();
			onFrame();
			setAudioPlaying(true);
		};
		const handlePause = () => setAudioPlaying(false);
		const handleSeek = () =>
			setCurrentTime((audioEngine.musicCurrentTime * 1000) | 0);

		audioEngine.addEventListener("music-unload", handleMusicUnload);
		audioEngine.addEventListener("music-resume", handlePlay);
		audioEngine.addEventListener("music-pause", handlePause);
		audioEngine.addEventListener("music-seeked", handleSeek);

		return () => {
			destroyWaveSurfer();
			audioEngine.removeEventListener("music-unload", handleMusicUnload);
			audioEngine.removeEventListener("music-resume", handlePlay);
			audioEngine.removeEventListener("music-pause", handlePause);
			audioEngine.removeEventListener("music-seeked", handleSeek);
		};
	}, [destroyWaveSurfer, setCurrentDuration, setCurrentTime, setAudioPlaying]);

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
				style={{ width: "100%", height: "100%", overflow: "hidden" }}
				onMouseMove={handleContainerMouseMove}
				onMouseLeave={handleContainerMouseLeave}
			>
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

				<AudioRegion
					sliderWidthPx={sliderWidthPx}
					containerRef={wsContainerRef}
					isDraggingRef={isDraggingRef}
				/>
			</section>
		</Card>
	);
};
