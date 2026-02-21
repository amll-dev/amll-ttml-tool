import { useAtom } from "jotai";
import { type ColorFolder, colorSystemAtom } from "../states/colorSystem";

export const useColorAssets = () => {
	const [system, setSystem] = useAtom(colorSystemAtom);

	// 保存颜色到指定文件夹的指定槽位
	const saveColorToSlot = (
		folderId: string,
		slotIndex: number,
		colorHex: string,
	) => {
		setSystem((prev) => {
			const folder = prev.folders.find((f) => f.id === folderId);
			if (!folder) return prev;

			const newColors = [...folder.colors];
			newColors[slotIndex] = colorHex;

			const newFolders = prev.folders.map((f) =>
				f.id === folderId ? { ...f, colors: newColors } : f,
			);

			return { ...prev, folders: newFolders };
		});
	};

	// 添加新文件夹
	const addFolder = (name: string) => {
		const newId = Date.now().toString();
		setSystem((prev) => ({
			...prev,
			activeFolderId: newId,
			folders: [
				...prev.folders,
				{ id: newId, name, colors: Array(100).fill("") },
			],
		}));
	};

	// 删除文件夹（至少保留一个）
	const deleteFolder = (id: string) => {
		if (system.folders.length <= 1) return;
		setSystem((prev) => {
			const newFolders = prev.folders.filter((f) => f.id !== id);
			const newActiveId =
				prev.activeFolderId === id ? newFolders[0].id : prev.activeFolderId;
			return { ...prev, activeFolderId: newActiveId, folders: newFolders };
		});
	};

	// 重命名文件夹
	const renameFolder = (id: string, newName: string) => {
		setSystem((prev) => ({
			...prev,
			folders: prev.folders.map((f) =>
				f.id === id ? { ...f, name: newName } : f,
			),
		}));
	};

	// 更新主面板显示的数量
	const setSlotCount = (count: number) => {
		setSystem((prev) => ({
			...prev,
			slotCount: Math.max(3, Math.min(20, count)),
		}));
	};

	// 更新布局方向
	const setOrientation = (orientation: "horizontal" | "vertical") => {
		setSystem((prev) => ({ ...prev, orientation }));
	};

	// 切换当前激活的文件夹
	const setActiveFolder = (folderId: string) => {
		setSystem((prev) => ({ ...prev, activeFolderId: folderId }));
	};

	// 获取当前激活的文件夹
	const getActiveFolder = (): ColorFolder | undefined => {
		return system.folders.find((f) => f.id === system.activeFolderId);
	};

	return {
		system,
		saveColorToSlot,
		addFolder,
		deleteFolder,
		renameFolder,
		setSlotCount,
		setOrientation,
		setActiveFolder,
		getActiveFolder,
	};
};
