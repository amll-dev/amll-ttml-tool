import {
	ArrowHookUpLeft24Regular,
	Dismiss24Regular,
	Image24Regular,
} from "@fluentui/react-icons";
import {
	Button,
	Box,
	Card,
	Flex,
	Heading,
	IconButton,
	Slider,
	Text,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
	customBackgroundBlurAtom,
	customBackgroundBrightnessAtom,
	customBackgroundImageAtom,
	customBackgroundMaskAtom,
	customBackgroundOpacityAtom,
} from "$/modules/settings/states";

export const SettingsCustomBackgroundSettings = ({
	onClose,
}: {
	onClose: () => void;
}) => {
	const [customBackgroundImage, setCustomBackgroundImage] = useAtom(
		customBackgroundImageAtom,
	);
	const [customBackgroundOpacity, setCustomBackgroundOpacity] = useAtom(
		customBackgroundOpacityAtom,
	);
	const [customBackgroundMask, setCustomBackgroundMask] = useAtom(
		customBackgroundMaskAtom,
	);
	const [customBackgroundBlur, setCustomBackgroundBlur] = useAtom(
		customBackgroundBlurAtom,
	);
	const [customBackgroundBrightness, setCustomBackgroundBrightness] = useAtom(
		customBackgroundBrightnessAtom,
	);
	const { t } = useTranslation();
	const backgroundFileInputRef = useRef<HTMLInputElement>(null);

	const onSelectBackgroundFile = useCallback(
		(file: File) => {
			const reader = new FileReader();
			reader.onload = () => {
				if (typeof reader.result === "string") {
					setCustomBackgroundImage(reader.result);
				}
			};
			reader.readAsDataURL(file);
		},
		[setCustomBackgroundImage],
	);

	return (
		<Flex direction="column" gap="4">
			<Flex align="center" justify="between">
				<Heading size="4">
					{t("settings.common.customBackground", "自定义背景")}
				</Heading>
				<IconButton variant="ghost" onClick={onClose}>
					<Dismiss24Regular />
				</IconButton>
			</Flex>

			<Card>
				<Flex direction="column" gap="3">
					<Text size="1" color="gray">
						{t(
							"settings.common.customBackgroundDesc",
							"选择一张图片作为背景。",
						)}
					</Text>
					<input
						ref={backgroundFileInputRef}
						type="file"
						accept="image/*"
						style={{ display: "none" }}
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (!file) return;
							onSelectBackgroundFile(file);
							event.target.value = "";
						}}
					/>
					<Flex gap="2" align="center">
						<Button
							variant="soft"
							onClick={() => backgroundFileInputRef.current?.click()}
						>
							{t("settings.common.customBackgroundPick", "选择图片")}
						</Button>
						<Button
							variant="ghost"
							disabled={!customBackgroundImage}
							onClick={() => setCustomBackgroundImage(null)}
						>
							{t("settings.common.customBackgroundClear", "清除")}
						</Button>
					</Flex>
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="2">
					<Flex align="center" justify="between">
						<Text>{t("settings.common.customBackgroundOpacity", "透明度")}</Text>
						<Flex align="center" gap="2">
							<Text wrap="nowrap" color="gray" size="1">
								{Math.round(customBackgroundOpacity * 100)}%
							</Text>
							{customBackgroundOpacity !== 0.4 && (
								<IconButton
									variant="ghost"
									size="1"
									onClick={() => setCustomBackgroundOpacity(0.4)}
								>
									<ArrowHookUpLeft24Regular />
								</IconButton>
							)}
						</Flex>
					</Flex>
					<Slider
						min={0}
						max={1}
						step={0.01}
						value={[customBackgroundOpacity]}
						onValueChange={(v) => setCustomBackgroundOpacity(v[0])}
					/>
					{customBackgroundOpacity >= 0.5 && (
						<Text size="1" color="orange">
							{t(
								"settings.common.customBackgroundOpacityWarning",
								"如果这个数值太高可能让你看不清页面上的内容。",
							)}
						</Text>
					)}
				</Flex>
			</Card>

			<Card style={{ marginBottom: "var(--space-1)" }}>
				<Flex direction="column" gap="2">
					<Flex align="center" justify="between">
						<Text>{t("settings.common.customBackgroundMask", "遮罩")}</Text>
						<Flex align="center" gap="2">
							<Text wrap="nowrap" color="gray" size="1">
								{Math.round(customBackgroundMask * 100)}%
							</Text>
							{customBackgroundMask !== 0.2 && (
								<IconButton
									variant="ghost"
									size="1"
									onClick={() => setCustomBackgroundMask(0.2)}
								>
									<ArrowHookUpLeft24Regular />
								</IconButton>
							)}
						</Flex>
					</Flex>
					<Slider
						min={0}
						max={1}
						step={0.01}
						value={[customBackgroundMask]}
						onValueChange={(v) => setCustomBackgroundMask(v[0])}
					/>
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="2">
					<Flex align="center" justify="between">
						<Text>{t("settings.common.customBackgroundBlur", "模糊半径")}</Text>
						<Flex align="center" gap="2">
							<Text wrap="nowrap" color="gray" size="1">
								{customBackgroundBlur.toFixed(0)}px
							</Text>
							{customBackgroundBlur !== 0 && (
								<IconButton
									variant="ghost"
									size="1"
									onClick={() => setCustomBackgroundBlur(0)}
								>
									<ArrowHookUpLeft24Regular />
								</IconButton>
							)}
						</Flex>
					</Flex>
					<Slider
						min={0}
						max={30}
						step={1}
						value={[customBackgroundBlur]}
						onValueChange={(v) => setCustomBackgroundBlur(v[0])}
					/>
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="2">
					<Flex align="center" justify="between">
						<Text>{t("settings.common.customBackgroundBrightness", "亮度")}</Text>
						<Flex align="center" gap="2">
							<Text wrap="nowrap" color="gray" size="1">
								{Math.round(customBackgroundBrightness * 100)}%
							</Text>
							{customBackgroundBrightness !== 1 && (
								<IconButton
									variant="ghost"
									size="1"
									onClick={() => setCustomBackgroundBrightness(1)}
								>
									<ArrowHookUpLeft24Regular />
								</IconButton>
							)}
						</Flex>
					</Flex>
					<Slider
						min={0.5}
						max={1.5}
						step={0.01}
						value={[customBackgroundBrightness]}
						onValueChange={(v) => setCustomBackgroundBrightness(v[0])}
					/>
				</Flex>
			</Card>
		</Flex>
	);
};

export const SettingsCustomBackgroundCard = ({
	onOpen,
}: {
	onOpen: () => void;
}) => {
	const [customBackgroundImage] = useAtom(customBackgroundImageAtom);
	const { t } = useTranslation();

	return (
		<Card style={{ width: "100%", marginBottom: "var(--space-1)" }}>
			<Flex gap="3" align="center">
				<Image24Regular />
				<Box flexGrow="1">
					<Flex align="center" justify="between" gap="4">
						<Flex direction="column" gap="1">
							<Text>{t("settings.common.customBackground", "自定义背景")}</Text>
							<Text size="1" color="gray">
								{customBackgroundImage
									? t(
											"settings.common.customBackgroundEnabled",
											"已设置背景",
										)
									: t(
											"settings.common.customBackgroundDesc",
											"选择一张图片作为背景。",
										)}
							</Text>
						</Flex>
						<Button variant="soft" onClick={onOpen}>
							{t("settings.common.customBackgroundManage", "设置")}
						</Button>
					</Flex>
				</Box>
			</Flex>
		</Card>
	);
};
