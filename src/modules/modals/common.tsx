import resources from "virtual:i18next-loader";
import {
	ContentView24Regular,
	History24Regular,
	Keyboard12324Regular,
	LocalLanguage24Regular,
	PaddingLeft24Regular,
	PaddingRight24Regular,
	Save24Regular,
	Speaker224Regular,
	Stack24Regular,
	Timer24Regular,
	TopSpeed24Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Card,
	Flex,
	Heading,
	Select,
	Slider,
	Switch,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { playbackRateAtom, volumeAtom } from "$/modules/audio/states";
import {
	autosaveEnabledAtom,
	autosaveIntervalAtom,
	autosaveLimitAtom,
	enableColorFeaturesAtom, // <-- 新增
	LayoutMode,
	layoutModeAtom,
	SyncJudgeMode,
	smartFirstWordAtom,
	smartLastWordAtom,
	syncJudgeModeAtom,
} from "$/modules/settings/states";
import {
	KeyBindingTriggerMode,
	keyBindingTriggerModeAtom,
} from "$/utils/keybindings";
import {
	SettingsCustomBackgroundCard,
	SettingsCustomBackgroundSettings,
} from "./customBackground";

const languageOptions: readonly string[] = Object.keys(resources);

export const SettingsCommonTab = () => {
	const [layoutMode, setLayoutMode] = useAtom(layoutModeAtom);
	const [syncJudgeMode, setSyncJudgeMode] = useAtom(syncJudgeModeAtom);
	const [keyBindingTriggerMode, setKeyBindingTriggerMode] = useAtom(
		keyBindingTriggerModeAtom,
	);
	const [smartFirstWord, setSmartFirstWord] = useAtom(smartFirstWordAtom);
	const [smartLastWord, setSmartLastWord] = useAtom(smartLastWordAtom);
	const [volume, setVolume] = useAtom(volumeAtom);
	const [playbackRate, setPlaybackRate] = useAtom(playbackRateAtom);
	const [autosaveEnabled, setAutosaveEnabled] = useAtom(autosaveEnabledAtom);
	const [autosaveInterval, setAutosaveInterval] = useAtom(autosaveIntervalAtom);
	const [autosaveLimit, setAutosaveLimit] = useAtom(autosaveLimitAtom);
	const [colorFeaturesEnabled, setColorFeaturesEnabled] = useAtom(
		enableColorFeaturesAtom,
	); // <-- 新增
	const { t, i18n } = useTranslation();
	const currentLanguage = i18n.resolvedLanguage || i18n.language;
	const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);

	const getLanguageName = (code: string, locale: string) => {
		try {
			interface DisplayNamesLike {
				new (
					locales: string | string[],
					options: { type: string },
				): {
					of: (code: string) => string | undefined;
				};
			}
			const DN: DisplayNamesLike | undefined = (
				Intl as unknown as {
					DisplayNames?: DisplayNamesLike;
				}
			).DisplayNames;
			if (DN) {
				const dn = new DN([locale], { type: "language" });
				const nativeDn = new DN([code], { type: "language" });
				const name = dn.of(code);
				const nativeName = nativeDn.of(code) || code;
				if (name && code !== locale) return `${nativeName} (${name})`;
				return nativeName;
			}
		} catch {
			// ignore errors and fallback
		}
		return code;
	};

	if (showBackgroundSettings) {
		return (
			<SettingsCustomBackgroundSettings
				onClose={() => setShowBackgroundSettings(false)}
			/>
		);
	}

	return (
		<Flex direction="column" gap="4">
			<Flex direction="column" gap="2">
				<Heading size="4">{t("settings.group.display", "显示")}</Heading>

				<Card>
					<Flex gap="3" align="center">
						<LocalLanguage24Regular />
						<Box flexGrow="1">
							<Flex align="center" justify="between" gap="4">
								<Flex direction="column" gap="1">
									<Text>{t("settings.common.language", "界面语言")}</Text>
									<Text size="1" color="gray">
										{t("settings.common.languageDesc", "选择界面显示的语言")}
									</Text>
								</Flex>

								<Select.Root
									value={currentLanguage}
									onValueChange={(lng) => {
										i18n.changeLanguage(lng).then(() => {
											localStorage.setItem("language", lng);
										});
									}}
								>
									<Select.Trigger />
									<Select.Content>
										{languageOptions.map((code) => (
											<Select.Item key={code} value={code}>
												{getLanguageName(code, currentLanguage)}
											</Select.Item>
										))}
									</Select.Content>
								</Select.Root>
							</Flex>
						</Box>
					</Flex>
				</Card>

				<Card>
					<Flex gap="3" align="center">
						<ContentView24Regular />
						<Box flexGrow="1">
							<Flex align="center" justify="between" gap="4">
								<Flex direction="column" gap="1">
									<Text>{t("settings.common.layoutMode", "编辑布局模式")}</Text>
									<Text size="1" color="gray">
										{t(
											"settings.common.layoutModeDesc.line1",
											"简单布局能够满足大部分使用者的基本需求",
										)}
										<br />
										{t(
											"settings.common.layoutModeDesc.line2",
											"如果你需要更加高效的打轴的话，可以考虑切换到高级模式",
										)}
									</Text>
								</Flex>

								<Select.Root
									value={layoutMode}
									onValueChange={(v) => setLayoutMode(v as LayoutMode)}
								>
									<Select.Trigger />
									<Select.Content>
										<Select.Item value={LayoutMode.Simple}>
											{t(
												"settings.common.layoutModeOptions.simple",
												"简单模式",
											)}
										</Select.Item>
										<Select.Item value={LayoutMode.Advance}>
											{t(
												"settings.common.layoutModeOptions.advance",
												"高级模式",
											)}
										</Select.Item>
									</Select.Content>
								</Select.Root>
							</Flex>
						</Box>
					</Flex>
				</Card>

				<SettingsCustomBackgroundCard
					onOpen={() => setShowBackgroundSettings(true)}
				/>

				{/* 新增颜色特性开关 */}
				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<Box flexGrow="1">
								<Flex gap="2" align="center" justify="between">
									<Flex direction="column" gap="1">
										<Text>
											{t("colorFeatures.title", "启用颜色功能（实验性）")}
										</Text>
										<Text size="1" color="gray">
											{t(
												"colorFeatures.desc",
												"启用后可在编辑器中添加颜色标记，并显示悬浮调色工具栏。",
											)}
										</Text>
									</Flex>
									<Switch
										checked={colorFeaturesEnabled}
										onCheckedChange={setColorFeaturesEnabled}
									/>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>
			</Flex>

			<Flex direction="column" gap="3">
				<Heading size="4">{t("settings.group.timing", "打轴")}</Heading>

				<Card>
					<Flex gap="3" align="center">
						<Timer24Regular />
						<Box flexGrow="1">
							<Flex align="center" justify="between" gap="4">
								<Flex direction="column" gap="1">
									<Text>
										{t("settings.common.syncJudgeMode", "打轴时间戳判定模式")}
									</Text>
									<Text size="1" color="gray">
										{t(
											"settings.common.syncJudgeModeDesc",
											'设置打轴时间戳的判定模式，默认为"首个按键按下时间"。',
										)}
									</Text>
								</Flex>

								<Select.Root
									value={syncJudgeMode}
									onValueChange={(v) => setSyncJudgeMode(v as SyncJudgeMode)}
								>
									<Select.Trigger />
									<Select.Content>
										<Select.Item value={SyncJudgeMode.FirstKeyDownTime}>
											{t(
												"settings.common.syncJudgeModeOptions.firstKeyDown",
												"首个按键按下时间",
											)}
										</Select.Item>
										<Select.Item value={SyncJudgeMode.LastKeyUpTime}>
											{t(
												"settings.common.syncJudgeModeOptions.lastKeyUp",
												"最后一个按键抬起时间",
											)}
										</Select.Item>
										<Select.Item value={SyncJudgeMode.MiddleKeyTime}>
											{t(
												"settings.common.syncJudgeModeOptions.middleKey",
												"取按键按下和抬起的中间值",
											)}
										</Select.Item>
										<Select.Item value={SyncJudgeMode.FirstKeyDownTimeLegacy}>
											{t(
												"settings.common.syncJudgeModeOptions.firstKeyDownLegacy",
												"首个按键按下时间（旧版）",
											)}
										</Select.Item>
									</Select.Content>
								</Select.Root>
							</Flex>
						</Box>
					</Flex>
				</Card>

				<Card>
					<Flex gap="3" align="center">
						<Keyboard12324Regular />
						<Box flexGrow="1">
							<Flex align="center" justify="between" gap="4">
								<Flex direction="column" gap="1">
									<Text>
										{t("settings.common.keyBindingTrigger", "快捷键触发时机")}
									</Text>
									<Text size="1" color="gray">
										{t(
											"settings.common.keyBindingTriggerDesc",
											"快捷键是在按下时触发还是在松开时触发",
										)}
									</Text>
								</Flex>

								<Select.Root
									value={keyBindingTriggerMode}
									onValueChange={(v) =>
										setKeyBindingTriggerMode(v as KeyBindingTriggerMode)
									}
								>
									<Select.Trigger />
									<Select.Content>
										<Select.Item value={KeyBindingTriggerMode.KeyDown}>
											{t(
												"settings.common.keyBindingTriggerOptions.keyDown",
												"按下时触发",
											)}
										</Select.Item>
										<Select.Item value={KeyBindingTriggerMode.KeyUp}>
											{t(
												"settings.common.keyBindingTriggerOptions.keyUp",
												"松开时触发",
											)}
										</Select.Item>
									</Select.Content>
								</Select.Root>
							</Flex>
						</Box>
					</Flex>
				</Card>

				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<PaddingLeft24Regular />
							<Box flexGrow="1">
								<Flex gap="2" align="center" justify="between">
									<Flex direction="column" gap="1">
										<Text>
											{t("settings.common.smartFirstWord", "智能首字")}
										</Text>
										<Text size="1" color="gray">
											{t(
												"settings.common.smartFirstWordDesc",
												"对行首第一个音节打轴时，第一次按下“起始轴”按钮会设置其开始时间，但不会设置其结束时间。",
											)}
										</Text>
									</Flex>
									<Switch
										checked={smartFirstWord}
										onCheckedChange={setSmartFirstWord}
									/>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>

				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<PaddingRight24Regular />
							<Box flexGrow="1">
								<Flex gap="2" align="center" justify="between">
									<Flex direction="column" gap="1">
										<Text>
											{t("settings.common.smartLastWord", "智能尾字")}
										</Text>
										<Text size="1" color="gray">
											{t(
												"settings.common.smartLastWordDesc",
												"对行末最后一个音节打轴时，最后一次按下“结束轴”按钮会设置其结束时间，但不会设置下一行第一个音节的开始时间。",
											)}
										</Text>
									</Flex>
									<Switch
										checked={smartLastWord}
										onCheckedChange={setSmartLastWord}
									/>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>
			</Flex>

			<Flex direction="column" gap="2">
				<Heading size="4">{t("settings.group.playback", "播放")}</Heading>

				<Card>
					<Flex gap="3" align="center">
						<Speaker224Regular />
						<Box flexGrow="1">
							<Flex direction="column" gap="2" align="start">
								<Flex
									align="center"
									justify="between"
									style={{ alignSelf: "stretch" }}
								>
									<Text>{t("settings.common.volume", "音乐音量")}</Text>
									<Text wrap="nowrap" color="gray" size="1">
										{(volume * 100).toFixed()}%
									</Text>
								</Flex>
								<Slider
									min={0}
									max={1}
									defaultValue={[volume]}
									step={0.01}
									onValueChange={(v) => setVolume(v[0])}
								/>
							</Flex>
						</Box>
					</Flex>
				</Card>

				<Card>
					<Flex gap="3" align="center">
						<TopSpeed24Regular />
						<Box flexGrow="1">
							<Flex direction="column" gap="2" align="start">
								<Flex
									align="center"
									justify="between"
									style={{ alignSelf: "stretch" }}
								>
									<Text>{t("settings.common.playbackRate", "播放速度")}</Text>
									<Text wrap="nowrap" color="gray" size="1">
										{playbackRate.toFixed(2)}x
									</Text>
								</Flex>
								<Slider
									min={0.1}
									max={2}
									defaultValue={[playbackRate]}
									step={0.05}
									onValueChange={(v) => setPlaybackRate(v[0])}
								/>
							</Flex>
						</Box>
					</Flex>
				</Card>
			</Flex>

			<Flex direction="column" gap="2">
				<Heading size="4">{t("settings.group.autosave", "自动保存")}</Heading>

				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<Save24Regular />
							<Box flexGrow="1">
								<Flex gap="2" align="center" justify="between">
									<Text>
										{t("settings.common.autosave.enable", "启用自动保存")}
									</Text>
									<Switch
										checked={autosaveEnabled}
										onCheckedChange={setAutosaveEnabled}
									/>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>

				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<History24Regular />
							<Box flexGrow="1">
								<Flex direction="column" gap="2" align="start">
									<Text>
										{t("settings.common.autosave.interval", "保存间隔 (分钟)")}
									</Text>
									<TextField.Root
										type="number"
										disabled={!autosaveEnabled}
										value={autosaveInterval}
										onChange={(e) =>
											setAutosaveInterval(
												Math.max(1, Number.parseInt(e.target.value, 10) || 1),
											)
										}
									/>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>

				<Card>
					<Flex gap="3" align="center">
						<Stack24Regular />
						<Box flexGrow="1">
							<Flex direction="column" gap="2" align="start">
								<Flex
									align="center"
									justify="between"
									style={{ alignSelf: "stretch" }}
								>
									<Text>
										{t("settings.common.autosave.limit", "保留快照数量")}
									</Text>
									<Text wrap="nowrap" color="gray" size="1">
										{autosaveLimit}
									</Text>
								</Flex>
								<Slider
									min={1}
									max={50}
									disabled={!autosaveEnabled}
									value={[autosaveLimit]}
									step={1}
									onValueChange={(v) => setAutosaveLimit(v[0])}
								/>
							</Flex>
						</Box>
					</Flex>
				</Card>
			</Flex>
		</Flex>
	);
};
