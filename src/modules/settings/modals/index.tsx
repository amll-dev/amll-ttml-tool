import {
	Info24Regular,
	Keyboard24Regular,
	Settings24Regular,
	SineWaveDots24Regular,
} from "@fluentui/react-icons";
import { Box, Dialog, Heading, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { settingsDialogAtom, settingsTabAtom } from "$/states/dialogs.ts";
import { SettingsAboutTab } from "./about";
import { SettingsCommonTab } from "./common";
import { SettingsKeyBindingsDialog } from "./keybindings";
import styles from "./SettingsDialog.module.css";
import { SettingsSpectrogramTab } from "./spectrogram";

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
		value: "spectrogram",
		icon: SineWaveDots24Regular,
		labelKey: "settingsDialog.tab.spectrogram",
		fallback: "频谱图",
	},
	{
		value: "about",
		icon: Info24Regular,
		labelKey: "common.about",
		fallback: "关于",
	},
] as const;

export const SettingsDialog = memo(() => {
	const [settingsDialogOpen, setSettingsDialogOpen] =
		useAtom(settingsDialogAtom);
	const [activeTab, setActiveTab] = useAtom(settingsTabAtom);
	const { t } = useTranslation();
	const activeTabConfig =
		tabConfig.find((tab) => tab.value === activeTab) ?? tabConfig[0];

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

							return (
								<button
									key={tab.value}
									type="button"
									className={styles.navItem}
									data-active={selected || undefined}
									onClick={() => setActiveTab(tab.value)}
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
							{t(activeTabConfig.labelKey, activeTabConfig.fallback)}
						</Heading>
					</header>

					<Box className={styles.scrollContent}>
						{activeTab === "common" && <SettingsCommonTab />}
						{activeTab === "keybinding" && <SettingsKeyBindingsDialog />}
						{activeTab === "spectrogram" && <SettingsSpectrogramTab />}
						{activeTab === "about" && <SettingsAboutTab />}
					</Box>
				</section>
			</Dialog.Content>
		</Dialog.Root>
	);
});
