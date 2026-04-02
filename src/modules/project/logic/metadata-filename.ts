import type { TTMLMetadata } from "$/types/ttml";

type SuggestedTtmlFileName = {
	baseName: string;
	fileName: string;
};

const getFirstNonEmptyValue = (values?: string[]): string | null => {
	if (!values) return null;
	for (const value of values) {
		const trimmed = value.trim();
		if (trimmed) return trimmed;
	}
	return null;
};

export const getSuggestedTtmlFileName = (
	metadata: TTMLMetadata[],
): SuggestedTtmlFileName | null => {
	const musicName = getFirstNonEmptyValue(
		metadata.find((entry) => entry.key === "musicName")?.value,
	);
	const artists = getFirstNonEmptyValue(
		metadata.find((entry) => entry.key === "artists")?.value,
	);

	if (!musicName || !artists) return null;

	const baseName = `${artists} - ${musicName}`;
	return {
		baseName,
		fileName: `${baseName}.ttml`,
	};
};
