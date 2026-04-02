import {
	CheckmarkCircle24Regular,
	Dismiss24Regular,
	DocumentDismiss24Regular,
	ErrorCircle24Regular,
	Eye24Regular,
	QuestionCircle24Regular,
	Search16Regular,
	Search24Regular,
	Timer24Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Checkbox,
	Dialog,
	Flex,
	IconButton,
	ScrollArea,
	Separator,
	Skeleton,
	Spinner,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import classNames from "classnames";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { uid } from "uid";
import { segmentLyricLines } from "$/modules/segmentation/utils/segmentation";
import { useSegmentationConfig } from "$/modules/segmentation/utils/useSegmentationConfig";
import {
	confirmDialogAtom,
	importFromLRCLIBDialogAtom,
} from "$/states/dialogs.ts";
import {
	isDirtyAtom,
	lyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
} from "$/states/main.ts";
import { error as logError } from "$/utils/logging";
import { LrcLibApi } from "../api/client";
import type { LrcLibTrack } from "../types";
import { convertLrcLibTrackToTTML } from "../utils/converter";
import { extractParenthesesToBg } from "../utils/extractParenthesesToBg";
import styles from "./ImportDialog.module.css";

const formatDuration = (seconds: number) => {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
};

export const ImportFromLRCLIB = () => {
	const { t } = useTranslation();

	const [isOpen, setIsOpen] = useAtom(importFromLRCLIBDialogAtom);
	const setLyricLines = useSetAtom(lyricLinesAtom);
	const setProjectId = useSetAtom(projectIdAtom);
	const setSaveFileName = useSetAtom(saveFileNameAtom);
	const isDirty = useAtomValue(isDirtyAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);

	const [query, setQuery] = useState("");
	const [results, setResults] = useState<LrcLibTrack[]>([]);
	const [loading, setLoading] = useState(false);

	const [hasSearched, setHasSearched] = useState(false);

	const [previewTrack, setPreviewTrack] = useState<LrcLibTrack | null>(null);

	const [autoSegment, setAutoSegment] = useState(false);
	const { config: segmentationConfig } = useSegmentationConfig();
	const [extractBg, setExtractBg] = useState(false);

	const handleSearch = useCallback(async () => {
		if (!query.trim()) return;
		setLoading(true);
		setHasSearched(true);
		setResults([]);

		try {
			const data = await LrcLibApi.search(query);
			setResults(data);
		} catch (e) {
			logError("LRCLIB Search Error", e);
			toast.error(t("lrclib.searchError", "搜索失败，请检查网络或稍后重试"));
		} finally {
			setLoading(false);
		}
	}, [query, t]);

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSearch();
		}
	};

	const performImport = useCallback(
		async (track: LrcLibTrack) => {
			try {
				let ttmlData = convertLrcLibTrackToTTML(track);

				if (extractBg) {
					ttmlData = {
						...ttmlData,
						lyricLines: ttmlData.lyricLines.flatMap((line) =>
							extractParenthesesToBg(line),
						),
					};
				}

				if (autoSegment) {
					ttmlData = {
						...ttmlData,
						lyricLines: segmentLyricLines(
							ttmlData.lyricLines,
							segmentationConfig,
						),
					};
				}

				setLyricLines(ttmlData);
				setProjectId(uid());
				const safeFilename = `${track.artistName} - ${track.name}.ttml`.replace(
					/[\\/:*?"<>|]/g,
					"_",
				);
				setSaveFileName(safeFilename);

				setIsOpen(false);
				setPreviewTrack(null);
				setQuery("");
				setResults([]);
				setHasSearched(false);
			} catch (e) {
				logError("LRCLIB Import Error", e);
				toast.error(t("lrclib.importError", "导入歌词时发生错误"));
			}
		},
		[
			setLyricLines,
			setProjectId,
			setSaveFileName,
			setIsOpen,
			t,
			autoSegment,
			segmentationConfig,
			extractBg,
		],
	);

	const onTriggerImport = useCallback(
		(track: LrcLibTrack) => {
			if (isDirty) {
				setConfirmDialog({
					open: true,
					title: t("confirmDialog.importFile.title", "确认导入歌词"),
					description: t(
						"confirmDialog.importFile.description",
						"当前文件有未保存的更改。如果继续，这些更改将会丢失。确定要导入歌词吗？",
					),
					onConfirm: () => performImport(track),
				});
			} else {
				performImport(track);
			}
		},
		[isDirty, setConfirmDialog, t, performImport],
	);

	return (
		<>
			<Dialog.Root
				open={isOpen}
				onOpenChange={(open) => {
					setIsOpen(open);
				}}
			>
				<Dialog.Content className={styles.dialogContent}>
					<Dialog.Title>{t("lrclib.title", "从 LRCLIB 导入歌词")}</Dialog.Title>

					<Flex gap="3" mb="4">
						<TextField.Root
							className={styles.searchBar}
							placeholder={t("lrclib.placeholder", "歌名 歌手...")}
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={onKeyDown}
						><TextField.Slot><Search16Regular /></TextField.Slot></TextField.Root>
						<Button onClick={handleSearch} disabled={loading}>
							{loading ? <Spinner /> : t("common.search", "搜索")}
						</Button>
					</Flex>

					<ScrollArea
						type="auto"
						scrollbars="vertical"
						className={styles.scrollArea}
					>
						<Flex direction="column" gap="2" className={styles.resultList}>
							{loading
								? Array.from({ length: 5 }).map((_, i) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: 不会变
										<Card key={i}>
											<Flex justify="between" align="center" gap="4">
												<Flex direction="column" gap="1" style={{ flex: 1 }}>
													<Box className={styles.skeletonTitleBox}>
														<Skeleton loading={true}>
															<Text size="3" weight="bold">
																Song Title
															</Text>
														</Skeleton>
													</Box>

													<Flex align="center" gap="2">
														<Skeleton loading={true}>
															<Flex align="center" gap="1">
																<Timer24Regular className={styles.smallIcon} />
																<Text size="1">04:00</Text>
															</Flex>
														</Skeleton>

														<Skeleton loading={true}>
															<Badge size="1">Synced Lyric</Badge>
														</Skeleton>
													</Flex>

													<Box className={styles.skeletonArtistBox}>
														<Skeleton loading={true}>
															<Text size="1">Album</Text>
														</Skeleton>
													</Box>
												</Flex>

												<Box pr="2">
													<Skeleton loading={true}>
														<IconButton variant="ghost"><Eye24Regular /></IconButton>
													</Skeleton>
												</Box>
											</Flex>
										</Card>
									))
								: results.map((track) => (
										<Card
											key={track.id}
											className={classNames(styles.resultCard)}
											onClick={() => setPreviewTrack(track)}
										>
											<Flex justify="between" align="center" gap="4">
												<Flex
													direction="column"
													gap="1"
													style={{ flex: 1, minWidth: 0 }}
												>
													<Text size="3" weight="bold" truncate>
														{track.name}
													</Text>

													<Flex align="center" gap="2">
														<Flex align="center" gap="1">
															<Timer24Regular className={styles.smallIcon} />
															<Text size="1" color="gray">
																{formatDuration(track.duration)}
															</Text>
														</Flex>

														{track.syncedLyrics ? (
															<Badge color="ruby" size="1">
																<CheckmarkCircle24Regular
																	className={styles.badgeIcon}
																/>
																{t("lrclib.synced", "有时间轴")}
															</Badge>
														) : (
															<Badge color="gray" size="1">
																<ErrorCircle24Regular
																	className={styles.badgeIcon}
																/>
																{t("lrclib.unsynced", "无时间轴")}
															</Badge>
														)}
													</Flex>

													<Text size="1" color="gray" truncate>
														{track.artistName} - {track.albumName}
													</Text>
												</Flex>
											</Flex>
										</Card>
									))}

							{!loading && results.length === 0 && (
								<Flex className={styles.emptyState}>
									{hasSearched ? (
										<>
											<QuestionCircle24Regular
												className={styles.emptyStateIcon}
											/>
											<Text>
												{t(
													"lrclib.notFound",
													"未找到相关结果，请尝试更换关键词",
												)}
											</Text>
										</>
									) : (
										<>
											<Search24Regular className={styles.emptyStateIcon} />
											<Text>{t("lrclib.noResult", "输入关键词开始搜索")}</Text>
										</>
									)}
								</Flex>
							)}
						</Flex>
					</ScrollArea>

					<Flex justify="end" mt="4">
						<Dialog.Close><Button variant="soft" color="gray">{t("common.close", "关闭")}</Button></Dialog.Close>
					</Flex>
				</Dialog.Content>
			</Dialog.Root>

			<Dialog.Root
				open={!!previewTrack}
				onOpenChange={(open) => !open && setPreviewTrack(null)}
			>
				<Dialog.Content className={styles.previewDialogContent}>
					<Flex justify="between" align="center" mb="2">
						<Dialog.Title style={{ marginBottom: 0 }}>
							{previewTrack?.name}
						</Dialog.Title>
						<Dialog.Close><IconButton variant="ghost" color="gray"><Dismiss24Regular /></IconButton></Dialog.Close>
					</Flex>

					<Dialog.Description size="2" mb="4" color="gray">
						{previewTrack?.artistName} - {previewTrack?.albumName}
					</Dialog.Description>

					<Separator size="4" mb="4" />

					<Box className={styles.previewContainer}>
						{previewTrack?.syncedLyrics || previewTrack?.plainLyrics ? (
							<TextArea
								variant="soft"
								className={styles.previewTextArea}
								value={
									previewTrack.syncedLyrics || previewTrack.plainLyrics || ""
								}
								readOnly
							/>
						) : (
							<Flex className={styles.previewEmptyState}>
								<DocumentDismiss24Regular className={styles.emptyStateIcon} />
								<Text>{t("lrclib.noLyrics", "该歌曲暂无歌词内容")}</Text>
							</Flex>
						)}
					</Box>

					<Flex justify="end" gap="3" mt="4" align="center">
						<Text as="label" size="2">
							<Flex gap="2" align="center">
								<Checkbox
									checked={extractBg}
									onCheckedChange={(c) => setExtractBg(!!c)}
								/>
								{t("lrclib.extractBg", "提取括号内容为背景人声")}
							</Flex>
						</Text>

						<Text as="label" size="2">
							<Flex gap="2" align="center">
								<Checkbox
									checked={autoSegment}
									onCheckedChange={(c) => setAutoSegment(!!c)}
								/>
								{t("lrclib.autoSegment", "自动分词")}
							</Flex>
						</Text>

						<Dialog.Close><Button variant="soft" color="gray">{t("common.cancel", "取消")}</Button></Dialog.Close>
						<Button
							onClick={() => previewTrack && onTriggerImport(previewTrack)}
						>
							{t("lrclib.import", "导入歌词")}
						</Button>
					</Flex>
				</Dialog.Content>
			</Dialog.Root>
		</>
	);
};
