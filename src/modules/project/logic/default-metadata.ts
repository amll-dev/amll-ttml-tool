import type { TTMLMetadata } from "$/types/ttml";

export interface DefaultTtmlAuthorMetadata {
	githubId: string;
	githubLogin: string;
}

const setDefaultValueIfEmpty = (
	metadata: TTMLMetadata[],
	key: string,
	value: string,
) => {
	const trimmed = value.trim();
	if (!trimmed) return false;

	const current = metadata.find((item) => item.key === key);
	if (!current) {
		metadata.push({ key, value: [trimmed] });
		return true;
	}

	if (current.value.some((item) => item.trim() !== "")) return false;
	current.value = [trimmed];
	return true;
};

export const applyDefaultTtmlAuthorMetadata = (
	metadata: TTMLMetadata[],
	defaults: DefaultTtmlAuthorMetadata,
) => {
	const githubIdChanged = setDefaultValueIfEmpty(
		metadata,
		"ttmlAuthorGithub",
		defaults.githubId,
	);
	const githubLoginChanged = setDefaultValueIfEmpty(
		metadata,
		"ttmlAuthorGithubLogin",
		defaults.githubLogin,
	);
	return githubIdChanged || githubLoginChanged;
};
