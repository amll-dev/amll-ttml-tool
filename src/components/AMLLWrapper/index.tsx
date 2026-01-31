// #if AMLL_LOCAL_EXISTS
// #warning Using local Apple Music Like Lyrics, skip importing css style
// #else
import "@applemusic-like-lyrics/core/style.css";

// #endif

// import { MaskObsceneWordsMode } from "@applemusic-like-lyrics/core";
import {
	LyricPlayer,
	type LyricPlayerRef,
} from "@applemusic-like-lyrics/react";
import { Card } from "@radix-ui/themes";
import structuredClone from "@ungap/structured-clone";
import classNames from "classnames";
import { useAtomValue } from "jotai";
import { memo, useEffect, useMemo, useRef } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import { audioPlayingAtom, currentTimeAtom } from "$/modules/audio/states";
import {
	// hideObsceneWordsAtom,
	lyricWordFadeWidthAtom,
	showRomanLinesAtom,
	showTranslationLinesAtom,
} from "$/modules/settings/states/preview";
import { isDarkThemeAtom, lyricLinesAtom } from "$/states/main.ts";
import styles from "./index.module.css";

const parseLineVocalIds = (value?: string | string[]) => {
	if (!value) return [];
	const parts = Array.isArray(value) ? value : value.split(/[\s,]+/);
	return parts.map((v) => v.trim()).filter(Boolean);
};

const mapVocalTagsForPreview = (
	vocal: string | string[] | undefined,
	vocalTagMap: Map<string, string>,
) => {
	if (!vocal) return;
	const fallbackParts = Array.isArray(vocal) ? vocal : [vocal];
	const normalizedFallback = fallbackParts
		.map((v) => v.trim())
		.filter(Boolean);
	if (vocalTagMap.size === 0) {
		return normalizedFallback.length > 0 ? normalizedFallback : undefined;
	}
	const ids = parseLineVocalIds(vocal);
	if (ids.length === 0) return;
	let hasMatch = false;
	const mapped = ids
		.map((id) => {
			const value = vocalTagMap.get(id);
			if (value && value.trim().length > 0) {
				hasMatch = true;
				return value;
			}
			if (vocalTagMap.has(id)) {
				hasMatch = true;
			}
			return id;
		})
		.map((v) => v.trim())
		.filter(Boolean);
	if (!hasMatch) {
		return normalizedFallback.length > 0 ? normalizedFallback : undefined;
	}
	return mapped.length > 0 ? mapped : undefined;
};

export const AMLLWrapper = memo(() => {
	const originalLyricLines = useAtomValue(lyricLinesAtom);
	const currentTime = useAtomValue(currentTimeAtom);
	const isPlaying = useAtomValue(audioPlayingAtom);
	const darkMode = useAtomValue(isDarkThemeAtom);
	const showTranslationLines = useAtomValue(showTranslationLinesAtom);
	const showRomanLines = useAtomValue(showRomanLinesAtom);
	// const hideObsceneWords = useAtomValue(hideObsceneWordsAtom);
	const wordFadeWidth = useAtomValue(lyricWordFadeWidthAtom);
	const playerRef = useRef<LyricPlayerRef>(null);

	const lyricLines = useMemo(() => {
		const vocalTagMap = new Map(
			(originalLyricLines.vocalTags ?? []).map((tag) => [tag.key, tag.value]),
		);
		return structuredClone(
			originalLyricLines.lyricLines.map((line) => ({
				...line,
				translatedLyric: showTranslationLines ? line.translatedLyric : "",
				romanLyric: showRomanLines ? line.romanLyric : "",
				vocal: mapVocalTagsForPreview(line.vocal, vocalTagMap),
			})),
		);
	}, [originalLyricLines, showTranslationLines, showRomanLines]);

	useEffect(() => {
		setTimeout(() => {
			playerRef.current?.lyricPlayer?.calcLayout(true);
		}, 1500);
	}, []);

	return (
		<Card className={classNames(styles.amllWrapper, darkMode && styles.isDark)}>
			<LyricPlayer
				style={{
					height: "100%",
					boxSizing: "content-box",
				}}
				onLyricLineClick={(evt) => {
					playerRef.current?.lyricPlayer?.resetScroll();
					audioEngine.seekMusic(evt.line.getLine().startTime / 1000);
				}}
				lyricLines={lyricLines}
				currentTime={currentTime}
				playing={isPlaying}
				// maskObsceneWordsMode={
				// 	hideObsceneWords
				// 		? MaskObsceneWordsMode.FullMask
				// 		: MaskObsceneWordsMode.Disabled
				// }
				wordFadeWidth={wordFadeWidth}
				ref={playerRef}
			/>
		</Card>
	);
});

export default AMLLWrapper;

