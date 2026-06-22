import { Box, Grid, Heading, TextField } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatKeyBindings, recordShortcut } from "$/utils/keybindings";
import { getAllCommands } from "../registry";
import type { KeyBindingCommand } from "../types";
import styles from "./SettingsPanel.module.css";

const KeyBindingsEdit = ({ command }: { command: KeyBindingCommand }) => {
	const { t } = useTranslation();
	const [keys, setKeys] = useAtom(command.atom);
	const [listening, setListening] = useState(false);

	return (
		<>
			<Box style={{ display: "flex", alignItems: "center" }}>
				{t(command.description)}
			</Box>

			<Box>
				<TextField.Root
					onClick={async () => {
						try {
							setListening(true);
							const newKeys = await recordShortcut();
							setKeys(newKeys);
						} catch {
							// 用户取消
						} finally {
							setListening(false);
						}
					}}
					size="2"
					value={listening ? "..." : formatKeyBindings(keys)}
					readOnly
					variant="soft"
					className={styles.shortcutField}
					style={{
						cursor: "pointer",
						textAlign: "left",
					}}
					data-listening={listening || undefined}
				/>
			</Box>
		</>
	);
};

export const AutoKeyBindingSettingsPanel = () => {
	const { t } = useTranslation();
	const commands = getAllCommands();

	const groupedCommands = commands.reduce(
		(acc, cmd) => {
			if (!acc[cmd.category]) {
				acc[cmd.category] = [];
			}
			acc[cmd.category].push(cmd);
			return acc;
		},
		{} as Record<string, KeyBindingCommand[]>,
	);

	return (
		<Box>
			{Object.entries(groupedCommands).map(([category, cmds]) => (
				<Box key={category} mb="5">
					<Heading size="3" mb="3" color="gray">
						{t(`settingsDialog.keybindings.category.${category}`, category)}
					</Heading>

					<Grid
						columns={{ initial: "1", sm: "2" }}
						gapX="4"
						gapY="3"
						align="center"
						className={styles.groupPanel}
					>
						{cmds.map((cmd) => (
							<KeyBindingsEdit key={cmd.id} command={cmd} />
						))}
					</Grid>
				</Box>
			))}
		</Box>
	);
};
