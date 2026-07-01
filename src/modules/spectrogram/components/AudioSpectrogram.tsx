import {
	EyeFilled,
	EyeOffFilled,
	MusicNote2Filled,
} from "@fluentui/react-icons";
import {
	Button,
	Flex,
	IconButton,
	Slider,
	Text,
	Theme,
	Tooltip,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
	type FC,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useFileOpener } from "$/hooks/useFileOpener.ts";
import { audioEngine } from "$/modules/audio/audio-engine.ts";
import {
	audioEngineStateAtom,
	currentDurationAtom,
	isAuditioningAtom,
	pcmDataReadyAtom,
} from "$/modules/audio/states/index.ts";
import { useScrubbing } from "$/modules/spectrogram/hooks/useScrubbing";
import { useSpectrogramInteraction } from "$/modules/spectrogram/hooks/useSpectrogramInteraction.ts";
import { useSpectrogramResize } from "$/modules/spectrogram/hooks/useSpectrogramResize.ts";
import { useSpectrogramWorker } from "$/modules/spectrogram/hooks/useSpectrogramWorker.ts";
import { useTimelineEditing } from "$/modules/spectrogram/hooks/useTimelineEditing.ts";
import {
	currentPaletteAtom,
	spectrogramContainerWidthAtom,
	spectrogramGainAtom,
	spectrogramHeightAtom,
	spectrogramHoverPxAtom,
	spectrogramHoverTimeMsAtom,
} from "$/modules/spectrogram/states";
import { isDraggingAtom } from "$/modules/spectrogram/states/dnd.ts";
import { selectedLinesAtom, showUnselectedLinesAtom } from "$/states/main.ts";
import { msToTimestamp } from "$/utils/timestamp.ts";
import styles from "./AudioSpectrogram.module.css";
import { LyricTimelineOverlay } from "./LyricTimelineOverlay.tsx";
import {
	type ISpectrogramContext,
	SpectrogramContext,
} from "./SpectrogramContext.ts";
import { TileComponent, type TileComponentProps } from "./TileComponent.tsx";
import {
	RULER_HEIGHT,
	TimelineRuler,
	type TimelineRulerHandle,
} from "./TimelineRuler.tsx";

const TILE_DURATION_S = 5;
const LOD_WIDTHS = [512, 1024, 2048, 4096, 8192];

export const AudioSpectrogram: FC = () => {
	const pcmDataReady = useAtomValue(pcmDataReadyAtom);
	const currentDurationMs = useAtomValue(currentDurationAtom);
	const engineState = useAtomValue(audioEngineStateAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);

	const isAuditioning = useAtomValue(isAuditioningAtom);
	const playheadCursorRef = useRef<HTMLDivElement>(null);
	const playheadScrubHandleRef = useRef<HTMLDivElement>(null);
	const auditionCursorRef = useRef<HTMLDivElement>(null);

	const [gain, setGain] = useAtom(spectrogramGainAtom);
	const [dataHeight, setDataHeight] = useAtom(spectrogramHeightAtom);
	const [showUnselectedLines, setShowUnselectedLines] = useAtom(
		showUnselectedLinesAtom,
	);

	const { height: uiHeight, resizeHandleProps } = useSpectrogramResize({
		initialHeight: dataHeight,
		onCommit: setDataHeight,
	});
	const palette = useAtomValue(currentPaletteAtom);
	const [visibleTiles, setVisibleTiles] = useState<TileComponentProps[]>([]);

	const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	const [containerWidth, setContainerWidth] = useAtom(
		spectrogramContainerWidthAtom,
	);

	const { zoom, scrollLeft, isZooming } = useSpectrogramInteraction(
		scrollContainerRef,
		containerWidth,
		pcmDataReady,
	);

	const viewStateRef = useRef({ zoom, scrollLeft, containerWidth });

	useLayoutEffect(() => {
		viewStateRef.current = { zoom, scrollLeft, containerWidth };
	}, [zoom, scrollLeft, containerWidth]);

	const syncCursorsToDOM = useCallback((timeInSeconds: number) => {
		const { zoom, scrollLeft, containerWidth } = viewStateRef.current;

		const cursorPosition = timeInSeconds * zoom;
		const handleLeftPosition = cursorPosition - scrollLeft;

		if (playheadCursorRef.current) {
			playheadCursorRef.current.style.left = `${cursorPosition}px`;
		}

		if (auditionCursorRef.current) {
			auditionCursorRef.current.style.left = `${cursorPosition}px`;
		}

		if (playheadScrubHandleRef.current) {
			playheadScrubHandleRef.current.style.left = `${handleLeftPosition}px`;
			playheadScrubHandleRef.current.style.display =
				handleLeftPosition < 0 || handleLeftPosition > containerWidth
					? "none"
					: "block";
		}
	}, []);

	useEffect(() => {
		syncCursorsToDOM(audioEngine.musicCurrentTime);
		audioEngine.onTimeUpdate(syncCursorsToDOM);

		return () => audioEngine.offTimeUpdate(syncCursorsToDOM);
	}, [syncCursorsToDOM]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 因为暂停时不发射进度，依赖视口状态作为 Trigger 强制同步游标
	useEffect(() => {
		syncCursorsToDOM(audioEngine.musicCurrentTime);
	}, [zoom, scrollLeft, containerWidth, syncCursorsToDOM]);

	const [isHovering, setIsHovering] = useState(false);
	const hoverPx = useAtomValue(spectrogramHoverPxAtom);
	const setHoverPx = useSetAtom(spectrogramHoverPxAtom);
	const hoverTimeMs = useAtomValue(spectrogramHoverTimeMsAtom);
	const isDragging = useAtomValue(isDraggingAtom);

	const rulerRef = useRef<TimelineRulerHandle>(null);

	const { openFile } = useFileOpener();
	const handleLoadMusic = useCallback(() => {
		const inputEl = document.createElement("input");
		inputEl.type = "file";
		inputEl.accept = "audio/*,*/*";
		inputEl.addEventListener(
			"change",
			() => {
				const file = inputEl.files?.[0];
				if (!file) return;
				openFile(file);
			},
			{ once: true },
		);
		inputEl.click();
	}, [openFile]);

	const { t } = useTranslation();

	const { tileCache, requestTileIfNeeded, lastTileTimestamp } =
		useSpectrogramWorker(pcmDataReady, currentDurationMs, palette.data);

	const {
		handleContainerMouseDown,
		isInvalidEndTime,
		pendingCursorPosition,
		showRangePreview,
		previewStyle,
		editingTimeField,
	} = useTimelineEditing(scrollLeft, zoom);

	const { handleScrubStart } = useScrubbing(
		scrollContainerRef,
		scrollLeft,
		zoom,
	);

	const contextValue = useMemo<ISpectrogramContext>(
		() => ({
			scrollContainerRef,
			zoom,
			scrollLeft,
		}),
		[zoom, scrollLeft],
	);

	// useEffect(() => {
	// 	if (!pcmDataReady) {
	// 		setVisibleTiles([]);
	// 	}
	// }, [pcmDataReady]);

	const updateVisibleTiles = useCallback(() => {
		if (!pcmDataReady || currentDurationMs <= 0 || !scrollContainerRef.current)
			return;
		const durationS = currentDurationMs / 1000;
		const pixelsPerSecond = zoom;
		const tileDisplayWidthPx = TILE_DURATION_S * pixelsPerSecond;
		const totalTiles = Math.ceil(durationS / TILE_DURATION_S);

		const viewStart = scrollLeft;
		const viewEnd = viewStart + containerWidth;

		const firstVisibleIndex = Math.floor(viewStart / tileDisplayWidthPx);
		const lastVisibleIndex = Math.ceil(viewEnd / tileDisplayWidthPx);

		const newVisibleTiles: TileComponentProps[] = [];

		const currentPaletteId = palette.id;

		for (let i = firstVisibleIndex - 2; i <= lastVisibleIndex + 2; i++) {
			if (i < 0 || i >= totalTiles) continue;

			const cacheId = `tile-${i}`;
			const targetLodWidth =
				LOD_WIDTHS.find((w) => w >= tileDisplayWidthPx) ||
				LOD_WIDTHS[LOD_WIDTHS.length - 1];

			requestTileIfNeeded({
				tileIndex: i,
				startTime: i * TILE_DURATION_S,
				endTime: i * TILE_DURATION_S + TILE_DURATION_S,
				gain: gain,
				height: dataHeight,
				tileWidthPx: targetLodWidth,
				paletteId: currentPaletteId,
			});

			const cacheEntry = tileCache.current.get(cacheId);
			const currentBitmap = cacheEntry?.bitmap;

			newVisibleTiles.push({
				tileId: cacheId,
				left: i * tileDisplayWidthPx,
				width: tileDisplayWidthPx,
				height: dataHeight,
				canvasWidth: currentBitmap?.width || targetLodWidth,
				bitmap: currentBitmap,
			});
		}
		setVisibleTiles(newVisibleTiles);
	}, [
		pcmDataReady,
		currentDurationMs,
		containerWidth,
		gain,
		dataHeight,
		requestTileIfNeeded,
		tileCache,
		palette.id,
		zoom,
		scrollLeft,
	]);

	const updateVisibleTilesRef = useRef(updateVisibleTiles);
	useLayoutEffect(() => {
		updateVisibleTilesRef.current = updateVisibleTiles;
	}, [updateVisibleTiles]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: lastTileTimestamp 用来重运行这个 effect
	useEffect(() => {
		updateVisibleTiles();
	}, [updateVisibleTiles, lastTileTimestamp]);

	const handleRulerSeek = (timeInSeconds: number) => {
		audioEngine.seekMusic(timeInSeconds);
	};

	useLayoutEffect(() => {
		if (lastTileTimestamp === 0) {
			return;
		}
		rulerRef.current?.draw(scrollLeft);
		updateVisibleTilesRef.current();
	}, [scrollLeft, lastTileTimestamp]);

	useLayoutEffect(() => {
		if (lastTileTimestamp === 0 && !pcmDataReady && !currentDurationMs) {
			return;
		}
		rulerRef.current?.draw(scrollLeft);
		updateVisibleTilesRef.current();
	}, [scrollLeft, lastTileTimestamp, pcmDataReady, currentDurationMs]);

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!pcmDataReady || !container || !currentDurationMs) return;

		const observer = new ResizeObserver((entries) => {
			if (entries[0]) {
				setContainerWidth(entries[0].contentRect.width);
			}
		});

		observer.observe(container);
		setContainerWidth(container.clientWidth);

		return () => observer.disconnect();
	}, [setContainerWidth, pcmDataReady, currentDurationMs]);

	const handleMouseEnter = () => setIsHovering(true);
	const handleMouseLeave = () => setIsHovering(false);
	const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
		if (!isHovering) {
			setIsHovering(true);
		}

		const rect = event.currentTarget.getBoundingClientRect();
		const x = event.clientX - rect.left;
		setHoverPx(x);
	};

	const totalWidth =
		currentDurationMs > 0 ? (currentDurationMs / 1000) * zoom : 0;

	let hoverTimeFormatted = msToTimestamp(hoverTimeMs);
	let tooltipBgColor: string | undefined;
	let hoverLineColor: string | undefined;

	if (isInvalidEndTime) {
		hoverTimeFormatted = t("spectrogram.invalidEndTime", "不能选择此结束时间");
		tooltipBgColor = "var(--red-9)";
		hoverLineColor = "var(--red-9)";
	} else if (editingTimeField && !editingTimeField.isWord) {
		const fieldName =
			editingTimeField.field === "startTime"
				? t("ribbonBar.editMode.startTime", "起始时间")
				: t("ribbonBar.editMode.endTime", "结束时间");
		hoverTimeFormatted = `${t("common.clickToSet", "点击设置")}${fieldName}: ${hoverTimeFormatted}`;
		tooltipBgColor = "var(--accent-9)";
	}

	const transformX = isZooming ? scrollLeft : Math.round(scrollLeft);

	const hoverX = scrollLeft + hoverPx;

	const minGain = 0.5;
	const maxGain = 8;
	const gainPercent = ((gain - minGain) / (maxGain - minGain)) * 100;
	const THUMB_HEIGHT_PX = 13;
	const thumbOffsetPx = (0.5 - gainPercent / 100) * THUMB_HEIGHT_PX;

	return (
		<div
			className={styles.spectrogramContainer}
			style={{ height: `${uiHeight}px` }}
		>
			<div className={styles.resizeHandle} {...resizeHandleProps} />

			<div className={styles.innerContainer}>
				<div className={`${styles.sidebar} ${styles.leftSidebar}`}>
					<Flex
						direction="column"
						align="center"
						gap="2"
						style={{ height: "100%", width: "100%" }}
					>
						<Flex
							direction="column"
							align="center"
							justify="end"
							style={{ flex: 1, width: "100%", padding: "4px 0" }}
						>
							<div
								className={styles.gainSliderContainer}
								style={{ height: "95%" }}
							>
								<Slider
									orientation="vertical"
									size="1"
									min={minGain}
									max={maxGain}
									step={0.5}
									value={[gain]}
									onValueChange={(v) => setGain(v[0])}
									style={{ flex: 1, width: "18px", zIndex: 10 }}
								/>
								<div
									className={styles.gainTooltip}
									style={{
										bottom: `calc(${gainPercent}% + ${thumbOffsetPx}px)`,
									}}
								>
									{gain}x
								</div>
							</div>
						</Flex>
					</Flex>
				</div>

				<div className={styles.mainContent}>
					{!pcmDataReady ? (
						<div className={styles.emptyState}>
							<Flex direction="column" align="center" gap="3">
								<MusicNote2Filled
									fontSize={48}
									color="var(--gray-8)"
									style={{ opacity: 0.5 }}
								/>
								{engineState === "loading" || engineState === "ready" ? (
									<Text color="gray" size="3">
										{t("spectrogram.decoding", "正在解码音频，请稍候...")}
									</Text>
								) : (
									<>
										<Text color="gray" size="3">
											{t(
												"spectrogram.noAudioLoaded",
												"请先加载一个音频文件来渲染频谱图哦",
											)}
										</Text>
										<Button variant="soft" onClick={handleLoadMusic}>
											{t("spectrogram.loadAudio", "加载音频文件")}
										</Button>
									</>
								)}
							</Flex>
						</div>
					) : (
						<>
							<TimelineRuler
								ref={rulerRef}
								zoom={zoom}
								duration={currentDurationMs / 1000}
								containerWidth={containerWidth}
								onSeek={handleRulerSeek}
							/>

							{!isDragging && (
								<>
									<div
										className={styles.hoverTimeTooltip}
										style={{
											left: `${hoverPx}px`,
											opacity: isHovering ? 1 : 0,
											backgroundColor: tooltipBgColor,
										}}
									>
										{hoverTimeFormatted}
									</div>

									<div
										className={`${styles.rulerHoverFade} ${styles.rulerHoverFadeLeft}`}
										style={{
											width: `${hoverPx}px`,
											height: `${RULER_HEIGHT}px`,
											opacity: isHovering ? 1 : 0,
										}}
									/>

									<div
										className={`${styles.rulerHoverFade} ${styles.rulerHoverFadeRight}`}
										style={{
											left: `${hoverPx}px`,
											height: `${RULER_HEIGHT}px`,
											opacity: isHovering ? 1 : 0,
										}}
									/>
								</>
							)}

							<div
								ref={playheadScrubHandleRef}
								className={styles.playheadScrubHandle}
								style={{
									display: "none",
								}}
								onMouseDown={handleScrubStart}
							/>

							<div
								ref={scrollContainerRef}
								className={styles.virtualScrollContainer}
								onMouseEnter={handleMouseEnter}
								onMouseLeave={handleMouseLeave}
								onMouseMove={handleMouseMove}
								onMouseDown={handleContainerMouseDown}
								onContextMenu={(e) => e.preventDefault()}
								role="group"
							>
								<div
									className={styles.virtualScrollContent}
									style={{
										width: `${Math.ceil(totalWidth)}px`,
										transform: `translate3d(${-transformX}px, 0, 0)`,
									}}
								>
									{visibleTiles.map((tile) => (
										<TileComponent key={tile.tileId} {...tile} />
									))}
									<div
										ref={playheadCursorRef}
										className={styles.playheadCursor}
									/>

									{pendingCursorPosition !== null && (
										<div
											className={styles.pendingCursor}
											style={{
												left: `${pendingCursorPosition}px`,
											}}
										/>
									)}
									{isAuditioning && (
										<div
											ref={auditionCursorRef}
											className={styles.auditionCursor}
										/>
									)}
									{showRangePreview && previewStyle && (
										<div
											className={styles.rangePreviewRegion}
											style={previewStyle}
										/>
									)}
									<SpectrogramContext.Provider value={contextValue}>
										<Theme appearance="dark">
											<LyricTimelineOverlay
												clientWidth={containerWidth}
												hiddenLineIds={showRangePreview ? selectedLines : null}
											/>
											{!isDragging && (
												<div
													className={styles.hoverCursorContainer}
													style={{
														left: `${hoverX}px`,
														opacity: isHovering ? 1 : 0,
													}}
												>
													<div
														className={styles.hoverCursorLine}
														style={{ backgroundColor: hoverLineColor }}
													/>
												</div>
											)}
										</Theme>
									</SpectrogramContext.Provider>
								</div>
							</div>
						</>
					)}
				</div>

				<div className={`${styles.sidebar} ${styles.rightSidebar}`}>
					<Tooltip
						content={t("spectrogram.showUnselectedLines", "显示未选中行")}
						side="left"
					>
						<IconButton
							variant={showUnselectedLines ? "solid" : "outline"}
							onClick={() => setShowUnselectedLines((prev) => !prev)}
						>
							{showUnselectedLines ? <EyeFilled /> : <EyeOffFilled />}
						</IconButton>
					</Tooltip>
				</div>
			</div>
		</div>
	);
};

export default AudioSpectrogram;
