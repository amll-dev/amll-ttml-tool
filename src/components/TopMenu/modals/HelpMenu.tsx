import { Button, DropdownMenu } from "@radix-ui/themes";
import type { CSSProperties } from "react";
import { Toolbar } from "radix-ui";
import { Trans, useTranslation } from "react-i18next";

type HelpMenuProps = {
	variant: "toolbar" | "submenu";
	onOpenGitHub: () => void;
	onOpenWiki: () => void;
	buttonStyle?: CSSProperties;
};

const HelpMenuItems = ({
	onOpenGitHub,
	onOpenWiki,
}: Omit<HelpMenuProps, "variant" | "buttonStyle">) => {
	const { t } = useTranslation();

	return (
		<>
			<DropdownMenu.Item onSelect={onOpenGitHub}>GitHub</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={onOpenWiki}>
				{t("topBar.menu.helpDoc", "使用说明")}
			</DropdownMenu.Item>
		</>
	);
};

export const HelpMenu = (props: HelpMenuProps) => {
	if (props.variant === "submenu") {
		return (
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<Trans i18nKey="topBar.menu.help">帮助</Trans>
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<HelpMenuItems {...props} />
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		);
	}

	return (
		<DropdownMenu.Root>
			<Toolbar.Button asChild>
				<DropdownMenu.Trigger>
					<Button variant="soft" style={props.buttonStyle}>
						<Trans i18nKey="topBar.menu.help">帮助</Trans>
					</Button>
				</DropdownMenu.Trigger>
			</Toolbar.Button>
			<DropdownMenu.Content>
				<HelpMenuItems {...props} />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
