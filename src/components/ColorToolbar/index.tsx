import React, { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useCursorInjection } from "../../hooks/useCursorInjection";
import { useColorAssets } from "../../hooks/useColorAssets";
import { ColorLibrary } from "../ColorLibrary";

const TOOLBAR_HEIGHT = 70;
const MENU_HEIGHT = 500;

export const ColorToolbar: React.FC = () => {
	const { t } = useTranslation();
	const { insertAtCursor, wrapSelection } = useCursorInjection();
	const { system, saveColorToSlot, getActiveFolder } = useColorAssets();

	const [currentColor, setCurrentColor] = useState("#FF0000");
	const [showLibrary, setShowLibrary] = useState(false);
	const [menuPlacement, setMenuPlacement] = useState<"top" | "bottom">(
		"bottom",
	);
	const [position, setPosition] = useState({
		x: window.innerWidth - 400,
		y: 100,
	});
	const draggingRef = useRef(false);
	const dragOffsetRef = useRef({ x: 0, y: 0 });
	const timerRef = useRef<NodeJS.Timeout | null>(null);
	const lastInsertColorRef = useRef<string>("");

	const isVertical = system.orientation === "vertical";

	// 菜单位置自适应
	useEffect(() => {
		if (showLibrary) {
			const windowHeight = window.innerHeight;
			const toolbarBottom = position.y + TOOLBAR_HEIGHT;
			const spaceBelow = windowHeight - toolbarBottom;

			if (spaceBelow < MENU_HEIGHT) {
				setMenuPlacement("top");
			} else {
				setMenuPlacement("bottom");
			}
		}
	}, [showLibrary, position.y]);

	// 拖拽逻辑
	const handleMouseDown = (e: React.MouseEvent) => {
		draggingRef.current = true;
		dragOffsetRef.current = {
			x: e.clientX - position.x,
			y: e.clientY - position.y,
		};
	};

	const handleMouseMove = useCallback((e: MouseEvent) => {
		if (!draggingRef.current) return;
		let newX = e.clientX - dragOffsetRef.current.x;
		let newY = e.clientY - dragOffsetRef.current.y;
		const maxX = window.innerWidth - 60;
		const maxY = window.innerHeight - 60;
		newX = Math.max(0, Math.min(newX, maxX));
		newY = Math.max(0, Math.min(newY, maxY));
		setPosition({ x: newX, y: newY });
	}, []);

	const handleMouseUp = useCallback(() => {
		draggingRef.current = false;
	}, []);

	useEffect(() => {
		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [handleMouseMove, handleMouseUp]);

	useEffect(() => {
		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
		};
	}, []);

	const activeFolder = getActiveFolder();
	const presetColors = activeFolder?.colors.slice(0, system.slotCount) || [];

	const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const hex = e.target.value.toUpperCase();
		setCurrentColor(hex);

		if (timerRef.current) {
			clearTimeout(timerRef.current);
		}
		timerRef.current = setTimeout(() => {
			if (lastInsertColorRef.current !== hex) {
				insertAtCursor(hex);
				lastInsertColorRef.current = hex;
			}
			timerRef.current = null;
		}, 300);
	};

	const handleHexKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			insertAtCursor(currentColor);
			lastInsertColorRef.current = currentColor;
		}
	};

	const handlePresetContextMenu = (e: React.MouseEvent, index: number) => {
		e.preventDefault();
		if (!activeFolder) return;
		saveColorToSlot(activeFolder.id, index, currentColor);
	};

	const handlePresetClick = (color: string) => {
		if (color) {
			setCurrentColor(color);
			insertAtCursor(color);
			lastInsertColorRef.current = color;
		}
	};

	return (
		<div
			style={{
				position: "fixed",
				left: position.x,
				top: position.y,
				zIndex: 9999,
			}}
		>
			{/* 主工具栏 */}
			<div
				style={{
					background: "#2c2c2c",
					padding: "12px",
					borderRadius: "12px",
					boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
					display: "flex",
					flexDirection: isVertical ? "column" : "row",
					gap: "12px",
					alignItems: isVertical ? "stretch" : "center",
					cursor: draggingRef.current ? "grabbing" : "grab",
					userSelect: "none",
					border: "1px solid #444",
				}}
				onMouseDown={handleMouseDown}
			>
				{/* 标题 */}
				<span
					style={{
						color: "#fff",
						fontSize: "14px",
						fontWeight: "bold",
						writingMode: isVertical ? "vertical-rl" : "horizontal-tb",
						letterSpacing: isVertical ? "2px" : "normal",
						alignSelf: "center",
					}}
				>
					{t("colorToolbar.title")}
				</span>

				{/* 包裹按钮 */}
				<button
					style={{
						padding: "6px 12px",
						fontSize: "18px",
						cursor: "pointer",
						borderRadius: "6px",
						border: "none",
						background: "#E45353",
						color: "#fff",
						fontWeight: "bold",
					}}
					title={t("colorToolbar.wrapButtonTitle")}
					onClick={() => wrapSelection("{", "}")}
					onMouseDown={(e) => e.stopPropagation()}
				>
					{"{ }"}
				</button>

				{/* 分割线 */}
				<div
					style={{
						background: "#555",
						width: isVertical ? "24px" : "2px",
						height: isVertical ? "2px" : "24px",
					}}
				/>

				{/* 单括号按钮组 */}
				<div
					style={{
						display: "flex",
						gap: "8px",
						flexDirection: isVertical ? "row" : "row",
					}}
				>
					<button
						style={{
							padding: "6px 10px",
							fontSize: "16px",
							cursor: "pointer",
							borderRadius: "6px",
							border: "none",
							background: "#444",
							color: "#fff",
						}}
						onClick={() => insertAtCursor("{")}
						onMouseDown={(e) => e.stopPropagation()}
					>
						{"{"}
					</button>
					<button
						style={{
							padding: "6px 10px",
							fontSize: "16px",
							cursor: "pointer",
							borderRadius: "6px",
							border: "none",
							background: "#444",
							color: "#fff",
						}}
						onClick={() => insertAtCursor("}")}
						onMouseDown={(e) => e.stopPropagation()}
					>
						{"}"}
					</button>
				</div>

				<div
					style={{
						background: "#555",
						width: isVertical ? "24px" : "2px",
						height: isVertical ? "2px" : "24px",
					}}
				/>

				{/* 颜色拾取器 + HEX 输入框 */}
				<div
					style={{
						display: "flex",
						flexDirection: isVertical ? "column" : "row",
						alignItems: "center",
						gap: "8px",
					}}
				>
					<input
						type="color"
						value={currentColor}
						title={t("colorToolbar.colorPickerTitle")}
						style={{
							cursor: "pointer",
							width: "32px",
							height: "32px",
							border: "none",
							background: "transparent",
							padding: 0,
						}}
						onChange={handleColorChange}
						onMouseDown={(e) => e.stopPropagation()}
					/>
					<input
						type="text"
						value={currentColor}
						title={t("colorToolbar.hexInputTitle")}
						onChange={(e) => setCurrentColor(e.target.value.toUpperCase())}
						onKeyDown={handleHexKeyDown}
						onMouseDown={(e) => e.stopPropagation()}
						style={{
							width: "70px",
							background: "#1e1e1e",
							color: "#fff",
							border: "1px solid #555",
							borderRadius: "6px",
							padding: "6px",
							fontSize: "13px",
							fontFamily: "monospace",
							outline: "none",
							textAlign: "center",
						}}
					/>
				</div>

				<div
					style={{
						background: "#555",
						width: isVertical ? "24px" : "2px",
						height: isVertical ? "2px" : "24px",
					}}
				/>

				{/* 主面板预设槽位 */}
				<div
					style={{
						display: "flex",
						flexDirection: isVertical ? "column" : "row",
						alignItems: "center",
						gap: "6px",
					}}
				>
					{presetColors.map((presetHex, idx) => {
						const buttonTitle = presetHex
							? t("colorToolbar.presetSlot.occupiedTitle", {
									color: presetHex,
									currentColor,
								})
							: t("colorToolbar.presetSlot.emptyTitle", { currentColor });
						return (
							<button
								key={presetHex || `empty-${idx}`}
								title={buttonTitle}
								onClick={() => handlePresetClick(presetHex)}
								onContextMenu={(e) => handlePresetContextMenu(e, idx)}
								onMouseDown={(e) => e.stopPropagation()}
								style={{
									width: "24px",
									height: "24px",
									borderRadius: "50%",
									background: presetHex || "#222",
									cursor: "pointer",
									border: `2px solid ${presetHex ? "rgba(255,255,255,0.2)" : "#444"}`,
									padding: 0,
									boxShadow: presetHex
										? "0 2px 5px rgba(0,0,0,0.4)"
										: "inset 0 2px 5px rgba(0,0,0,0.8)",
									transition: "all 0.15s ease",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								{!presetHex && (
									<span
										style={{
											color: "#555",
											fontSize: "14px",
											lineHeight: "20px",
										}}
									>
										+
									</span>
								)}
							</button>
						);
					})}
				</div>

				<div
					style={{
						background: "#555",
						width: isVertical ? "24px" : "2px",
						height: isVertical ? "2px" : "24px",
					}}
				/>

				{/* 展开资产库的开关 */}
				<button
					title={t("colorToolbar.libraryButtonTitle")}
					onClick={() => setShowLibrary(!showLibrary)}
					onMouseDown={(e) => e.stopPropagation()}
					style={{
						background: showLibrary ? "#4CAF50" : "transparent",
						color: "#fff",
						border: "none",
						fontSize: "20px",
						cursor: "pointer",
						padding: "4px",
						borderRadius: "6px",
						transition: "background 0.2s",
						transform: isVertical ? "rotate(-90deg)" : "none",
					}}
				>
					{showLibrary ? "🔽" : "⚙️"}
				</button>
			</div>

			{/* 资产库面板 */}
			{showLibrary && (
				<div
					style={{
						position: "absolute",
						left: 0,
						...(menuPlacement === "bottom"
							? { top: "100%", marginTop: "8px" }
							: { bottom: "100%", marginBottom: "8px" }),
					}}
					onMouseDown={(e) => e.stopPropagation()}
				>
					<ColorLibrary onClose={() => setShowLibrary(false)} />
				</div>
			)}
		</div>
	);
};
