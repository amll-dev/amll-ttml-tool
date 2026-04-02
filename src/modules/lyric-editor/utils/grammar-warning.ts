import type { LyricLine } from "$/types/ttml";

const ENGLISH_AMBIGUOUS_WORDS = new Set([
	"your",
	"youre",
	"their",
	"there",
	"theyre",
	"its",
	"it's",
	"then",
	"than",
	"alot",
	"lose",
	"loose",
	"affect",
	"effect",
	"a",
	"an",
]);

// Top ~200 most common English words to catch basic typos
const COMMON_ENGLISH_WORDS = new Set([
	"the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with", "he", "as", "you", "do", "at", 
	"this", "but", "his", "by", "from", "they", "we", "say", "her", "she", "or", "an", "will", "my", "one", "all", "would", "there", "their", "what", 
	"so", "up", "out", "if", "about", "who", "get", "which", "go", "me", "when", "make", "can", "like", "time", "no", "just", "him", "know", "take", 
	"people", "into", "year", "your", "good", "some", "could", "them", "see", "other", "than", "then", "now", "look", "only", "come", "its", "over", "think", "also", 
	"back", "after", "use", "two", "how", "our", "work", "first", "well", "way", "even", "new", "want", "because", "any", "these", "give", "day", "most", "us",
	"love", "life", "heart", "baby", "yeah", "night", "way", "away", "never", "always", "together", "world", "dream", "feel", "smile", "blue", "everything", "nothing", "something", "anything"
]);

const levenshteinDistance = (a: string, b: string): number => {
	const matrix = Array.from({ length: a.length + 1 }, (_, i) => 
		Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
	);

	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			matrix[i][j] = Math.min(
				matrix[i - 1][j] + 1,
				matrix[i][j - 1] + 1,
				matrix[i - 1][j - 1] + cost
			);
		}
	}
	return matrix[a.length][b.length];
};

const isLatin = (text: string): boolean => /[A-Za-z]/.test(text);

const normalizeWord = (text: string): string => {
	const cleaned = text
		.trim()
		.toLowerCase()
		.replace(/[^a-z']/g, "");
	return cleaned;
};

export const isEnglishWord = (text: string): boolean => {
	const cleaned = normalizeWord(text);
	return cleaned.length > 0 && /^[a-z']+$/.test(cleaned) && isLatin(cleaned);
};

export const isWordMisspelled = (
	word: string,
	allWordsInLyrics?: Set<string>,
): boolean => {
	const current = normalizeWord(word);
	if (!current) return false;

	const inCommon = COMMON_ENGLISH_WORDS.has(current);
	const inExisting = allWordsInLyrics?.has(current);

	return !inCommon && !inExisting;
};

export const isEnglishLine = (line: LyricLine): boolean => {
	if (line.language && line.language !== "auto" && line.language !== "off") {
		return line.language.startsWith("en");
	}

	if (!line.words || line.words.length === 0) return false;
	const total = line.words.length;
	const englishCount = line.words.filter((word) =>
		isEnglishWord(word.word),
	).length;
	return total > 0 && englishCount / total >= 0.4;
};

export const collectPossibleGrammarWarnings = (
	line: LyricLine,
	ignoredWords: Set<string>,
): Set<string> => {
	const warnings = new Set<string>();
	if (!isEnglishLine(line)) return warnings;

	for (let i = 0; i < line.words.length; i++) {
		const wordObj = line.words[i];
		const current = normalizeWord(wordObj.word);
		if (!current || ignoredWords.has(current)) continue;

		// repeated words
		if (i > 0) {
			const prevRaw = line.words[i - 1].word;
			const currentRaw = wordObj.word;
			const prev = normalizeWord(prevRaw);
			if (prev && current === prev) {
				const hasSpaceBetween =
					/\s$/.test(prevRaw) || /^\s/.test(currentRaw);
				const hasPunctuationBetween =
					/[.,!?;:]$/.test(prevRaw.trim()) ||
					/^[.,!?;:]/.test(currentRaw.trim());
				if (hasSpaceBetween || hasPunctuationBetween) {
					warnings.add(line.words[i - 1].id);
					warnings.add(line.words[i].id);
				}
			}
		}

		if (ENGLISH_AMBIGUOUS_WORDS.has(current)) {
			warnings.add(wordObj.id);
		}

		if (current === "a" || current === "an") {
			const nextWord = line.words[i + 1]?.word;
			const next = normalizeWord(nextWord || "");
			if (next) {
				const startsWithVowel = /^[aeiou]/.test(next);
				if (
					(current === "a" && startsWithVowel) ||
					(current === "an" && !startsWithVowel)
				) {
					warnings.add(wordObj.id);
					if (line.words[i + 1]) warnings.add(line.words[i + 1].id);
				}
			}
		}

		// Basic typo detection: word is not in common list
		if (current.length >= 3 && !COMMON_ENGLISH_WORDS.has(current)) {
			// If it's a very short word, only flag it if it's very likely to be a typo
			// (actually, let's just flag words not in COMMON_ENGLISH_WORDS)
			warnings.add(wordObj.id);
		}

		// Capitalization check for the first word of the line
		if (i === 0 && !warnings.has(wordObj.id)) {
			const firstAlphaIndex = wordObj.word.search(/[a-zA-Z]/);
			if (firstAlphaIndex !== -1) {
				const char = wordObj.word[firstAlphaIndex];
				if (char === char.toLowerCase()) {
					warnings.add(wordObj.id);
				}
			}
		}

		// Punctuation check for the last word of the line
		if (i === line.words.length - 1 && !warnings.has(wordObj.id)) {
			const rawWord = wordObj.word.trim();
			if (rawWord.endsWith(".") || rawWord.endsWith(",")) {
				warnings.add(wordObj.id);
			}
		}
	}

	return warnings;
};

export const collectWarningsWithSuggestions = (
	line: LyricLine,
	ignoredWords: Set<string>,
	allWordsInLyrics?: Set<string>,
): Set<string> => {
	const rawWarnings = collectPossibleGrammarWarnings(line, ignoredWords);
	if (rawWarnings.size === 0) return rawWarnings;

	const filteredWarnings = new Set<string>();
	for (const wordId of rawWarnings) {
		const wordIndex = line.words.findIndex((w) => w.id === wordId);
		if (wordIndex !== -1) {
			const suggestions = getGrammarSuggestions(
				line,
				wordIndex,
				allWordsInLyrics,
			);
			if (suggestions.length > 0) {
				filteredWarnings.add(wordId);
			}
		}
	}
	return filteredWarnings;
};

export const getGrammarSuggestions = (
	line: LyricLine,
	wordIndex: number,
	allWordsInLyrics?: Set<string>,
): string[] => {
	const suggestions: string[] = [];
	const word = line.words[wordIndex];
	if (!word) return suggestions;
	const current = normalizeWord(word.word);

	// For capitalization check
	const firstAlphaIndex = word.word.search(/[a-zA-Z]/);
	if (wordIndex === 0 && firstAlphaIndex !== -1) {
		const char = word.word[firstAlphaIndex];
		if (char === char.toLowerCase()) {
			const capitalized =
				word.word.slice(0, firstAlphaIndex) +
				char.toUpperCase() +
				word.word.slice(firstAlphaIndex + 1);
			suggestions.push(capitalized);
		}
	}

	// For a/an
	if (current === "a" || current === "an") {
		const nextWord = line.words[wordIndex + 1]?.word;
		const next = normalizeWord(nextWord || "");
		if (next) {
			const startsWithVowel = /^[aeiou]/.test(next);
			if (current === "a" && startsWithVowel) {
				suggestions.push("an");
			} else if (current === "an" && !startsWithVowel) {
				suggestions.push("a");
			}
		}
	}

	// For ambiguous words, suggest common alternatives
	if (ENGLISH_AMBIGUOUS_WORDS.has(current)) {
		const alternatives: Record<string, string[]> = {
			your: ["you're"],
			youre: ["your"],
			their: ["they're"],
			there: ["their"],
			theyre: ["their", "there"],
			its: ["it's"],
			"it's": ["its"],
			alot: ["a lot"],
			lose: ["loose"],
			loose: ["lose"],
			affect: ["effect"],
			effect: ["affect"],
		};
		const alts = alternatives[current];
		if (alts) suggestions.push(...alts);
	}

	if (wordIndex > 0) {
		const prevRaw = line.words[wordIndex - 1].word;
		const currentRaw = word.word;
		const prev = normalizeWord(prevRaw);
		if (prev && current === prev) {
			const hasSpaceBetween =
				/\s$/.test(prevRaw) || /^\s/.test(currentRaw);
			const hasPunctuationBetween =
				/[.,!?;:]$/.test(prevRaw.trim()) ||
				/^[.,!?;:]/.test(currentRaw.trim());
			if (hasSpaceBetween || hasPunctuationBetween) {
				suggestions.push("__REMOVE_REPEATED_WORD__");
			}
		}
	}

	// Fuzzy matching for potential typos
	if (current.length >= 3) {
		const candidates = new Set([...COMMON_ENGLISH_WORDS]);
		if (allWordsInLyrics) {
			for (const w of allWordsInLyrics) candidates.add(w);
		}

		const matches: { word: string; dist: number }[] = [];
		for (const cand of candidates) {
			if (cand === current) continue;
			// Only suggest words of similar length
			if (Math.abs(cand.length - current.length) > 2) continue;
			
			const dist = levenshteinDistance(current, cand);
			if (dist <= 1 || (current.length > 5 && dist <= 2)) {
				matches.push({ word: cand, dist });
			}
		}

		matches.sort((a, b) => a.dist - b.dist);
		suggestions.push(...matches.slice(0, 3).map(m => m.word));
	}

	const result = [...new Set(suggestions)];

	// If it's the first word of the line, capitalize all suggestions
	if (wordIndex === 0) {
		return result.map((s) => {
			if (s.startsWith("__")) return s;
			const firstAlphaIndex = s.search(/[a-zA-Z]/);
			if (firstAlphaIndex !== -1) {
				return (
					s.slice(0, firstAlphaIndex) +
					s[firstAlphaIndex].toUpperCase() +
					s.slice(firstAlphaIndex + 1)
				);
			}
			return s;
		});
	}

	// For line-ending punctuation removal
	if (wordIndex === line.words.length - 1) {
		const rawWord = word.word.trim();
		if (rawWord.endsWith(".") || rawWord.endsWith(",")) {
			result.push(rawWord.slice(0, -1).trim());
		}
	}

	return result;
};
