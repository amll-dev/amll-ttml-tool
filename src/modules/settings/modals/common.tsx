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
	Flex,
	Select,
	Slider,
	Switch,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { playbackRateAtom, volumeAtom } from "$/modules/audio/states";
import { applyDefaultTtmlAuthorMetadata } from "$/modules/project/logic/default-metadata";
import { GithubIcon } from "$/modules/project/modals/PlatformIcons";
import {
	autosaveEnabledAtom,
	autosaveIntervalAtom,
	autosaveLimitAtom,
	defaultTtmlAuthorGithubAtom,
	defaultTtmlAuthorGithubLoginAtom,
	LayoutMode,
	layoutModeAtom,
	SyncJudgeMode,
	smartFirstWordAtom,
	smartLastWordAtom,
	syncJudgeModeAtom,
} from "$/modules/settings/states";
import { lyricLinesAtom } from "$/states/main";
import {
	KeyBindingTriggerMode,
	keyBindingTriggerModeAtom,
} from "$/utils/keybindings";
import { SettingsGroup, SettingsRow } from "./SettingsGroup";

const languageOptions: readonly string[] = Object.keys(resources);
const textFieldActionStyle = { width: "min(220px, 100%)" };

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
	const [defaultTtmlAuthorGithub, setDefaultTtmlAuthorGithub] = useAtom(
		defaultTtmlAuthorGithubAtom,
	);
	const [defaultTtmlAuthorGithubLogin, setDefaultTtmlAuthorGithubLogin] =
		useAtom(defaultTtmlAuthorGithubLoginAtom);
	const [, setLyricLines] = useAtom(lyricLinesAtom);
	const { t, i18n } = useTranslation();
	const currentLanguage = i18n.resolvedLanguage || i18n.language;

	const applyDefaultAuthors = (githubId: string, githubLogin: string) => {
		setLyricLines((prev) => {
			const metadata = prev.metadata.map((item) => ({
				...item,
				value: [...item.value],
			}));
			const changed = applyDefaultTtmlAuthorMetadata(metadata, {
				githubId,
				githubLogin,
			});
			if (!changed) return prev;
			return { ...prev, metadata };
		});
	};

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

	return (
		<Flex direction="column" gap="4">
			<SettingsGroup title={t("settings.group.display", "显示")}>
				<SettingsRow
					icon={<LocalLanguage24Regular />}
					title={t("settings.common.language", "界面语言")}
					description={t("settings.common.languageDesc", "选择界面显示的语言")}
					action={
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
					}
				/>

				<SettingsRow
					icon={<ContentView24Regular />}
					title={t("settings.common.layoutMode", "编辑布局模式")}
					description={
						<>
							{t(
								"settings.common.layoutModeDesc.line1",
								"简单布局能够满足大部分使用者的基本需求",
							)}
							<br />
							{t(
								"settings.common.layoutModeDesc.line2",
								"如果你需要更加高效的打轴的话，可以考虑切换到高级模式",
							)}
						</>
					}
					action={
						<Select.Root
							value={layoutMode}
							onValueChange={(v) => setLayoutMode(v as LayoutMode)}
						>
							<Select.Trigger />
							<Select.Content>
								<Select.Item value={LayoutMode.Simple}>
									{t("settings.common.layoutModeOptions.simple", "简单模式")}
								</Select.Item>
								<Select.Item value={LayoutMode.Advance}>
									{t("settings.common.layoutModeOptions.advance", "高级模式")}
								</Select.Item>
							</Select.Content>
						</Select.Root>
					}
				/>
			</SettingsGroup>

			<SettingsGroup title={t("settings.group.metadata", "元数据")}>
				<SettingsRow
					icon={<GithubIcon />}
					title={t(
						"settings.common.defaultTtmlAuthorGithub",
						"默认 TTML 作者 GitHub ID",
					)}
					description={t(
						"settings.common.defaultTtmlAuthorGithubDesc",
						"当 ttmlAuthorGithub 为空时自动填入",
					)}
					action={
						<TextField.Root
							style={textFieldActionStyle}
							value={defaultTtmlAuthorGithub}
							onChange={(e) => {
								const nextValue = e.currentTarget.value;
								setDefaultTtmlAuthorGithub(nextValue);
								applyDefaultAuthors(nextValue, defaultTtmlAuthorGithubLogin);
							}}
						/>
					}
				/>

				<SettingsRow
					icon={<GithubIcon />}
					title={t(
						"settings.common.defaultTtmlAuthorGithubLogin",
						"默认 TTML 作者用户名",
					)}
					description={t(
						"settings.common.defaultTtmlAuthorGithubLoginDesc",
						"当 ttmlAuthorGithubLogin 为空时自动填入",
					)}
					action={
						<TextField.Root
							style={textFieldActionStyle}
							value={defaultTtmlAuthorGithubLogin}
							onChange={(e) => {
								const nextValue = e.currentTarget.value;
								setDefaultTtmlAuthorGithubLogin(nextValue);
								applyDefaultAuthors(defaultTtmlAuthorGithub, nextValue);
							}}
						/>
					}
				/>
			</SettingsGroup>

			<SettingsGroup title={t("settings.group.timing", "打轴")}>
				<SettingsRow
					icon={<Timer24Regular />}
					title={t("settings.common.syncJudgeMode", "打轴时间戳判定模式")}
					description={t(
						"settings.common.syncJudgeModeDesc",
						'设置打轴时间戳的判定模式，默认为"首个按键按下时间"。',
					)}
					action={
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
					}
				/>

				<SettingsRow
					icon={<Keyboard12324Regular />}
					title={t("settings.common.keyBindingTrigger", "快捷键触发时机")}
					description={t(
						"settings.common.keyBindingTriggerDesc",
						"快捷键是在按下时触发还是在松开时触发",
					)}
					action={
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
					}
				/>

				<SettingsRow
					asLabel
					icon={<PaddingLeft24Regular />}
					title={t("settings.common.smartFirstWord", "智能首字")}
					description={t(
						"settings.common.smartFirstWordDesc",
						"对行首第一个音节打轴时，第一次按下“起始轴”按钮会设置其开始时间，但不会设置其结束时间。",
					)}
					action={
						<Switch
							checked={smartFirstWord}
							onCheckedChange={setSmartFirstWord}
						/>
					}
				/>

				<SettingsRow
					asLabel
					icon={<PaddingRight24Regular />}
					title={t("settings.common.smartLastWord", "智能尾字")}
					description={t(
						"settings.common.smartLastWordDesc",
						"对行末最后一个音节打轴时，最后一次按下“结束轴”按钮会设置其结束时间，但不会设置下一行第一个音节的开始时间。",
					)}
					action={
						<Switch
							checked={smartLastWord}
							onCheckedChange={setSmartLastWord}
						/>
					}
				/>
			</SettingsGroup>

			<SettingsGroup title={t("settings.group.playback", "播放")}>
				<SettingsRow icon={<Speaker224Regular />}>
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
				</SettingsRow>

				<SettingsRow icon={<TopSpeed24Regular />}>
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
				</SettingsRow>
			</SettingsGroup>

			<SettingsGroup title={t("settings.group.autosave", "自动保存")}>
				<SettingsRow
					asLabel
					icon={<Save24Regular />}
					title={t("settings.common.autosave.enable", "启用自动保存")}
					action={
						<Switch
							checked={autosaveEnabled}
							onCheckedChange={setAutosaveEnabled}
						/>
					}
				/>

				<SettingsRow icon={<History24Regular />}>
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
				</SettingsRow>

				<SettingsRow icon={<Stack24Regular />}>
					<Flex direction="column" gap="2" align="start">
						<Flex
							align="center"
							justify="between"
							style={{ alignSelf: "stretch" }}
						>
							<Text>{t("settings.common.autosave.limit", "保留快照数量")}</Text>
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
				</SettingsRow>
			</SettingsGroup>
		</Flex>
	);
};
