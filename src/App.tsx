/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/Steve-xmh/amll-ttml-tool/blob/main/LICENSE
 */

import {
	Box,
	Button,
	Flex,
	Heading,
	Text,
	TextArea,
	Theme,
} from "@radix-ui/themes";
import SuspensePlaceHolder from "$/components/SuspensePlaceHolder";
import { TouchSyncPanel } from "$/modules/lyric-editor/components/TouchSyncPanel/index.tsx";
import { log, error as logError } from "$/utils/logging.ts";
import "@radix-ui/themes/styles.css";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { platform, version } from "@tauri-apps/plugin-os";
import { AnimatePresence, motion } from "framer-motion";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useTranslation } from "react-i18next";
import { ToastContainer, toast } from "react-toastify";
import saveFile from "save-file";
import semverGt from "semver/functions/gt";
import styles from "./App.module.css";
import DarkThemeDetector from "./components/DarkThemeDetector";
import RibbonBar from "./components/RibbonBar";
import { TitleBar } from "./components/TitleBar";
import { useFileOpener } from "./hooks/useFileOpener.ts";
import AudioControls from "./modules/audio/components/index.tsx";
import { useAudioFeedback } from "./modules/audio/hooks/useAudioFeedback.ts";
import { SyncKeyBinding } from "./modules/lyric-editor/components/sync-keybinding.tsx";
import { AutosaveManager } from "./modules/project/autosave/AutosaveManager.tsx";
import exportTTMLText from "./modules/project/logic/ttml-writer.ts";
import { GlobalDragOverlay } from "./modules/project/modals/GlobalDragOverlay.tsx";
import {
	customBackgroundBlurAtom,
	customBackgroundBrightnessAtom,
	customBackgroundImageAtom,
	customBackgroundImageInitAtom,
	customBackgroundMaskAtom,
	customBackgroundOpacityAtom,
} from "./modules/settings/modals/customBackground";
import { showTouchSyncPanelAtom } from "./modules/settings/states/sync.ts";
import { settingsDialogAtom, settingsTabAtom } from "./states/dialogs.ts";
import {
	isDarkThemeAtom,
	isGlobalFileDraggingAtom,
	lyricLinesAtom,
	ToolMode,
	toolModeAtom,
} from "./states/main.ts";
import { useAppUpdate } from "./utils/useAppUpdate.ts";

const LyricLinesView = lazy(() => import("./modules/lyric-editor/components"));
const AMLLWrapper = lazy(() => import("./components/AMLLWrapper"));
const Dialogs = lazy(() => import("./components/Dialogs"));

const AppErrorPage = ({
	error,
	resetErrorBoundary,
}: {
	error: Error;
	resetErrorBoundary: () => void;
}) => {
	const store = useStore();
	const { t } = useTranslation();

	return (
		<Flex direction="column" align="center" justify="center" height="100vh">
			<Flex direction="column" align="start" justify="center" gap="2">
				<Heading>{t("app.error.title", "诶呀，出错了！")}</Heading>
				<Text>
					{t("app.error.description", "AMLL TTML Tools 在运行时出现了错误")}
				</Text>
				<Text>
					{t("app.error.checkDevTools", "具体错误详情可以在开发者工具中查询")}
				</Text>
				<Flex gap="2">
					<Button
						onClick={() => {
							try {
								const ttmlText = exportTTMLText(store.get(lyricLinesAtom));
								const b = new Blob([ttmlText], { type: "text/plain" });
								saveFile(b, "lyric.ttml").catch(logError);
							} catch (e) {
								logError("Failed to save TTML file", e);
							}
						}}
					>
						{t("app.error.saveLyrics", "尝试保存当前歌词")}
					</Button>
					<Button
						onClick={() => {
							resetErrorBoundary();
						}}
						variant="soft"
					>
						{t("app.error.tryRestart", "尝试重新进入程序")}
					</Button>
				</Flex>
				<Text>{t("app.error.details", "大致错误信息：")}</Text>
				<TextArea
					readOnly
					value={String(error)}
					style={{
						width: "100%",
						height: "8em",
					}}
				/>
			</Flex>
		</Flex>
	);
};

function App() {
	const isDarkTheme = useAtomValue(isDarkThemeAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const showTouchSyncPanel = useAtomValue(showTouchSyncPanelAtom);
	const customBackgroundImage = useAtomValue(customBackgroundImageAtom);
	const customBackgroundOpacity = useAtomValue(customBackgroundOpacityAtom);
	const customBackgroundMask = useAtomValue(customBackgroundMaskAtom);
	const customBackgroundBlur = useAtomValue(customBackgroundBlurAtom);
	const customBackgroundBrightness = useAtomValue(customBackgroundBrightnessAtom);
	const [hasBackground, setHasBackground] = useState(false);
	const effectiveTheme = customBackgroundImage
		? "light"
		: isDarkTheme
			? "dark"
			: "light";
	const { checkUpdate, status, update } = useAppUpdate();
	const hasNotifiedRef = useRef(false);
	const setSettingsOpen = useSetAtom(settingsDialogAtom);
	const setSettingsTab = useSetAtom(settingsTabAtom);
	const initCustomBackgroundImage = useSetAtom(customBackgroundImageInitAtom);
	const { t } = useTranslation();
	const store = useStore();

	useEffect(() => {
		initCustomBackgroundImage();
	}, [initCustomBackgroundImage]);

	useEffect(() => {
		if (import.meta.env.TAURI_ENV_PLATFORM) {
			checkUpdate(true);
		}
	}, [checkUpdate]);

	useEffect(() => {
		if (status === "available" && update && !hasNotifiedRef.current) {
			hasNotifiedRef.current = true;

			toast.info(
				<div>
					<div style={{ fontWeight: "bold" }}>
						{t("app.update.updateAvailable", "发现新版本: {version}", {
							version: update.version,
						})}
					</div>
				</div>,
				{
					autoClose: 5000,
					onClick: () => {
						setSettingsTab("about");
						setSettingsOpen(true);
					},
				},
			);
		}
	}, [status, update, t, setSettingsOpen, setSettingsTab]);

	const setIsGlobalDragging = useSetAtom(isGlobalFileDraggingAtom);
	const { openFile } = useFileOpener();
	useAudioFeedback();

	useEffect(() => {
		if (!import.meta.env.TAURI_ENV_PLATFORM) {
			return;
		}

		(async () => {
			const file: {
				filename: string;
				data: string;
				ext: string;
			} | null = await invoke("get_open_file_data");

			if (file) {
				log("File data from tauri args", file);

				const fileObj = new File([file.data], file.filename, {
					type: "text/plain",
				});

				openFile(fileObj);
			}
		})();
	}, [openFile]);

	useEffect(() => {
		if (!import.meta.env.TAURI_ENV_PLATFORM) {
			return;
		}

		(async () => {
			const win = getCurrentWindow();
			if (platform() === "windows") {
				if (semverGt("10.0.22000", version())) {
					setHasBackground(true);
					await win.clearEffects();
				}
			}

			await new Promise((r) => requestAnimationFrame(r));

			await win.show();
		})();
	}, []);

	useEffect(() => {
		const onBeforeClose = (evt: BeforeUnloadEvent) => {
			const currentLyricLines = store.get(lyricLinesAtom);
			if (
				currentLyricLines.lyricLines.length +
					currentLyricLines.metadata.length >
				0
			) {
				evt.preventDefault();
				evt.returnValue = false;
			}
		};
		window.addEventListener("beforeunload", onBeforeClose);
		return () => {
			window.removeEventListener("beforeunload", onBeforeClose);
		};
	}, [store]);

	useEffect(() => {
		const handleDragEnter = (e: DragEvent) => {
			if (e.dataTransfer?.types.includes("Files")) {
				setIsGlobalDragging(true);
			}
		};

		const handleDragOver = (e: DragEvent) => {
			e.preventDefault();
		};

		const handleDragLeave = (e: DragEvent) => {
			if (e.relatedTarget === null) {
				setIsGlobalDragging(false);
			}
		};

		const handleDrop = (e: DragEvent) => {
			e.preventDefault();
			setIsGlobalDragging(false);

			const files = e.dataTransfer?.files;
			if (files && files.length > 0) {
				openFile(files[0]);
			}
		};

		window.addEventListener("dragenter", handleDragEnter);
		window.addEventListener("dragover", handleDragOver);
		window.addEventListener("dragleave", handleDragLeave);
		window.addEventListener("drop", handleDrop);

		return () => {
			window.removeEventListener("dragenter", handleDragEnter);
			window.removeEventListener("dragover", handleDragOver);
			window.removeEventListener("dragleave", handleDragLeave);
			window.removeEventListener("drop", handleDrop);
		};
	}, [setIsGlobalDragging, openFile]);

	return (
		<Theme
			appearance={effectiveTheme}
			panelBackground="solid"
			hasBackground={hasBackground}
			accentColor={effectiveTheme === "dark" ? "jade" : "green"}
			className={styles.radixTheme}
		>
			<ErrorBoundary
				FallbackComponent={AppErrorPage}
				onReset={(_details) => {
					// TODO
				}}
			>
				{customBackgroundImage && (
					<div className={styles.customBackgroundLayer} aria-hidden="true">
						<div
							className={styles.customBackgroundImage}
							style={{
								backgroundImage: `linear-gradient(rgba(0, 0, 0, ${customBackgroundMask}), rgba(0, 0, 0, ${customBackgroundMask})), url(${customBackgroundImage})`,
								opacity: customBackgroundOpacity,
								filter: `blur(${customBackgroundBlur}px) brightness(${customBackgroundBrightness})`,
							}}
						/>
					</div>
				)}
				<div className={styles.appContent}>
					<AutosaveManager />
					<GlobalDragOverlay />
					{toolMode === ToolMode.Sync && <SyncKeyBinding />}
					<DarkThemeDetector />
					<Flex direction="column" height="100vh">
						<TitleBar />
						<RibbonBar />
						<Box flexGrow="1" overflow="hidden">
							<AnimatePresence mode="wait">
								{toolMode !== ToolMode.Preview && (
									<SuspensePlaceHolder key="edit">
										<motion.div
											layout="position"
											style={{
												height: "100%",
												maxHeight: "100%",
												overflowY: "hidden",
											}}
											initial={{ opacity: 0 }}
											animate={{ opacity: 1 }}
											exit={{ opacity: 0 }}
										>
											<LyricLinesView key="edit" />
										</motion.div>
									</SuspensePlaceHolder>
								)}
								{toolMode === ToolMode.Preview && (
									<SuspensePlaceHolder key="amll-preview">
										<Box height="100%" key="amll-preview" p="2" asChild>
											<motion.div
												layout="position"
												initial={{ opacity: 0 }}
												animate={{ opacity: 1 }}
												exit={{ opacity: 0 }}
											>
												<AMLLWrapper />
											</motion.div>
										</Box>
									</SuspensePlaceHolder>
								)}
							</AnimatePresence>
						</Box>
						{showTouchSyncPanel && toolMode === ToolMode.Sync && (
							<TouchSyncPanel />
						)}
						<Box flexShrink="0">
							<AudioControls />
						</Box>
					</Flex>
					<Suspense fallback={null}>
						<Dialogs />
					</Suspense>
					<ToastContainer theme={effectiveTheme} />
				</div>
			</ErrorBoundary>
		</Theme>
	);
}

export default App;
