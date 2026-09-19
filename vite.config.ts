import { exec } from "node:child_process";
import { resolve } from "node:path";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import jotaiDebugLabel from "jotai-babel/plugin-debug-label";
import jotaiReactRefresh from "jotai-babel/plugin-react-refresh";
import { defineConfig, type PluginOption } from "vite";
import i18nextLoader from "vite-plugin-i18next-loader";
import { VitePWA } from "vite-plugin-pwa";

const isProduction = process.env.NODE_ENV === "production";

const plugins: PluginOption = [
	react(),
	babel({
		presets: [reactCompilerPreset()],
		plugins: isProduction ? [] : [jotaiDebugLabel, jotaiReactRefresh],
	}),
	i18nextLoader({
		paths: ["./locales"],
		namespaceResolution: "basename",
	}),
	{
		name: "buildmeta",
		async resolveId(id) {
			if (id === "virtual:buildmeta") {
				return id;
			}
		},
		async load(id) {
			if (id === "virtual:buildmeta") {
				let gitCommit = "unknown";

				try {
					gitCommit = await new Promise<string>((resolve, reject) =>
						exec("git rev-parse HEAD", (err, stdout) => {
							if (err) {
								reject(err);
							} else {
								resolve(stdout.trim());
							}
						}),
					);
				} catch {}

				return `
					export const BUILD_TIME = "${new Date().toISOString()}";
					export const GIT_COMMIT = "${gitCommit}";
				`;
			}
		},
	},
	VitePWA({
		injectRegister: null,
		disable: !!process.env.TAURI_PLATFORM,
		workbox: {
			globPatterns: ["**/*.{js,css,html,wasm}"],
			maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
		},
		manifest: {
			name: "Apple Music-like lyrics TTML Tool",
			id: "amll-ttml-tool",
			short_name: "AMLL TTML Tool",
			display: "standalone",
			description: "一个用于 Apple Music 的逐词歌词 TTML 编辑和时间轴工具",
			theme_color: "#18a058",
			icons: [
				{
					src: "./icons/Square30x30Logo.png",
					sizes: "30x30",
					type: "image/png",
				},
				{
					src: "./icons/Square44x44Logo.png",
					sizes: "44x44",
					type: "image/png",
				},
				{
					src: "./icons/Square71x71Logo.png",
					sizes: "71x71",
					type: "image/png",
				},
				{
					src: "./icons/Square89x89Logo.png",
					sizes: "89x89",
					type: "image/png",
				},
				{
					src: "./icons/Square107x107Logo.png",
					sizes: "107x107",
					type: "image/png",
				},
				{
					src: "./logo.png",
					sizes: "1024x1024",
					type: "image/png",
				},
				{
					src: "./logo.svg",
					sizes: "128x128",
					type: "image/svg",
				},
			],
		},
	}),
];

// https://vitejs.dev/config/
export default defineConfig({
	plugins,
	base: process.env.TAURI_ENV_PLATFORM ? "/" : "./",
	clearScreen: false,
	server: {
		headers: {
			"Cross-Origin-Embedder-Policy": "require-corp",
			"Cross-Origin-Opener-Policy": "same-origin",
		},
		strictPort: true,
		watch: {
			// Tauri 的 Rust 构建产物会被 cargo 锁定，Vite 监听它们会导致
			// Windows 上抛出 EBUSY: resource busy or locked 而崩溃
			ignored: ["**/src-tauri/**"],
		},
	},
	envPrefix: ["VITE_", "TAURI_", "AMLL_", "SENTRY_"],
	build: {
		// produce sourcemaps
		sourcemap: true,

		rolldownOptions: {
			// Suppress `Module "node:module" has been externalized for browser compatibility`
			onLog(level, log, defaultHandler) {
				if (log.message?.includes("node:module")) return;
				defaultHandler(level, log);
			},

			output: {
				codeSplitting: {
					groups: [
						{
							name: "react-vendor",
							test: /node_modules[\\/](react|react-dom)[\\/]/,
							priority: 20,
						},
						{
							name: "radix-vendor",
							test: /node_modules[\\/]@radix/,
							priority: 15,
						},
						{
							name: "amll-vendor",
							test: /node_modules[\\/]@applemusic-like-lyrics/,
							priority: 10,
						},
						{
							name: "vendor",
							test(id) {
								// 排除掉 hyphen 以便动态导入能够工作
								return id.includes("node_modules") && !id.includes("hyphen");
							},
							priority: 10,
						},
					],
				},
			},
		},
	},
	resolve: {
		alias: {
			$: resolve(__dirname, "src"),
		},
	},
	worker: {
		format: "es",
	},
});
