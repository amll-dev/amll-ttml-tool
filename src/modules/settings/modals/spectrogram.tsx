import { Add24Regular, Color24Regular } from "@fluentui/react-icons";
import {
	Button,
	Flex,
	IconButton,
	Text,
	TextField,
	Tooltip,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	customPaletteStopsAtom,
	predefinedPalettes,
	selectedPaletteIdAtom,
} from "$/modules/spectrogram/states";
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
