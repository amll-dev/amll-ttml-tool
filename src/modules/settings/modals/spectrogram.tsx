import { Button, Flex, Select, Text, TextField } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	customPaletteStopsAtom,
	predefinedPalettes,
	selectedPaletteIdAtom,
} from "$/modules/spectrogram/states";

export const SettingsSpectrogramTab = () => {
	const { t } = useTranslation();
	const [selectedPaletteId, setSelectedPaletteId] = useAtom(
		selectedPaletteIdAtom,
	);
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
			<Text as="label">
				<Flex direction="column" gap="2" align="start">
					<Text>{t("settings.spectrogram.palette", "配色方案")}</Text>
					<Select.Root
						value={selectedPaletteId}
						onValueChange={(v) => setSelectedPaletteId(v)}
					>
						<Select.Trigger /><Select.Content>
							{predefinedPalettes.map((palette) => (
								<Select.Item key={palette.id} value={palette.id}>
									{palette.name}
								</Select.Item>
							))}
							<Select.Separator />
							<Select.Item value="custom">
								{t("settings.spectrogram.paletteCustom", "自定义")}
							</Select.Item>
						</Select.Content>
					</Select.Root>
				</Flex>
			</Text>

			{selectedPaletteId === "custom" && (
				<Flex
					asChild
					p="2"
					style={{
						border: "1px solid var(--gray-a5)",
						borderRadius: "var(--radius-3)",
					}}
				><section>
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
										onChange={(e) =>
											handleStopColorChange(index, e.target.value)
										}
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
			)}
		</Flex>
	);
};
