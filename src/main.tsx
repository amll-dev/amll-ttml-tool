/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/amll-dev/amll-ttml-tool/blob/main/LICENSE
 */

import * as Sentry from "@sentry/react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { enableMapSet } from "immer";
import { Provider } from "jotai";
// import { DevTools } from "jotai-devtools";
// import "jotai-devtools/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "react-toastify/dist/ReactToastify.css";
import App from "./App.tsx";
import "./i18n/index.ts";
import "./index.css";
import "./utils/pwa.tsx";
import { globalStore } from "./states/store.ts";

async function startApp() {
	enableMapSet();

	Sentry.init({
		dsn: import.meta.env.SENTRY_DSN,
		integrations: [],
	});

	const rootEl = document.getElementById("root");

	if (!rootEl) {
		throw new Error("Could not find root element");
	}

	createRoot(rootEl).render(
		<StrictMode>
			<SpeedInsights />
			<Analytics />
			<Provider store={globalStore}>
				<App />
				{/* <DevTools position="bottom-right" /> */}
			</Provider>
		</StrictMode>,
	);
}

startApp();
