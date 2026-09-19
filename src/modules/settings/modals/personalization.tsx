import { DarkTheme24Regular } from "@fluentui/react-icons";
import { Flex, SegmentedControl } from "@radix-ui/themes";
import { AnimatePresence, motion } from "framer-motion";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { DarkMode, darkModeAtom } from "$/states/main";
import {
	SettingsCustomBackgroundCard,
	SettingsCustomBackgroundSettings,
} from "./customBackground";
import { SettingsGroup, SettingsRow } from "./SettingsGroup";
import {
	SettingsSpectrogramCustomPalettePage,
	SettingsSpectrogramFrequencyRows,
	SettingsSpectrogramNaturalWeightingRows,
	SettingsSpectrogramPalettePage,
} from "./spectrogram";

const contentTransition = {
	duration: 0.25,
	ease: [0.4, 0, 0.2, 1],
} as const;

const contentVariants = {
	initial: { opacity: 0, y: 12 },
	animate: { opacity: 1, y: 0 },
} as const;

export const SettingsPersonalizationTab = ({
	subpage,
	onSubpageChange,
}: {
	subpage: "customBackground" | "customPalette" | null;
	onSubpageChange: (
		subpage: "customBackground" | "customPalette" | null,
	) => void;
}) => {
	const [darkMode, setDarkMode] = useAtom(darkModeAtom);
	const { t } = useTranslation();
	const spectrogramTitle = t("settingsDialog.tab.spectrogram", "频谱图");

	const subpageContent =
		subpage === "customBackground" ? (
			<SettingsCustomBackgroundSettings />
		) : subpage === "customPalette" ? (
			<SettingsSpectrogramCustomPalettePage />
		) : null;

	return (
		<AnimatePresence initial={false}>
			{subpage ? (
				<motion.div
					key={subpage}
					variants={contentVariants}
					initial="initial"
					animate="animate"
					exit="exit"
					transition={contentTransition}
				>
					{subpageContent}
				</motion.div>
			) : (
				<motion.div
					key="personalization-main"
					variants={contentVariants}
					initial="initial"
					animate="animate"
					transition={contentTransition}
				>
					<Flex direction="column" gap="4">
						<SettingsGroup>
							<SettingsRow
								icon={<DarkTheme24Regular />}
								title={t("settings.personalization.theme", "外观主题")}
								description={t(
									"settings.personalization.themeDesc",
									"选择界面使用浅色、深色，或跟随系统设置。",
								)}
								action={
									<SegmentedControl.Root
										value={darkMode}
										onValueChange={(value) => setDarkMode(value as DarkMode)}
									>
										<SegmentedControl.Item value={DarkMode.Light}>
											{t("settings.personalization.themeLight", "浅色")}
										</SegmentedControl.Item>
										<SegmentedControl.Item value={DarkMode.Dark}>
											{t("settings.personalization.themeDark", "深色")}
										</SegmentedControl.Item>
										<SegmentedControl.Item value={DarkMode.Auto}>
											{t("settings.personalization.themeAuto", "自动")}
										</SegmentedControl.Item>
									</SegmentedControl.Root>
								}
							/>

							<SettingsCustomBackgroundCard
								onOpen={() => onSubpageChange("customBackground")}
							/>
						</SettingsGroup>

						<SettingsGroup title={spectrogramTitle}>
							<SettingsSpectrogramPalettePage
								onOpenCustomPalette={() => onSubpageChange("customPalette")}
							/>
							<SettingsSpectrogramFrequencyRows />
							<SettingsSpectrogramNaturalWeightingRows />
						</SettingsGroup>
					</Flex>
				</motion.div>
			)}
		</AnimatePresence>
	);
};
