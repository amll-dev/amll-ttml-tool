import { useAtomValue } from "jotai";
import { useCallback, useRef, useState } from "react";
import { msToTimestamp } from "$/utils/timestamp";
import { currentDurationAtom } from "../states";

export const useHoverGuide = (sliderWidthPx: number) => {
	const currentDuration = useAtomValue(currentDurationAtom);
	const [hoverState, setHoverState] = useState({
		x: 0,
		timeStr: "0:00",
		isNearRight: false,
		isVisible: false,
	});

	const isDraggingRef = useRef(false);

	const handleContainerMouseMove = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (isDraggingRef.current || currentDuration <= 0 || sliderWidthPx <= 0) {
				setHoverState((prev) => ({ ...prev, isVisible: false }));
				return;
			}

			const target = e.target as HTMLElement;
			if (target.closest("[data-drag-type]")) {
				setHoverState((prev) => ({ ...prev, isVisible: false }));
				return;
			}

			const rect = e.currentTarget.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const clampedX = Math.max(0, Math.min(x, rect.width));
			const isNearRight = rect.width - clampedX < 80;
			const progress = clampedX / rect.width;
			const timeMs = progress * currentDuration;

			setHoverState({
				x: clampedX,
				timeStr: msToTimestamp(timeMs),
				isNearRight,
				isVisible: true,
			});
		},
		[currentDuration, sliderWidthPx],
	);

	const handleContainerMouseLeave = useCallback(() => {
		setHoverState((prev) => ({ ...prev, isVisible: false }));
	}, []);

	return {
		hoverState,
		handleContainerMouseMove,
		handleContainerMouseLeave,
		isDraggingRef,
	};
};
