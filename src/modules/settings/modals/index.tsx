import {
	Info24Regular,
	Keyboard24Regular,
	PaintBrush24Regular,
	Settings24Regular,
} from "@fluentui/react-icons";
import { Box, Dialog, Heading, Text } from "@radix-ui/themes";
import { AnimatePresence, motion } from "framer-motion";
import { useAtom } from "jotai";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { settingsDialogAtom, settingsTabAtom } from "$/states/dialogs.ts";
import { SettingsAboutTab } from "./about";
import { SettingsCommonTab } from "./common";
import { SettingsKeyBindingsDialog } from "./keybindings";
import { SettingsPersonalizationTab } from "./personalization";
import styles from "./SettingsDialog.module.css";

const tabConfig = [
	{
		value: "common",
		icon: Settings24Regular,
		labelKey: "settingsDialog.tab.common",
		fallback: "常规",
	},
	{
		value: "keybinding",
		icon: Keyboard24Regular,
		labelKey: "settingsDialog.tab.keybindings",
		fallback: "按键绑定",
	},
	{
		value: "personalization",
		icon: PaintBrush24Regular,
		labelKey: "settingsDialog.tab.personalization",
		fallback: "个性化",
	},
	{
		value: "about",
		icon: Info24Regular,
		labelKey: "common.about",
		fallback: "关于",
	},
] as const;

type SettingsSubpage = "customBackground" | "customPalette";
type BreadcrumbDirection = "down" | "up";

export const SettingsDialog = memo(() => {
	const [settingsDialogOpen, setSettingsDialogOpen] =
		useAtom(settingsDialogAtom);
	const [activeTab, setActiveTab] = useAtom(settingsTabAtom);
	const [activeSubpage, setActiveSubpage] = useState<SettingsSubpage | null>(
		null,
	);
	const [breadcrumbDirection, setBreadcrumbDirection] =
		useState<BreadcrumbDirection>("down");
	const { t } = useTranslation();
	const activeTabConfig =
		tabConfig.find((tab) => tab.value === activeTab) ?? tabConfig[0];
	const activeTabTitle = t(activeTabConfig.labelKey, activeTabConfig.fallback);
	const subpageTitle =
		activeTab === "personalization"
			? activeSubpage === "customBackground"
				? t("settings.common.customBackground", "自定义背景")
				: activeSubpage === "customPalette"
					? t(
							"settings.spectrogram.customPaletteTitle",
							"自定义频谱图配色",
						)
					: null
			: null;
	const titleKey = `${activeTab}:${subpageTitle ?? ""}`;
	const activeTabIndex = tabConfig.findIndex((tab) => tab.value === activeTab);
	const onSubpageChange = (nextSubpage: SettingsSubpage | null) => {
		setBreadcrumbDirection(nextSubpage ? "down" : "up");
		setActiveSubpage(nextSubpage);
	};

	return (
		<Dialog.Root open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
			<Dialog.Content className={styles.dialogContent}>
				<Dialog.Title className={styles.srOnly}>
					{t("settingsDialog.title", "首选项")}
				</Dialog.Title>

				<aside className={styles.sidebar}>
					<Text as="div" weight="bold" size="2" className={styles.sidebarTitle}>
						{t("settingsDialog.title", "首选项")}
					</Text>
					<nav className={styles.navList}>
						{tabConfig.map((tab) => {
							const Icon = tab.icon;
							const selected = activeTab === tab.value;
							const tabIndex = tabConfig.findIndex(
								(item) => item.value === tab.value,
							);

							return (
								<button
									key={tab.value}
									type="button"
									className={styles.navItem}
									data-active={selected || undefined}
									onClick={() => {
										if (!selected) {
											setBreadcrumbDirection(
												tabIndex > activeTabIndex ? "down" : "up",
											);
										}
										setActiveSubpage(null);
										setActiveTab(tab.value);
									}}
								>
									<Icon className={styles.navIcon} />
									<span>{t(tab.labelKey, tab.fallback)}</span>
								</button>
							);
						})}
					</nav>
				</aside>

				<section className={styles.mainPane}>
					<header className={styles.header}>
						<Heading size="7" className={styles.pageTitle}>
							<AnimatePresence mode="wait" initial={false}>
								<motion.span
									key={titleKey}
									className={styles.titleText}
									initial={{
										opacity: 0,
										y: breadcrumbDirection === "down" ? -6 : 6,
									}}
									animate={{ opacity: 1, y: 0 }}
									exit={{
										opacity: 0,
										y: breadcrumbDirection === "down" ? 6 : -6,
									}}
									transition={{ duration: 0.18, ease: "easeOut" }}
								>
									{subpageTitle ? (
										<button
											type="button"
											className={styles.titleButton}
											onClick={() => onSubpageChange(null)}
										>
											{activeTabTitle}
										</button>
									) : (
										<span>{activeTabTitle}</span>
									)}
									{subpageTitle && (
										<>
											<span className={styles.titleSeparator}>{">"}</span>
											<span className={styles.titleCurrent}>{subpageTitle}</span>
										</>
									)}
								</motion.span>
							</AnimatePresence>
						</Heading>
					</header>

					<Box className={styles.scrollContent}>
						<AnimatePresence mode="wait" initial={false}>
							<motion.div
								key={activeTab}
								className={styles.contentTransition}
								initial={{ opacity: 0, x: 12 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -12 }}
								transition={{ duration: 0.18, ease: "easeOut" }}
							>
								{activeTab === "common" && <SettingsCommonTab />}
								{activeTab === "keybinding" && <SettingsKeyBindingsDialog />}
								{activeTab === "personalization" && (
									<SettingsPersonalizationTab
										subpage={activeSubpage}
										onSubpageChange={onSubpageChange}
									/>
								)}
								{activeTab === "about" && <SettingsAboutTab />}
							</motion.div>
						</AnimatePresence>
					</Box>
				</section>
			</Dialog.Content>
		</Dialog.Root>
	);
});
