import { ErrorCircle16Regular, Info16Regular } from "@fluentui/react-icons";
import {
	Box,
	Button,
	Callout,
	Checkbox,
	Dialog,
	Flex,
	RadioGroup,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import type { TFunction } from "i18next";
import { atom, useAtom, useAtomValue, useStore } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { memo, useCallback, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import {
	generateNameFromMetadataAtom,
	hideSubmitAMLLDBWarningAtom,
} from "$/modules/settings/states";
import { submitToAMLLDBDialogAtom } from "$/states/dialogs.ts";
import { lyricLinesAtom } from "$/states/main";
import type { TTMLMetadata } from "$/types/ttml";

enum UploadDBType {
	Official = "official",
	User = "user",
	Both = "both",
}

const uploadDbTypeAtom = atomWithStorage("uploadDbType", UploadDBType.Official);
const metadataAtom = atom((get) => get(lyricLinesAtom).metadata);
const issuesAtom = atom((get) => {
	const result: string[] = [];
	const metadatas = get(metadataAtom);

	if (
		metadatas.findIndex((m) => m.key === "musicName" && m.value.length > 0) ===
		-1
	)
		result.push("元数据缺少音乐名称");

	if (
		metadatas.findIndex((m) => m.key === "artists" && m.value.length > 0) === -1
	)
		result.push("元数据缺少音乐作者");

	if (
		metadatas.findIndex((m) => m.key === "album" && m.value.length > 0) === -1
	)
		result.push("元数据缺少音乐专辑名称");

	const platforms = new Set([
		"ncmMusicId",
		"qqMusicId",
		"spotifyId",
		"appleMusicId",
	]);

	if (
		metadatas.findIndex((m) => platforms.has(m.key) && m.value.length > 0) ===
		-1
	)
		result.push("元数据缺少音乐平台对应歌曲 ID");

	return result;
});

const validateMetadata = (
	metadatas: TTMLMetadata[],
	t: TFunction,
): string[] => {
	const result: string[] = [];
	const musicName = metadatas.find((m) => m.key === "musicName");
	if (!musicName?.value?.length) {
		result.push(
			t("submitToAMLLDB.validation.missingMusicName", "元数据缺少音乐名称"),
		);
	}

	const artists = metadatas.find((m) => m.key === "artists");
	if (!artists?.value?.length) {
		result.push(
			t("submitToAMLLDB.validation.missingArtists", "元数据缺少音乐作者"),
		);
	}

	const album = metadatas.find((m) => m.key === "album");
	if (!album?.value?.length) {
		result.push(
			t("submitToAMLLDB.validation.missingAlbum", "元数据缺少音乐专辑名称"),
		);
	}

	const musicIds = [
		metadatas.find((m) => m.key === "ncmMusicId"),
		metadatas.find((m) => m.key === "qqMusicId"),
		metadatas.find((m) => m.key === "spotifyId"),
		metadatas.find((m) => m.key === "appleMusicId"),
		metadatas.find((m) => m.key === "isrc"),
	];

	if (!musicIds.some((id) => id?.value?.length)) {
		result.push(
			t(
				"submitToAMLLDB.validation.missingMusicId",
				"元数据缺少音乐平台对应歌曲 ID",
			),
		);
	}

	return result;
};

export const SubmitToAMLLDBDialog = memo(() => {
	const { t } = useTranslation();
	const [uploadDbType, setUploadDbType] = useAtom(uploadDbTypeAtom);
	const [dialogOpen, setDialogOpen] = useAtom(submitToAMLLDBDialogAtom);
	const [hideWarning, setHideWarning] = useAtom(hideSubmitAMLLDBWarningAtom);
	const [genNameFromMetadata, setGenNameFromMetadata] = useAtom(
		generateNameFromMetadataAtom,
	);
	const metadatas = useAtomValue(metadataAtom);
	const issues = useAtomValue(issuesAtom);
	const [name, setName] = useState("");
	const [comment, setComment] = useState("");
	const [processing, setProcessing] = useState(false);
	const [submitReason, setSubmitReason] = useState(
		t("submitToAMLLDB.defaultReason", "新歌词提交"),
	);
	const store = useStore();

	const onSubmit = useCallback(async () => {
		if (processing) return;
		setProcessing(true);
		try {
			const errors = validateMetadata(metadatas, t);
			if (errors.length > 0) {
				toast.error(
					t("submitToAMLLDB.errors.validation", "提交验证失败：\n{errors}", {
						errors: errors.join("\n"),
					}),
				);
				return;
			}

			if (store.get(lyricLinesAtom).lyricLines.length === 0) {
				toast.error(
					t("submitToAMLLDB.errors.noLyrics", "歌词还什么都没有呢？"),
				);
				return;
			}

			const ttmlText = exportTTMLText(store.get(lyricLinesAtom));
			const ttmlBlob = new Blob([ttmlText], { type: "text/xml" });

			const formData = new FormData();
			formData.append("file", ttmlBlob, "lyrics.ttml");

			const uploadResp = await fetch(
				"https://amll-ttml-db.stevexmh.com/api/upload",
				{
					method: "POST",
					body: formData,
				},
			);

			if (!uploadResp.ok) {
				throw new Error(
					t(
						"submitToAMLLDB.errors.uploadFailed",
						"发送上传歌词文件请求失败：{status} {statusText}",
						{
							status: uploadResp.status,
							statusText: uploadResp.statusText,
						},
					),
				);
			}

			const uploadResult = await uploadResp.json();

			const issueUrl = new URL(
				"https://github.com/Steve-xmh/amll-ttml-lyrics/issues/new",
			);

			issueUrl.searchParams.append(
				"labels",
				t("submitToAMLLDB.labels.submit", "歌词提交/补正"),
			);
			issueUrl.searchParams.append(
				"title",
				t("submitToAMLLDB.issueTitle", "[歌词提交/修正] {name}", { name }),
			);
			issueUrl.searchParams.append(
				"body",
				`${submitReason}

${comment}

<!-- AMLL TTML DB File ID: ${uploadResult.id} -->`,
			);

			open(issueUrl.toString());
			setDialogOpen(false);
		} catch (err) {
			console.error(err);
			toast.error(
				t(
					"submitToAMLLDB.errors.submitFailed",
					"提交发生错误，请查看控制台确认原因！",
				),
			);
		}
		setProcessing(false);
	}, [
		store,
		name,
		submitReason,
		comment,
		setDialogOpen,
		t,
		metadatas,
		processing,
	]);

	useLayoutEffect(() => {
		if (genNameFromMetadata) {
			const name =
				metadatas.find((m) => m.key === "musicName")?.value?.join(", ") ??
				t("submitToAMLLDB.unknownTitle", "未知曲名");
			const artists =
				metadatas.find((m) => m.key === "artists")?.value?.join(", ") ??
				t("submitToAMLLDB.unknownArtist", "未知歌手");
			setName(`${artists} - ${name}`);
		}
	}, [genNameFromMetadata, metadatas, t]);

	return (
		<Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
			<Dialog.Content
				aria-description={t(
					"submitToAMLLDB.description",
					"提交歌词到 AMLL 歌词数据库",
				)}
			>
				<Dialog.Title>
					{t(
						"submitToAMLLDB.title",
						"提交歌词到 AMLL 歌词数据库（仅简体中文用户）",
					)}
				</Dialog.Title>
				<Flex direction="column" gap="4">
					{!hideWarning && (
						<>
							<Callout.Root color="orange">
								<Callout.Icon>
									<ErrorCircle16Regular />
								</Callout.Icon>
								<Callout.Text>
									{t(
										"submitToAMLLDB.chineseOnlyWarning",
										"本功能仅使用 AMLL 歌词数据库的简体中文用户可用，如果您是为了在其他软件上使用歌词而编辑歌词的话，请参考对应的软件提交歌词的方式来提交歌词哦！",
									)}
								</Callout.Text>
							</Callout.Root>
							<Callout.Root color="blue">
								<Callout.Icon>
									<Info16Regular />
								</Callout.Icon>
								<Callout.Text>
									<p>
										{t(
											"submitToAMLLDB.thankYou",
											"首先，感谢您的慷慨歌词贡献！",
										)}
										<br />
										{t("submitToAMLLDB.cc0Agreement", "通过提交，你将默认同意")}{" "}
										<Text weight="bold" color="orange">
											{t(
												"submitToAMLLDB.cc0Rights",
												"使用 CC0 共享协议完全放弃歌词所有权",
											)}
										</Text>
										{t("submitToAMLLDB.andSubmit", "并提交到歌词数据库！")}
										<br />
										{t(
											"submitToAMLLDB.futureUse",
											"并且歌词将会在以后被 AMLL 系程序作为默认 TTML 歌词源获取！",
										)}
										<br />
										{t(
											"submitToAMLLDB.rightsWarning",
											"如果您对歌词所有权比较看重的话，请勿提交歌词哦！",
										)}
										<br />
										{t(
											"submitToAMLLDB.submitInstructions",
											"请输入以下提交信息然后跳转到 Github 议题提交页面！",
										)}
									</p>
								</Callout.Text>
							</Callout.Root>
							<Button
								variant="soft"
								size="1"
								onClick={() => setHideWarning(true)}
							>
								{t("submitToAMLLDB.closeWarning", "关闭上述警告信息")}
							</Button>
						</>
					)}
					<Flex justify="between" gap="4" align="center">
						<Box flexShrink="0">
							<Text as="label" size="2">
								<Flex direction="column" gap="2">
									歌词库类型
									<RadioGroup.Root
										value={uploadDbType}
										onValueChange={(v) => setUploadDbType(v as UploadDBType)}
									>
										<RadioGroup.Item value={UploadDBType.Official}>
											官方歌词库
										</RadioGroup.Item>
										<RadioGroup.Item value={UploadDBType.User}>
											用户歌词库
										</RadioGroup.Item>
										<RadioGroup.Item value={UploadDBType.Both}>
											全部歌词库
										</RadioGroup.Item>
									</RadioGroup.Root>
								</Flex>
							</Text>
						</Box>

						<Flex direction="column">
							{uploadDbType === UploadDBType.Official && (
								<Callout.Root color="grass">
									<Callout.Text size="1">
										提交到官方歌词库，需要进行人工审核，确保歌词满足基本要求以及时间轴和效果后方可加入词库。
										<br />
										此举可以把关你的歌词质量，让你的歌词能以足够好的演出效果呈现，推荐提交到此处。
									</Callout.Text>
								</Callout.Root>
							)}
							{uploadDbType === UploadDBType.User && (
								<Callout.Root color="orange">
									<Callout.Text size="1">
										提交到用户歌词库，仅需通过机器人审核没有严重问题后即可加入词库，无需人工审核。
										<br />
										但是如果出现歌词内容以及呈现效果的问题则只能通过重新提交覆盖，无法进行人工核对保证质量。
									</Callout.Text>
								</Callout.Root>
							)}
							{uploadDbType === UploadDBType.Both && (
								<Callout.Root color="orange">
									<Callout.Text size="1">
										两个都要也不坏，知晓情况即可
										<br />
										上传后将会分别打开每个仓库对应的提交页面，请手动分别按下创建议题即可提交。
									</Callout.Text>
								</Callout.Root>
							)}
						</Flex>
					</Flex>

					<Text as="label" size="2">
						<Flex gap="2">
							<Checkbox
								checked={genNameFromMetadata}
								onCheckedChange={(v) => setGenNameFromMetadata(!!v)}
							/>
							从元数据中生成
						</Flex>
					</Text>
					<Text as="label" size="2">
						<Flex direction="column" gap="2">
							音乐名称
							<TextField.Root
								value={name}
								disabled={genNameFromMetadata}
								onChange={(e) => setName(e.currentTarget.value)}
							/>
							推荐使用 歌手 - 歌曲 格式，方便仓库管理员确认你的歌曲是否存在
						</Flex>
					</Text>
					<Text as="label" size="2">
						<Flex direction="column" gap="2">
							提交缘由
							<RadioGroup.Root
								value={submitReason}
								onValueChange={setSubmitReason}
							>
								<RadioGroup.Item value="新歌词提交">新歌词提交</RadioGroup.Item>
								<RadioGroup.Item value="修正已有歌词">
									修正已有歌词
								</RadioGroup.Item>
							</RadioGroup.Root>
						</Flex>
					</Text>
					<Text as="label" size="2">
						<Flex direction="column" gap="2">
							备注
							<TextArea
								resize="vertical"
								placeholder="有什么需要补充说明的呢？"
								value={comment}
								onChange={(e) => setComment(e.currentTarget.value)}
							/>
						</Flex>
					</Text>
					{issues.length > 0 && (
						<Callout.Root color="red">
							<Callout.Icon>
								<ErrorCircle16Regular />
							</Callout.Icon>
							<Callout.Text>
								发现以下问题，请修正后再提交：
								<ul>
									{issues.map((issue) => (
										<li key={issue}>{issue}</li>
									))}
								</ul>
							</Callout.Text>
						</Callout.Root>
					)}
					<Button
						loading={processing}
						disabled={issues.length > 0}
						onClick={onSubmit}
					>
						上传歌词并创建议题
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
});
