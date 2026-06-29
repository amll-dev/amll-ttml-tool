import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useRef } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import { currentDurationAtom, currentTimeAtom } from "$/modules/audio/states";

export function useScrubbing(
	scrollContainerRef: React.RefObject<HTMLDivElement | null>,
	scrollLeft: number,
	zoom: number,
) {
	const currentDurationMs = useAtomValue(currentDurationAtom);
	const setCurrentTime = useSetAtom(currentTimeAtom);
	const isScrubbingRef = useRef(false);
	const scrollLeftForScrubRef = useRef(scrollLeft);
	const currentMouseXRef = useRef(0);

	const handleScrubMove = useCallback(
		(event: MouseEvent) => {
			if (!scrollContainerRef.current || !currentDurationMs) return;

			const rect = scrollContainerRef.current.getBoundingClientRect();
			const mouseX = event.clientX - rect.left;
			currentMouseXRef.current = mouseX;

			const clampedMouseX = Math.max(0, Math.min(mouseX, rect.width));

			const timeAtCursor =
				(scrollLeftForScrubRef.current + clampedMouseX) / zoom;

			const durationSec = currentDurationMs / 1000;
			const clampedTime = Math.max(0, Math.min(timeAtCursor, durationSec));

			audioEngine.seekMusic(clampedTime);
			setCurrentTime(clampedTime * 1000);
		},
		[currentDurationMs, zoom, setCurrentTime, scrollContainerRef],
	);

	const handleScrubEnd = useCallback(() => {
		isScrubbingRef.current = false;
		window.removeEventListener("mousemove", handleScrubMove);
		window.removeEventListener("mouseup", handleScrubEnd);
	}, [handleScrubMove]);

	const handleScrubStart = useCallback(
		(event: React.MouseEvent) => {
			event.preventDefault();
			isScrubbingRef.current = true;
			scrollLeftForScrubRef.current = scrollLeft;

			handleScrubMove(event.nativeEvent);

			window.addEventListener("mousemove", handleScrubMove);
			window.addEventListener("mouseup", handleScrubEnd, { once: true });
		},
		[handleScrubMove, handleScrubEnd, scrollLeft],
	);

	return { handleScrubStart };
}
