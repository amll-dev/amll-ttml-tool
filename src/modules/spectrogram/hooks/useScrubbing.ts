import { useAtomValue } from "jotai";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import { currentDurationAtom } from "$/modules/audio/states";

export function useScrubbing(
	scrollContainerRef: React.RefObject<HTMLDivElement | null>,
	scrollLeft: number,
	zoom: number,
) {
	const currentDurationMs = useAtomValue(currentDurationAtom);
	const isScrubbingRef = useRef(false);

	const scrollLeftRef = useRef(scrollLeft);
	useLayoutEffect(() => {
		scrollLeftRef.current = scrollLeft;
	}, [scrollLeft]);

	const clickOffsetPxRef = useRef(0);
	const lastClientXRef = useRef(0);

	const updateScrubPosition = useCallback(
		(clientX: number) => {
			if (!scrollContainerRef.current || !currentDurationMs) return;

			const rect = scrollContainerRef.current.getBoundingClientRect();
			const mouseX = clientX - rect.left;

			const clampedMouseX = Math.max(0, Math.min(mouseX, rect.width));

			const virtualMouseX = scrollLeftRef.current + clampedMouseX;
			const correctedVirtualX = virtualMouseX - clickOffsetPxRef.current;
			const targetTime = correctedVirtualX / zoom;

			const durationSec = currentDurationMs / 1000;
			const clampedTime = Math.max(0, Math.min(targetTime, durationSec));

			audioEngine.seekMusic(clampedTime);
		},
		[currentDurationMs, zoom, scrollContainerRef],
	);

	const handleScrubMove = useCallback(
		(event: MouseEvent) => {
			lastClientXRef.current = event.clientX;
			updateScrubPosition(event.clientX);
		},
		[updateScrubPosition],
	);

	const handleScrubEnd = useCallback(() => {
		isScrubbingRef.current = false;
		window.removeEventListener("mousemove", handleScrubMove);
		window.removeEventListener("mouseup", handleScrubEnd);
	}, [handleScrubMove]);

	const handleScrubStart = useCallback(
		(event: React.MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();

			if (!scrollContainerRef.current) return;
			isScrubbingRef.current = true;

			lastClientXRef.current = event.clientX;

			const rect = scrollContainerRef.current.getBoundingClientRect();
			const mouseX = event.clientX - rect.left;

			const virtualMouseX = scrollLeftRef.current + mouseX;
			const playheadVirtualX = audioEngine.musicCurrentTime * zoom;

			clickOffsetPxRef.current = virtualMouseX - playheadVirtualX;

			window.addEventListener("mousemove", handleScrubMove);
			window.addEventListener("mouseup", handleScrubEnd, { once: true });
		},
		[handleScrubMove, handleScrubEnd, zoom, scrollContainerRef],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 用 scrollLeft 作为 Trigger 以避免将 scrollLeft 加入 useCallback 导致频繁解绑事件
	useEffect(() => {
		if (isScrubbingRef.current) {
			updateScrubPosition(lastClientXRef.current);
		}
	}, [scrollLeft, updateScrubPosition]);

	return { handleScrubStart };
}
