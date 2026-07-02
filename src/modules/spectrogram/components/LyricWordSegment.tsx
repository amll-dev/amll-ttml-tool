import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
	type FC,
	type KeyboardEvent,
	type MouseEvent,
	useContext,
} from "react";
import { audioEngine } from "$/modules/audio/audio-engine.ts";
import type { WordSegment } from "$/modules/segmentation/utils/segment-processing.ts";
import { displayRomanizationInSyncAtom } from "$/modules/settings/states/index.ts";
import {
	selectedWordIdAtom,
	timelineDragAtom,
} from "$/modules/spectrogram/states/dnd.ts";
import { editingTimeFieldAtom } from "$/states/main.ts";
import styles from "./LyricWordSegment.module.css";
import { SpectrogramContext } from "./SpectrogramContext.ts";

interface LyricWordSegmentProps {
	lineId: string;
	segment: WordSegment;
	lineStartTime: number;
}

export const LyricWordSegment: FC<LyricWordSegmentProps> = ({
	lineId,
	segment,
	lineStartTime,
}) => {
	const [selectedWordId, setSelectedWordId] = useAtom(selectedWordIdAtom);
	const setTimelineDrag = useSetAtom(timelineDragAtom);
	const { zoom, scrollLeft, scrollContainerRef } =
		useContext(SpectrogramContext);
	const showPerWordRomanization = useAtomValue(displayRomanizationInSyncAtom);
	const editingTimeField = useAtomValue(editingTimeFieldAtom);

	const { startTime, endTime, word, romanWord } = segment;

	if (startTime == null || endTime == null || endTime <= startTime) {
		return null;
	}

	const left = ((startTime - lineStartTime) / 1000) * zoom;
	const width = ((endTime - startTime) / 1000) * zoom;

	const isSelected = selectedWordId === segment.id;

	const handleClick = (e: MouseEvent<HTMLDivElement>) => {
		if (editingTimeField) return;
		e.stopPropagation();
		setSelectedWordId(segment.id);
	};

	const handlePanStart = (e: MouseEvent<HTMLDivElement>) => {
		if (editingTimeField) return;
		if (e.button !== 0) return;

		e.preventDefault();
		e.stopPropagation();

		const scrollContainer = scrollContainerRef.current;
		if (!scrollContainer) return;
		const rect = scrollContainer.getBoundingClientRect();

		const mouseXPx = e.clientX - rect.left;
		const initialMouseTimeMS = ((scrollLeft + mouseXPx) / zoom) * 1000;

		setTimelineDrag({
			type: "word-pan",
			lineId: lineId,
			wordId: segment.id,
			initialMouseTimeMS,
			initialWordStartMS: segment.startTime,
		});

		setSelectedWordId(segment.id);
	};

	const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
		if (editingTimeField) return;
		e.preventDefault();
		e.stopPropagation();
		setSelectedWordId(segment.id);
		if (startTime != null && endTime != null) {
			audioEngine.auditionRange(startTime / 1000, endTime / 1000);
		}
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			e.stopPropagation();
			setSelectedWordId(segment.id);
			if (startTime != null && endTime != null) {
				audioEngine.auditionRange(startTime / 1000, endTime / 1000);
			}
		}
	};

	const dynamicStyles = {
		left: `${left}px`,
		width: `${width}px`,
		backgroundColor: isSelected ? "var(--accent-a6)" : "transparent",
	};

	const hasRoman =
		showPerWordRomanization && romanWord && romanWord.trim() !== "";

	return (
		<div
			className={styles.wordSegment}
			style={dynamicStyles}
			onClick={handleClick}
			onMouseDown={handlePanStart}
			onContextMenu={handleContextMenu}
			role="button"
			tabIndex={0}
			onKeyDown={handleKeyDown}
		>
			{hasRoman ? (
				<>
					<span className={styles.romanText}>{romanWord}</span>
					<span className={styles.originText}>{word}</span>
				</>
			) : (
				word
			)}
		</div>
	);
};
