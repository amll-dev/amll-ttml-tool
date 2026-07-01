import { useAtom, useAtomValue, useSetAtom } from "jotai";
import type { FC } from "react";
import { useContext, useEffect, useRef } from "react";
import { audioEngine } from "$/modules/audio/audio-engine.ts";
import {
	type ProcessedLyricLine,
	processedLyricLinesAtom,
} from "$/modules/segmentation/utils/segment-processing.ts";
import {
	previewLineAtom,
	type TimelineDragOperation,
	timelineDragAtom,
} from "$/modules/spectrogram/states/dnd.ts";
import {
	commitUpdatedLine,
	getUpdatedLineForDivider,
	getUpdatedLineForWordPan,
} from "$/modules/spectrogram/utils/timeline-mutations.ts";
import { selectedLinesAtom, showUnselectedLinesAtom } from "$/states/main.ts";
import { globalStore } from "$/states/store.ts";
import { LyricLineSegment } from "./LyricLineSegment";
import styles from "./LyricTimelineOverlay.module.css";
import { SpectrogramContext } from "./SpectrogramContext.ts";

interface LyricTimelineOverlayProps {
	clientWidth: number;
	hiddenLineIds?: Set<string> | null;
}

const SNAP_THRESHOLD_PX = 7;

export const LyricTimelineOverlay: FC<LyricTimelineOverlayProps> = ({
	clientWidth,
	hiddenLineIds,
}) => {
	const processedLines = useAtomValue(processedLyricLinesAtom);
	const [timelineDrag, setTimelineDrag] = useAtom(timelineDragAtom);
	const setPreviewLine = useSetAtom(previewLineAtom);
	const snapTargetsMs = useRef<number[]>([]);
	const { scrollContainerRef, zoom, scrollLeft } =
		useContext(SpectrogramContext);

	const showUnselectedLines = useAtomValue(showUnselectedLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);

	useEffect(() => {
		if (!timelineDrag) {
			return;
		}

		const handleGlobalMouseMove = (event: MouseEvent) => {
			event.preventDefault();

			switch (timelineDrag.type) {
				case "divider": {
					const { startX, lineId, segmentIndex, isGapCreation, zoom } =
						timelineDrag;
					const lineBeingDragged = processedLines.find((l) => l.id === lineId);
					if (!lineBeingDragged) return;

					const deltaX = event.clientX - startX;
					const deltaTimeMs = Math.round((deltaX / zoom) * 1000);
					let newTime =
						(segmentIndex === -1
							? lineBeingDragged.startTime
							: lineBeingDragged.segments[segmentIndex].endTime) + deltaTimeMs;

					if (!event.shiftKey) {
						let closestSnapTime: number | null = null;
						let minDistancePx = SNAP_THRESHOLD_PX;
						const newTimePx = (newTime / 1000) * zoom;

						for (const targetTime of snapTargetsMs.current) {
							const targetTimePx = (targetTime / 1000) * zoom;
							const distancePx = Math.abs(newTimePx - targetTimePx);
							if (distancePx < minDistancePx) {
								minDistancePx = distancePx;
								closestSnapTime = targetTime;
							}
						}
						if (closestSnapTime !== null) newTime = closestSnapTime;
					}

					const preview = getUpdatedLineForDivider(
						lineBeingDragged,
						segmentIndex,
						newTime,
						isGapCreation,
						zoom,
					);
					setPreviewLine(preview);
					break;
				}

				case "word-pan": {
					const { lineId, wordId, initialMouseTimeMS, initialWordStartMS } =
						timelineDrag;
					const processedLine = processedLines.find((l) => l.id === lineId);
					if (!processedLine) return;

					const scrollContainer = scrollContainerRef.current;
					if (!scrollContainer) return;
					const rect = scrollContainer.getBoundingClientRect();

					const mouseXPx = event.clientX - rect.left;
					const currentMouseTimeMS = ((scrollLeft + mouseXPx) / zoom) * 1000;
					const timeDeltaMS = currentMouseTimeMS - initialMouseTimeMS;
					const desiredNewStartMS = initialWordStartMS + timeDeltaMS;

					const preview = getUpdatedLineForWordPan(
						processedLine,
						wordId,
						desiredNewStartMS,
						zoom,
					);
					setPreviewLine(preview);
					break;
				}
			}
		};

		const handleGlobalMouseUp = (event: MouseEvent) => {
			event.preventDefault();

			const lastSnappedLine = globalStore.get(previewLineAtom);
			if (lastSnappedLine) {
				commitUpdatedLine(lastSnappedLine);
			}

			setTimelineDrag(null);
			setPreviewLine(null);
		};

		let needsBoundarySnapping = false;

		if (timelineDrag.type === "divider") {
			const { segmentIndex } = timelineDrag;
			const lineBeingDragged = processedLines.find(
				(l) => l.id === timelineDrag.lineId,
			);
			if (lineBeingDragged) {
				needsBoundarySnapping =
					segmentIndex === -1 ||
					segmentIndex === lineBeingDragged.segments.length - 1;
			}
		}

		if (needsBoundarySnapping) {
			const lineId = (timelineDrag as TimelineDragOperation).lineId;
			const currentEngineTimeMs = audioEngine.musicCurrentTime * 1000;
			const targets: number[] = [currentEngineTimeMs];
			const otherLineBoundaries = processedLines
				.filter((line) => line.id !== lineId)
				.flatMap((line) => [line.startTime, line.endTime]);
			targets.push(...otherLineBoundaries);
			snapTargetsMs.current = targets.filter(
				(time): time is number => time != null,
			);
		}

		window.addEventListener("mousemove", handleGlobalMouseMove);
		window.addEventListener("mouseup", handleGlobalMouseUp, { once: true });

		return () => {
			window.removeEventListener("mousemove", handleGlobalMouseMove);
			window.removeEventListener("mouseup", handleGlobalMouseUp);
			snapTargetsMs.current = [];
			setPreviewLine(null);
		};
	}, [
		timelineDrag,
		setTimelineDrag,
		setPreviewLine,
		zoom,
		scrollLeft,
		scrollContainerRef,
		processedLines,
	]);

	const bufferPx = 500;
	const viewStartMs = ((scrollLeft - bufferPx) / zoom) * 1000;
	const viewEndMs = ((scrollLeft + clientWidth + bufferPx) / zoom) * 1000;

	const linesToRenderSet = new Set<ProcessedLyricLine>();
	let closestLeft: ProcessedLyricLine | null = null;
	let foundClosestRight = false;

	for (const line of processedLines) {
		if (line.startTime == null || line.endTime == null) continue;

		const inBufferedView =
			line.endTime > viewStartMs && line.startTime < viewEndMs;

		if (inBufferedView) {
			linesToRenderSet.add(line);
			continue;
		}

		if (line.endTime <= viewStartMs) {
			closestLeft = line;
		}

		if (line.startTime >= viewEndMs && !foundClosestRight) {
			linesToRenderSet.add(line);
			foundClosestRight = true;
		}
	}

	if (closestLeft) {
		linesToRenderSet.add(closestLeft);
	}

	const visibleLines = Array.from(linesToRenderSet);

	let linesToRender: ProcessedLyricLine[] = visibleLines;

	if (hiddenLineIds && hiddenLineIds.size > 0) {
		linesToRender = linesToRender.filter((line) => !hiddenLineIds.has(line.id));
	}

	if (!showUnselectedLines) {
		linesToRender = linesToRender.filter((line) => selectedLines.has(line.id));
	}

	return (
		<div className={styles.overlay}>
			{linesToRender.map((line) => (
				<LyricLineSegment key={line.id} line={line} allLines={processedLines} />
			))}
		</div>
	);
};
