import type { KeyboardEvent } from "react";

const isVisible = (element: HTMLElement) => element.getClientRects().length > 0;

const findControl = (group: string, key: string) =>
	Array.from(
		document.querySelectorAll<HTMLElement>("[data-tab-group][data-tab-key]"),
	)
		.filter(
			(element) =>
				element.dataset.tabGroup === group &&
				element.dataset.tabKey === key &&
				isVisible(element),
		)
		.sort((a, b) => {
			const aFocusable = a.matches("input,textarea,select,button") ? 0 : 1;
			const bFocusable = b.matches("input,textarea,select,button") ? 0 : 1;
			return aFocusable - bFocusable;
		})[0];

const focusControl = (element: HTMLElement) => {
	const input = element.matches("input,textarea,select,button")
		? element
		: element.querySelector<HTMLElement>("input,textarea,select,button");
	(input ?? element).focus();
};

export const handleTabNavigation = (
	event: KeyboardEvent<HTMLElement>,
	group: string,
) => {
	if (event.key !== "Tab" || event.defaultPrevented) return;

	const eventTarget = event.target as HTMLElement;
	const current = eventTarget.closest<HTMLElement>(
		"[data-tab-group][data-tab-key]",
	);
	if (!current || current.dataset.tabGroup !== group) return;
	const controls = Array.from(
		document.querySelectorAll<HTMLElement>("[data-tab-group][data-tab-key]"),
	).filter(
		(element, index, all) =>
			element.dataset.tabGroup === group &&
			isVisible(element) &&
			all.indexOf(element) === index,
	);
	const currentIndex = controls.indexOf(current);
	if (currentIndex < 0) return;

	const next = controls[currentIndex + (event.shiftKey ? -1 : 1)];
	if (!next) return;
	event.preventDefault();
	event.stopPropagation();

	if (next.dataset.tabActivate === "click") next.click();
	if (next.dataset.tabActivate === "double-click") {
		next.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
	}

	const key = next.dataset.tabKey;
	requestAnimationFrame(() => {
		if (!key) return;
		const activated = findControl(group, key);
		if (activated) focusControl(activated);
	});
};
