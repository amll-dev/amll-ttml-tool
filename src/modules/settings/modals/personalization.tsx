import { DarkTheme24Regular } from "@fluentui/react-icons";
import {
	Box,
	Card,
	Flex,
	Heading,
	SegmentedControl,
	Text,
} from "@radix-ui/themes";
import { AnimatePresence, motion } from "framer-motion";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { DarkMode, darkModeAtom } from "$/states/main";
import {
	SettingsCustomBackgroundCard,
	SettingsCustomBackgroundSettings,
} from "./customBackground";
import {
	SettingsSpectrogramCustomPalettePage,
	SettingsSpectrogramPalettePage,
} from "./spectrogram";

export const SettingsPersonalizationTab = ({
	subpage,
	onSubpageChange,
}: {
	subpage: "customBackground" | "customPalette" | null;
	onSubpageChange: (subpage: "customBackground" | "customPalette" | null) => void;
}) => {
	const [darkMode, setDarkMode] = useAtom(darkModeAtom);
	const { t } = useTranslation();
	const backgroundGroupTitle = t("settings.group.background", "背景");
	const spectrogramTitle = t("settingsDialog.tab.spectrogram", "频谱图");

	const subpageContent =
		subpage === "customBackground" ? (
			<SettingsCustomBackgroundSettings />
		) : subpage === "customPalette" ? (
			<SettingsSpectrogramCustomPalettePage />
		) : null;

	return (
		<AnimatePresence mode="wait" initial={false}>
			{subpage ? (
				<motion.div
					key={subpage}
					initial={{ opacity: 0, x: 12 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: 12 }}
					transition={{ duration: 0.18, ease: "easeOut" }}
				>
					{subpageContent}
				</motion.div>
			) : (
				<motion.div
					key="personalization-main"
					initial={{ opacity: 0, x: -12 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: -12 }}
					transition={{ duration: 0.18, ease: "easeOut" }}
				>
					<Flex direction="column" gap="4">
						<Flex direction="column" gap="2">
							<Heading size="4">
								{t("settings.group.appearance", "外观")}
							</Heading>

							<Card>
								<Flex gap="3" align="center">
									<DarkTheme24Regular />
									<Box flexGrow="1">
										<Flex align="center" justify="between" gap="4">
											<Flex direction="column" gap="1">
												<Text>{t("settings.personalization.theme", "主题")}</Text>
												<Text size="1" color="gray">
													{t(
														"settings.personalization.themeDesc",
														"选择界面使用浅色、深色，或跟随系统设置。",
													)}
												</Text>
											</Flex>

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
										</Flex>
									</Box>
								</Flex>
							</Card>
						</Flex>

						<Flex direction="column" gap="2">
							<Heading size="4">{backgroundGroupTitle}</Heading>
							<SettingsCustomBackgroundCard
								onOpen={() => onSubpageChange("customBackground")}
							/>
						</Flex>

						<Flex direction="column" gap="2">
							<Heading size="4">{spectrogramTitle}</Heading>
							<SettingsSpectrogramPalettePage
								onOpenCustomPalette={() => onSubpageChange("customPalette")}
							/>
						</Flex>
					</Flex>
				</motion.div>
			)}
		</AnimatePresence>
	);
};
