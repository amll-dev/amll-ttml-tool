import { atomWithStorage } from "jotai/utils";

export interface ColorFolder {
	id: string;
	name: string;
	colors: string[]; // 固定长度 100，空字符串表示空槽
}

export interface ColorSystemData {
	slotCount: number; // 主面板显示的颜色槽数量 (3-20)
	activeFolderId: string; // 当前激活的文件夹 ID
	orientation: "horizontal" | "vertical"; // 布局方向
	folders: ColorFolder[];
}

// 默认数据：一个默认文件夹，前5个槽位有初始颜色
const defaultFolders: ColorFolder[] = [
	{
		id: "default",
		name: "默认调色板",
		colors: (() => {
			const arr = Array(100).fill("");
			arr[0] = "#FFDD88";
			arr[1] = "#77BBDD";
			arr[2] = "#FF8899";
			arr[3] = "#779977";
			arr[4] = "#7777AA";
			return arr;
		})(),
	},
];

const defaultSystem: ColorSystemData = {
	slotCount: 5,
	activeFolderId: "default",
	orientation: "horizontal",
	folders: defaultFolders,
};

export const colorSystemAtom = atomWithStorage<ColorSystemData>(
	"amll_color_assets",
	defaultSystem,
);
