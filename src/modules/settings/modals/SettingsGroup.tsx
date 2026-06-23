import { Flex, Heading, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import styles from "./SettingsDialog.module.css";

interface SettingsGroupProps {
	title?: ReactNode;
	children: ReactNode;
}

interface SettingsRowProps {
	icon: ReactNode;
	title?: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	children?: ReactNode;
	asLabel?: boolean;
}

export const SettingsGroup = ({ title, children }: SettingsGroupProps) => (
	<Flex direction="column" gap="2">
		{title && <Heading size="4">{title}</Heading>}
		<div className={styles.settingsGroup}>{children}</div>
	</Flex>
);

export const SettingsRow = ({
	icon,
	title,
	description,
	action,
	children,
	asLabel = false,
}: SettingsRowProps) => {
	const content = (
		<>
			<span className={styles.settingsRowIcon}>{icon}</span>
			<div className={styles.settingsRowContent}>
				{title && <Text>{title}</Text>}
				{description && (
					<Text size="1" color="gray">
						{description}
					</Text>
				)}
				{children}
			</div>
			{action && <div className={styles.settingsRowAction}>{action}</div>}
		</>
	);

	if (asLabel) {
		return <label className={styles.settingsRow}>{content}</label>;
	}

	return <div className={styles.settingsRow}>{content}</div>;
};
