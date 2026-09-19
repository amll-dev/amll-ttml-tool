import {
	Add24Regular,
	Color24Regular,
	DataHistogram24Regular,
	DataTrending24Regular,
} from "@fluentui/react-icons";
import {
	Button,
	Flex,
	IconButton,
	Select,
	Slider,
	Switch,
	Text,
	TextField,
	Tooltip,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	commitLogAmountAtom,
	customPaletteStopsAtom,
	naturalWeightingScopeAtom,
	naturalWeightingTiltAtom,
	predefinedPalettes,
	REASSIGN_FFT_SIZE_OPTIONS,
	REASSIGN_OVERLAP_OPTIONS,
	selectedPaletteIdAtom,
	setReassignEnabledAtom,
	spectrogramLogAmountAtom,
	spectrogramReassignAppliedAtom,
	spectrogramReassignAtom,
	spectrogramReassignFftSizeAtom,
	spectrogramReassignOverlapAtom,
} from "$/modules/spectrogram/states";
import {
	NATURAL_WEIGHTING_TILT_OPTIONS,
	type NaturalWeightingScope,
} from "$/modules/spectrogram/utils/natural-weighting";
import styles from "./SettingsDialog.module.css";
import { SettingsRow } from "./SettingsGroup";

const paletteToGradient = (palette: Uint8Array) => {
	const samples = Array.from({ length: 8 }, (_, index) => {
		const colorIndex = Math.round((index / 7) * 255);
		const dataIndex = colorIndex * 4;
		const r = palette[dataIndex] ?? 0;
		const g = palette[dataIndex + 1] ?? 0;
		const b = palette[dataIndex + 2] ?? 0;
		const percent = (index / 7) * 100;
		return `rgb(${r}, ${g}, ${b}) ${percent}%`;
	});

	return `linear-gradient(to right, ${samples.join(", ")})`;
};

export const SettingsSpectrogramPalettePage = ({
	onOpenCustomPalette,
}: {
	onOpenCustomPalette: () => void;
}) => {
	const { t } = useTranslation();
	const [selectedPaletteId, setSelectedPaletteId] = useAtom(
		selectedPaletteIdAtom,
	);

	return (
		<SettingsRow
			icon={<Color24Regular />}
			title={t("settings.spectrogram.palette", "配色方案")}
			action={
				<div className={styles.paletteButtonRow}>
					{predefinedPalettes.map((palette) => (
						<Tooltip key={palette.id} content={palette.name}>
							<button
								type="button"
								className={styles.paletteButton}
								data-active={selectedPaletteId === palette.id || undefined}
								onClick={() => setSelectedPaletteId(palette.id)}
								aria-label={palette.name}
							>
								<span
									className={styles.palettePreview}
									style={{ backgroundImage: paletteToGradient(palette.data) }}
								/>
							</button>
						</Tooltip>
					))}
					<Tooltip content={t("settings.spectrogram.paletteCustom", "自定义")}>
						<IconButton
							variant={selectedPaletteId === "custom" ? "soft" : "outline"}
							aria-label={t("settings.spectrogram.paletteCustom", "自定义")}
							onClick={() => {
								setSelectedPaletteId("custom");
								onOpenCustomPalette();
							}}
						>
							<Add24Regular />
						</IconButton>
					</Tooltip>
				</div>
			}
		/>
	);
};

export const SettingsSpectrogramCustomPalettePage = () => {
	const { t } = useTranslation();
	const [globalStops, setGlobalStops] = useAtom(customPaletteStopsAtom);
	const [localStops, setLocalStops] = useState(globalStops);

	useEffect(() => {
		setLocalStops(globalStops);
	}, [globalStops]);

	const gradientCss = useMemo(() => {
		const stopsString = localStops
			.map((stop) => `${stop.color} ${stop.pos * 100}%`)
			.join(", ");
		return `linear-gradient(to right, ${stopsString})`;
	}, [localStops]);

	const handleStopColorChange = (index: number, color: string) => {
		setLocalStops(
			localStops.map((stop, i) => (i === index ? { ...stop, color } : stop)),
		);
	};

	const handleStopPosChange = (index: number, pos: number) => {
		const newPos = Number.isNaN(pos) ? 0 : Math.max(0, Math.min(1, pos));

		setLocalStops(
			localStops.map((stop, i) =>
				i === index ? { ...stop, pos: newPos } : stop,
			),
		);
	};

	const commitLocalChanges = () => {
		const sortedStops = [...localStops].sort((a, b) => a.pos - b.pos);
		setGlobalStops(sortedStops);
		setLocalStops(sortedStops);
	};

	const handleRemoveStop = (index: number) => {
		setGlobalStops(globalStops.filter((_, i) => i !== index));
	};

	const handleAddStop = () => {
		setGlobalStops(
			[
				...globalStops,
				{
					id: crypto.randomUUID(),
					pos: 1.0,
					color: "#ffffff",
				},
			].sort((a, b) => a.pos - b.pos),
		);
	};

	return (
		<Flex direction="column" gap="4">
			<Flex
				asChild
				p="2"
				style={{
					border: "1px solid var(--gray-a5)",
					borderRadius: "var(--radius-3)",
				}}
			>
				<section>
					<Flex direction="column" gap="3" width="100%">
						<Text size="1" color="gray">
							{t(
								"settings.spectrogram.gradientEditorDesc",
								"Pos 0.0 对应最安静的部分，1.0 对应最响亮的部分。建议 Pos 越大，使用亮度越高的颜色。",
							)}
						</Text>

						<div
							style={{
								width: "100%",
								height: "24px",
								backgroundImage: gradientCss,
								border: "1px solid var(--gray-a6)",
								borderRadius: "var(--radius-2)",
							}}
						/>

						{localStops.map((stop, index) => (
							<Flex key={stop.id} align="center" gap="2">
								<input
									type="color"
									value={stop.color}
									onChange={(e) => handleStopColorChange(index, e.target.value)}
									onBlur={commitLocalChanges}
									style={{
										border: "none",
										padding: 0,
										background: "none",
										width: "28px",
										height: "28px",
									}}
								/>
								<TextField.Root
									type="number"
									min={0}
									max={1}
									step={0.01}
									value={stop.pos}
									onChange={(e) =>
										handleStopPosChange(
											index,
											e.target.value === ""
												? NaN
												: Number.parseFloat(e.target.value),
										)
									}
									onBlur={commitLocalChanges}
									style={{ maxWidth: "80px" }}
								/>
								<Text size="1">Pos: {stop.pos.toFixed(2)}</Text>
								<Button
									variant="soft"
									color="red"
									disabled={localStops.length <= 1}
									onClick={() => handleRemoveStop(index)}
									style={{ marginLeft: "auto" }}
								>
									{t("common.remove", "移除")}
								</Button>
							</Flex>
						))}
						<Button variant="outline" onClick={handleAddStop}>
							{t("settings.spectrogram.addStop", "添加色标")}
						</Button>
					</Flex>
				</section>
			</Flex>
		</Flex>
	);
};

export const SettingsSpectrogramFrequencyRows = () => {
	const { t } = useTranslation();
	const [logAmount, setLogAmount] = useAtom(spectrogramLogAmountAtom);
	const reassign = useAtomValue(spectrogramReassignAtom);
	const setReassign = useSetAtom(setReassignEnabledAtom);
	const commitLogAmount = useSetAtom(commitLogAmountAtom);
	const [reassignFftSize, setReassignFftSize] = useAtom(
		spectrogramReassignFftSizeAtom,
	);
	const [reassignOverlap, setReassignOverlap] = useAtom(
		spectrogramReassignOverlapAtom,
	);
	const [reassignApplied, setReassignApplied] = useAtom(
		spectrogramReassignAppliedAtom,
	);

	const reassignDirty =
		reassignFftSize !== reassignApplied.fftSize ||
		reassignOverlap !== reassignApplied.overlapPercent ||
		logAmount !== reassignApplied.logAmount;

	const applyReassignConfig = () => {
		setReassignApplied({
			fftSize: reassignFftSize,
			overlapPercent: reassignOverlap,
			logAmount,
		});
	};

	return (
		<SettingsRow
			icon={<DataTrending24Regular />}
			title={t("settings.spectrogram.frequencyAxis", "频率轴")}
			description={t(
				"settings.spectrogram.logAmountDesc",
				"控制频率重分配曲线的对数程度：0 为线性，1 为完全对数，低频会占用更多行。",
			)}
		>
			<Flex direction="column" gap="3" style={{ width: "100%" }}>
				<Flex align="center" gap="3">
					<Slider
						min={0}
						max={1}
						step={0.01}
						value={[logAmount]}
						onValueChange={(v) => setLogAmount(v[0])}
						onValueCommit={(v) => commitLogAmount(v[0])}
						style={{ flex: 1 }}
					/>
					<Text size="1" color="gray" style={{ minWidth: "4.5em" }}>
						{logAmount <= 0
							? t("spectrogram.linear", "线性")
							: t("spectrogram.logarithmic", "对数 {percent}%", {
									percent: Math.round(logAmount * 100),
								})}
					</Text>
				</Flex>

				<Flex align="center" justify="between" gap="2">
					<Text size="2">{t("spectrogram.reassign", "频率重分配")}</Text>
					<Switch checked={reassign} onCheckedChange={setReassign} />
				</Flex>
				<Text size="1" color="gray">
					{t(
						"settings.spectrogram.reassignDesc",
						"使用相位声码器估计瞬时频率并把能量重分配，频谱会锐利很多，但计算量更大。",
					)}
				</Text>
				<Text size="1" color="gray">
					{t(
						"settings.spectrogram.reassignOnlyParams",
						"FFT 窗口大小与重叠只作用于重分配频谱；普通频谱固定使用 FFT 1024 / 帧移 64（约 93.75% 重叠）。",
					)}
				</Text>

				{reassign && (
					<>
						<Flex direction="column" gap="1">
							<Text size="1" color="gray">
								{t("spectrogram.fftSize", "FFT 窗口大小（重分配）")}
							</Text>
							<Select.Root
								value={String(reassignFftSize)}
								onValueChange={(v) => setReassignFftSize(Number(v))}
							>
								<Select.Trigger />
								<Select.Content>
									{REASSIGN_FFT_SIZE_OPTIONS.map((size) => (
										<Select.Item key={size} value={String(size)}>
											{size}
										</Select.Item>
									))}
								</Select.Content>
							</Select.Root>
							<Text size="1" color="gray">
								{t(
									"settings.spectrogram.fftSizeDesc",
									"越大频率分辨率越高，但时间分辨率越低、计算量越大。",
								)}
							</Text>
						</Flex>

						<Flex direction="column" gap="1">
							<Text size="1" color="gray">
								{t("spectrogram.overlap", "重叠（重分配）")}
							</Text>
							<Select.Root
								value={String(reassignOverlap)}
								onValueChange={(v) => setReassignOverlap(Number(v))}
							>
								<Select.Trigger />
								<Select.Content>
									{REASSIGN_OVERLAP_OPTIONS.map((value) => (
										<Select.Item key={value} value={String(value)}>
											{value}%
										</Select.Item>
									))}
								</Select.Content>
							</Select.Root>
							<Text size="1" color="gray">
								{t(
									"settings.spectrogram.overlapDesc",
									"重叠越高，横向（时间）分辨率越高，但计算量也越大。重叠过低（≤50%）会因相位混叠出现伪影，建议 87.5% 及以上。",
								)}
							</Text>
						</Flex>

						<Button
							onClick={applyReassignConfig}
							disabled={!reassignDirty}
							variant={reassignDirty ? "solid" : "soft"}
						>
							{t("spectrogram.applyReassign", "应用并重新计算")}
						</Button>
						<Text size="1" color="gray">
							{reassignDirty
								? t(
										"spectrogram.reassignPending",
										"参数已修改，点击按钮后才会重新计算。",
									)
								: t("spectrogram.reassignApplied", "参数已生效。")}
						</Text>
					</>
				)}
			</Flex>
		</SettingsRow>
	);
};

export const SettingsSpectrogramNaturalWeightingRows = () => {
	const { t } = useTranslation();
	const [naturalWeightingScope, setNaturalWeightingScope] = useAtom(
		naturalWeightingScopeAtom,
	);
	const [naturalWeightingTilt, setNaturalWeightingTilt] = useAtom(
		naturalWeightingTiltAtom,
	);

	return (
		<>
			<SettingsRow
				icon={<DataHistogram24Regular />}
				title={t(
					"settings.spectrogram.naturalWeighting",
					"自然加权工作区域",
				)}
				description={t(
					"settings.spectrogram.naturalWeightingDesc",
					"自然加权（频谱倾斜）用于补偿自然音频的能量滚降：压低低频、提升高频，避免低频在显示上压倒高频。",
				)}
				action={
					<Select.Root
						value={naturalWeightingScope}
						onValueChange={(v) =>
							setNaturalWeightingScope(v as NaturalWeightingScope)
						}
					>
						<Select.Trigger />
						<Select.Content>
							<Select.Item value="none">
								{t("settings.spectrogram.naturalWeightingNone", "无")}
							</Select.Item>
							<Select.Item value="normal">
								{t(
									"settings.spectrogram.naturalWeightingNormal",
									"仅普通频谱",
								)}
							</Select.Item>
							<Select.Item value="reassign">
								{t(
									"settings.spectrogram.naturalWeightingReassign",
									"仅重分配频谱",
								)}
							</Select.Item>
							<Select.Item value="both">
								{t("settings.spectrogram.naturalWeightingBoth", "全部")}
							</Select.Item>
						</Select.Content>
					</Select.Root>
				}
			/>

			<SettingsRow
				icon={<DataHistogram24Regular />}
				title={t(
					"settings.spectrogram.naturalWeightingTilt",
					"自然加权倾斜度",
				)}
				description={t(
					"settings.spectrogram.naturalWeightingTiltDesc",
					"单位为 dB/倍频程，正值提升高频、压低低频；0 表示不倾斜。",
				)}
				action={
					<Select.Root
						value={String(naturalWeightingTilt)}
						onValueChange={(v) => setNaturalWeightingTilt(Number(v))}
					>
						<Select.Trigger />
						<Select.Content>
							{NATURAL_WEIGHTING_TILT_OPTIONS.map((value) => (
								<Select.Item key={value} value={String(value)}>
									{value === 0
										? t(
												"settings.spectrogram.naturalWeightingTiltOff",
												"关闭",
											)
										: `${value} dB/oct`}
								</Select.Item>
							))}
						</Select.Content>
					</Select.Root>
				}
			/>
		</>
	);
};

