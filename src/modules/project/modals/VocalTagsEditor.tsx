import { Add16Regular, Delete16Regular } from "@fluentui/react-icons";
import { Button, Dialog, Flex, Text, TextField } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useImmerAtom } from "jotai-immer";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { vocalTagsEditorDialogAtom } from "$/states/dialogs.ts";
import { lyricLinesAtom } from "$/states/main.ts";
import type { LyricLine, TTMLLyric } from "$/types/ttml";
import styles from "./VocalTagsEditor.module.css";

const getLineText = (line: LyricLine) => line.words.map((word) => word.word).join("");
const parseLineVocalIds = (value?: string | string[]) => {
	if (!value) return [];
	const parts = Array.isArray(value) ? value : value.split(/[\s,]+/);
	return parts.map((v) => v.trim()).filter(Boolean);
};
const getNextVocalId = (ids: string[]) => {
	let maxId = 0;
	for (const id of ids) {
		if (!/^[0-9]+$/.test(id)) continue;
		const parsed = Number.parseInt(id, 10);
		if (Number.isFinite(parsed)) maxId = Math.max(maxId, parsed);
	}
	const nextId = maxId > 0 ? maxId + 1 : ids.length + 1;
	return `${nextId}`;
};
const hasDuplicateTag = (
	tags: Array<{ value: string }>,
	value: string,
	excludeIndex?: number,
) => {
	const normalized = value.trim();
	return tags.some((tag, index) => {
		if (excludeIndex === index) return false;
		return tag.value.trim() === normalized;
	});
};
const reassignVocalIds = (draft: TTMLLyric) => {
	if (!draft.vocalTags || draft.vocalTags.length === 0) {
		draft.lyricLines.forEach((line) => {
			line.vocal = [];
		});
		return;
	}
	const idMap = new Map<string, string>();
	draft.vocalTags.forEach((tag, index) => {
		const nextId = `${index + 1}`;
		idMap.set(tag.key, nextId);
		tag.key = nextId;
	});
	draft.lyricLines.forEach((line) => {
		const ids = parseLineVocalIds(line.vocal);
		const mapped = ids
			.map((id) => idMap.get(id))
			.filter((value): value is string => !!value);
		line.vocal = mapped;
	});
};

export const VocalTagsEditor = () => {
	const [open, setOpen] = useAtom(vocalTagsEditorDialogAtom);
	const [lyricLines, setLyricLines] = useImmerAtom(lyricLinesAtom);
	const { t } = useTranslation();
	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	const [editingValue, setEditingValue] = useState("");
	const [isAdding, setIsAdding] = useState(false);
	const [newTagValue, setNewTagValue] = useState("");

	const vocalTags = lyricLines.vocalTags ?? [];
	const vocalTagIds = useMemo(
		() => Array.from(new Set(vocalTags.map((tag) => tag.key).filter(Boolean))),
		[vocalTags],
	);
	const artistNames = useMemo(() => {
		const artists = lyricLines.metadata.find((meta) => meta.key === "artists");
		if (!artists) return [];
		return artists.value
			.map((value) => value.trim())
			.filter((value) => value.length > 0);
	}, [lyricLines.metadata]);

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content className={styles.dialogContent}>
				<div className={styles.dialogHeader}>
					<Dialog.Title style={{ margin: 0 }}>
						{t("vocalTagsDialog.title", "演唱者标签")}
					</Dialog.Title>
				</div>
				<div className={styles.dialogBody}>
					<section>
						<div className={styles.sectionHeader}>
							<Flex align="center" justify="between">
								<Text size="3" weight="medium">
									{t("vocalTagsDialog.mappingTitle", "演唱者标签")}
								</Text>
								<Flex align="center" gap="2">
									<Button
										variant="soft"
										disabled={artistNames.length === 0}
										onClick={() => {
											if (artistNames.length === 0) return;
											setLyricLines((draft) => {
												draft.vocalTags ??= [];
												for (const name of artistNames) {
													if (hasDuplicateTag(draft.vocalTags, name)) continue;
													const nextId = getNextVocalId(
														draft.vocalTags.map((tag) => tag.key),
													);
													draft.vocalTags.push({ key: nextId, value: name });
												}
											});
									}}
									>
										{t("vocalTagsDialog.importFromArtists", "从 artists 导入")}
									</Button>
									<Button
										variant="soft"
										color="red"
										onClick={() => {
											setLyricLines((draft) => {
												draft.lyricLines.forEach((line) => {
													line.vocal = [];
												});
											});
									}}
									>
										{t("vocalTagsDialog.clearAssignments", "清空分配")}
									</Button>
									<Button
										color="red"
										variant="solid"
										onClick={() => {
											setLyricLines((draft) => {
												draft.vocalTags = [];
												draft.lyricLines.forEach((line) => {
													line.vocal = [];
												});
											});
									}}
									>
										<Delete16Regular />
										{t("vocalTagsDialog.clear", "清空")}
									</Button>
								</Flex>
							</Flex>
						</div>
						{vocalTags.length === 0 && (
							<Text size="2" color="gray">
								{t("vocalTagsDialog.empty", "暂无演唱者标签。")}
							</Text>
						)}
						<div className={styles.tagList}>
							{vocalTags.map((tag, index) =>
								editingIndex === index ? (
									<TextField.Root
										key={`vocal-tag-edit-${tag.key}`}
										className={styles.tagControl}
										autoFocus
										value={editingValue}
										placeholder={t(
											"vocalTagsDialog.valuePlaceholder",
											"显示名称",
										)}
										onChange={(e) => setEditingValue(e.currentTarget.value)}
										onKeyDown={(e) => {
											if (e.key !== "Enter") return;
											const trimmed = editingValue.trim();
											setLyricLines((draft) => {
												if (!draft.vocalTags) return;
												if (!trimmed) {
													draft.vocalTags.splice(index, 1);
													reassignVocalIds(draft);
													return;
												}
												if (hasDuplicateTag(draft.vocalTags, trimmed, index)) return;
												const target = draft.vocalTags[index];
												if (target) target.value = trimmed;
											});
											setEditingIndex(null);
										}}
										onBlur={() => setEditingIndex(null)}
									/>
								) : (
									<Button
										key={`vocal-tag-${tag.key}`}
										className={styles.tagControl}
										variant="soft"
										onClick={() => {
											setEditingIndex(index);
											setEditingValue(tag.value ?? "");
										}}
									>
										{tag.value?.trim()
											? `${tag.key}: ${tag.value}`
											: `${tag.key}: ${t("vocalTagsDialog.untitled", "(未命名)")}`}
									</Button>
								),
							)}
							{isAdding ? (
								<TextField.Root
									className={styles.tagControl}
									autoFocus
									value={newTagValue}
									placeholder={t(
										"vocalTagsDialog.valuePlaceholder",
										"显示名称",
									)}
									onChange={(e) => setNewTagValue(e.currentTarget.value)}
									onKeyDown={(e) => {
										if (e.key !== "Enter") return;
										const trimmed = newTagValue.trim();
										if (!trimmed) {
											setIsAdding(false);
											return;
										}
										setLyricLines((draft) => {
											draft.vocalTags ??= [];
											if (hasDuplicateTag(draft.vocalTags, trimmed)) return;
											const nextId = getNextVocalId(
												draft.vocalTags.map((tag) => tag.key),
											);
											draft.vocalTags.push({ key: nextId, value: trimmed });
										});
										setIsAdding(false);
										setNewTagValue("");
									}}
									onBlur={() => setIsAdding(false)}
								/>
							) : (
								<Button
									className={styles.tagControl}
									variant="soft"
									onClick={() => {
										setIsAdding(true);
										setNewTagValue("");
									}}
								>
									<Flex align="center" gap="2">
										<Add16Regular />
										{t("vocalTagsDialog.addTag", "添加演唱者标签")}
									</Flex>
								</Button>
							)}
						</div>
					</section>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
};

