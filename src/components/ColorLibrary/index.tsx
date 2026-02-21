import type React from "react";
import { useTranslation } from "react-i18next";
import { useColorAssets } from "../../hooks/useColorAssets";
import { useCursorInjection } from "../../hooks/useCursorInjection";

interface ColorLibraryProps {
	// biome-ignore lint/correctness/noUnusedFunctionParameters: <可能将来用于关闭面板>
	onClose?: () => void;
}

export const ColorLibrary: React.FC<ColorLibraryProps> = ({ onClose }) => {
	const { t } = useTranslation();
	const {
		system,
		saveColorToSlot,
		addFolder,
		deleteFolder,
		renameFolder,
		setSlotCount,
		setOrientation,
		setActiveFolder,
		getActiveFolder,
	} = useColorAssets();
	const { insertAtCursor } = useCursorInjection();

	const activeFolder = getActiveFolder();

	const handleFolderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setActiveFolder(e.target.value);
	};

	const handleAddFolder = () => {
		const name = prompt("新文件夹名称");
		if (name) addFolder(name);
	};

	const handleRenameFolder = () => {
		if (!activeFolder) return;
		const name = prompt("重命名文件夹", activeFolder.name);
		if (name) renameFolder(activeFolder.id, name);
	};

	const handleDeleteFolder = () => {
		if (!activeFolder || system.folders.length <= 1) return;
		if (confirm(`确定删除文件夹 "${activeFolder.name}" 吗？`)) {
			deleteFolder(activeFolder.id);
		}
	};

	const handleSlotClick = (colorHex: string) => {
		if (colorHex) {
			insertAtCursor(colorHex);
		}
	};

	const handleSlotContextMenu = (e: React.MouseEvent, slotIndex: number) => {
		e.preventDefault();
		if (!activeFolder) return;
		const color = prompt("输入颜色代码（如 #FF0000）", "#FF0000");
		if (color) {
			saveColorToSlot(activeFolder.id, slotIndex, color.toUpperCase());
		}
	};

	return (
		<div
			style={{
				background: "#222",
				borderRadius: "12px",
				padding: "16px",
				boxShadow: "0 10px 40px rgba(0,0,0,0.8)",
				width: "420px",
				border: "1px solid #444",
				display: "flex",
				flexDirection: "column",
				gap: "12px",
				color: "#fff",
				fontSize: "13px",
			}}
		>
			{/* 头部：文件夹管理 */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
				}}
			>
				<span style={{ color: "#aaa", fontWeight: "bold" }}>
					{t("colorLibrary.header")}
				</span>
				<div style={{ display: "flex", gap: "6px" }}>
					<button onClick={handleRenameFolder} style={buttonStyle}>
						{t("colorLibrary.renameButton")}
					</button>
					<button
						onClick={handleDeleteFolder}
						style={{ ...buttonStyle, background: "#633" }}
					>
						{t("colorLibrary.deleteButton")}
					</button>
					<button
						onClick={handleAddFolder}
						style={{ ...buttonStyle, background: "#364" }}
					>
						{t("colorLibrary.addButton")}
					</button>
				</div>
			</div>

			{/* 文件夹选择器 */}
			<select
				value={system.activeFolderId}
				onChange={handleFolderChange}
				style={{
					width: "100%",
					padding: "8px",
					background: "#111",
					color: "#fff",
					border: "1px solid #555",
					borderRadius: "6px",
					outline: "none",
				}}
			>
				{system.folders.map((f) => (
					<option key={f.id} value={f.id}>
						{f.name} ({f.colors.filter((c) => c).length} 种颜色)
					</option>
				))}
			</select>

			{/* 设置区 */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "8px",
					background: "#1a1a1a",
					padding: "10px 12px",
					borderRadius: "6px",
				}}
			>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<span>{t("colorLibrary.slotCountLabel")}</span>
					<input
						type="number"
						min={3}
						max={20}
						value={system.slotCount}
						onChange={(e) => setSlotCount(parseInt(e.target.value, 10) || 5)}
						style={{
							width: "50px",
							background: "#333",
							color: "#fff",
							border: "1px solid #555",
							borderRadius: "4px",
							padding: "4px",
							textAlign: "center",
						}}
					/>
				</div>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<span>{t("colorLibrary.orientationLabel")}</span>
					<select
						value={system.orientation}
						onChange={(e) =>
							setOrientation(e.target.value as "horizontal" | "vertical")
						}
						style={{
							background: "#333",
							color: "#fff",
							border: "1px solid #555",
							borderRadius: "4px",
							padding: "4px",
							outline: "none",
						}}
					>
						<option value="horizontal">
							{t("colorLibrary.orientationHorizontal")}
						</option>
						<option value="vertical">
							{t("colorLibrary.orientationVertical")}
						</option>
					</select>
				</div>
			</div>

			<div style={{ height: "1px", background: "#444" }} />
			<span style={{ color: "#888", textAlign: "center" }}>
				{t("colorLibrary.hint")}
			</span>

			{/* 100个格子的颜色矩阵 */}
			{activeFolder && (
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(10, 1fr)",
						gap: "6px",
						maxHeight: "220px",
						overflowY: "auto",
						paddingRight: "4px",
					}}
				>
					{activeFolder.colors.map((hex, idx) => {
						const isMainBarSlot = idx < system.slotCount;
						// 使用颜色值+索引作为key，因为颜色可能重复，加上索引确保唯一
						const uniqueKey = `${hex}-${idx}`;
						return (
							<div
								key={uniqueKey}
								onClick={() => handleSlotClick(hex)}
								onContextMenu={(e) => handleSlotContextMenu(e, idx)}
								title={`格子 ${idx + 1}${isMainBarSlot ? " (显示在主面板)" : ""}\n${hex ? "左键插入 | 右键覆盖" : "右键存入当前颜色"}`}
								style={{
									width: "28px",
									height: "28px",
									borderRadius: "4px",
									background: hex || "#111",
									cursor: "pointer",
									border: `1px solid ${isMainBarSlot ? "#666" : "#333"}`,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									boxShadow: hex
										? "0 2px 4px rgba(0,0,0,0.5)"
										: "inset 0 2px 4px rgba(0,0,0,0.5)",
									position: "relative",
									transition: "all 0.1s",
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.transform = "scale(1.1)";
									e.currentTarget.style.border = "1px solid #fff";
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.transform = "scale(1)";
									e.currentTarget.style.border = `1px solid ${isMainBarSlot ? "#666" : "#333"}`;
								}}
							>
								{!hex && (
									<span style={{ color: "#444", fontSize: "14px" }}>+</span>
								)}
								{isMainBarSlot && (
									<div
										style={{
											position: "absolute",
											bottom: -2,
											right: -2,
											width: 6,
											height: 6,
											background: "#4CAF50",
											borderRadius: "50%",
										}}
									/>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
};

const buttonStyle: React.CSSProperties = {
	background: "#333",
	color: "#fff",
	border: "none",
	borderRadius: "4px",
	padding: "4px 8px",
	cursor: "pointer",
	fontSize: "12px",
};
