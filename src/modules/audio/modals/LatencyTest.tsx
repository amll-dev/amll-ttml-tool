import { Button, Dialog, Flex, Text, TextField } from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyBinding } from "$/components/KeyBinding";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	latencyTestBPMAtom,
	SyncJudgeMode,
	syncJudgeModeAtom,
} from "$/modules/settings/states";
import { latencyTestDialogAtom } from "$/states/dialogs.ts";
import { keySyncNextAtom } from "$/states/keybindings";
import { useKeyBindingAtom } from "$/utils/keybindings";

const BeepVisualizer = ({ enable }: { enable: boolean }) => {
	return (
		<div
			style={{
				width: "2em",
				height: "2em",
				borderRadius: "50%",
				boxShadow: "var(--shadow-2)",
				backgroundColor: enable ? "var(--accent-11)" : "var(--accent-a5)",
			}}
		/>
	);
};

export const LatencyTestDialog = memo(() => {
	const [dialogOpen, setDialogOpen] = useAtom(latencyTestDialogAtom);
	const [latencyBPM, setLatencyBPM] = useAtom(latencyTestBPMAtom);
	const [start, setStart] = useState(false);
	const [curBeat, setCurBeat] = useState(-1);
	const [hitOffset, setHitOffset] = useState<{
		cur: number;
		min: number;
		max: number;
	} | null>(null);
	const syncJudgeMode = useAtomValue(syncJudgeModeAtom);
	const nextBeatTime = useRef(0);
	const curBeatTime = useRef(0);
	const hitOffsetsRef = useRef<number[]>([]);
	const visualizerRef = useRef<HTMLCanvasElement>(null);
	const beepDuration = 1000 / (latencyBPM / 60);
	const { t } = useTranslation();

	useEffect(() => {
		if (!start || !dialogOpen) {
			setCurBeat(-1);
			return;
		}
		setHitOffset(null);
		let canceled = false;

		const canvas = visualizerRef.current;
		if (!canvas) return;
		canvas.width = canvas.clientWidth * window.devicePixelRatio;
		canvas.height = canvas.clientHeight * window.devicePixelRatio;
		const mid = (canvas.width - 2 * window.devicePixelRatio) / 2;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		hitOffsetsRef.current = [];

		(async () => {
			const beep1 = () => {
				const node = audioEngine.ctx.createOscillator();
				node.type = "sine";
				node.frequency.value = 880;
				return node;
			};
			const beep2 = () => {
				const node = audioEngine.ctx.createOscillator();
				node.type = "sine";
				node.frequency.value = 440;
				return node;
			};

			let beat = 0;
			const dur = beepDuration / 1000;
			const nodeDur = 0.05;

			curBeatTime.current = audioEngine.ctxCurrentTime;
			nextBeatTime.current = curBeatTime.current;
			audioEngine.playNode(
				beep1(),
				curBeatTime.current,
				curBeatTime.current + nodeDur,
			);
			setCurBeat(0);

			let curNode: AudioScheduledSourceNode | null = null;

			while (!canceled) {
				const currentTime = audioEngine.ctxCurrentTime;
				if (currentTime >= nextBeatTime.current) {
					setCurBeat(beat);
					curNode = ++beat % 4 === 0 ? beep1() : beep2();
					beat %= 4;
					curBeatTime.current = nextBeatTime.current;
					nextBeatTime.current = currentTime + dur;
					audioEngine.playNode(
						curNode,
						nextBeatTime.current,
						nextBeatTime.current + nodeDur,
					);
				}

				ctx.clearRect(0, 0, canvas.width, canvas.height);

				ctx.fillStyle = "rgba(255, 0, 0, 0.1)";
				for (const diff of hitOffsetsRef.current) {
					const offset = (diff / dur) * canvas.width;
					ctx.fillRect(
						mid + offset,
						0,
						2 * window.devicePixelRatio,
						canvas.height,
					);
				}

				ctx.fillStyle = "green";
				ctx.fillRect(mid, 0, 2 * window.devicePixelRatio, canvas.height);

				const nextDiff = (curBeatTime.current - currentTime) / dur;
				ctx.fillStyle = "yellow";
				ctx.fillRect(
					mid + nextDiff * canvas.width,
					0,
					window.devicePixelRatio,
					canvas.height,
				);
				const curDiff = (nextBeatTime.current - currentTime) / dur;
				ctx.fillStyle = "yellow";
				ctx.fillRect(
					mid + curDiff * canvas.width,
					0,
					window.devicePixelRatio,
					canvas.height,
				);

				await new Promise((r) => requestAnimationFrame(r));
			}

			curNode?.stop();
		})();

		return () => {
			canceled = true;
		};
	}, [start, dialogOpen, beepDuration]);

	useKeyBindingAtom(
		keySyncNextAtom,
		(evt) => {
			if (!start) return;
			const currentTime = audioEngine.ctxCurrentTime;
			const outputLatency = audioEngine.ctxOutputLatency;
			let hitTime = currentTime + outputLatency;
			switch (syncJudgeMode) {
				case SyncJudgeMode.FirstKeyDownTime:
					hitTime -= evt.downTimeOffset / 1000;
					break;
				case SyncJudgeMode.LastKeyUpTime:
					break;
				case SyncJudgeMode.MiddleKeyTime:
					hitTime -= evt.downTimeOffset / 2000;
					break;
			}
			const curDiff = curBeatTime.current - hitTime;
			const nextDiff = nextBeatTime.current - hitTime;
			let diff = 0;
			if (Math.abs(curDiff) < Math.abs(nextDiff)) {
				diff = curDiff;
			} else {
				diff = nextDiff;
			}
			hitOffsetsRef.current.push(diff);
			if (hitOffsetsRef.current.length > 100) {
				hitOffsetsRef.current.shift();
			}
			// 正值为快，负值为慢
			setHitOffset((old) => {
				const v = (diff * 1000) | 0;
				if (old === null)
					return {
						cur: v,
						min: v,
						max: v,
					};
				return {
					cur: v,
					min: Math.min(old.min, v),
					max: Math.max(old.max, v),
				};
			});
		},
		[start],
	);

	return (
		<Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
			<Dialog.Content>
				<Dialog.Title>
					{t("latencyTestDialog.title", "打轴延迟测试")}
				</Dialog.Title>
				<Flex direction="column" gap="2">
					<Text>
						{t(
							"latencyTestDialog.description",
							"请选择自己喜欢的 BPM，并在每个蜂鸣声响起时按下 {key} 键，以测量音频/输入延迟差",
							{
								key: <KeyBinding kbdAtom={keySyncNextAtom} />,
							},
						)}
					</Text>

					<Flex
						gap="6"
						my="6"
						style={{
							alignSelf: "center",
						}}
					>
						<BeepVisualizer enable={curBeat === 0} />
						<BeepVisualizer enable={curBeat === 1} />
						<BeepVisualizer enable={curBeat === 2} />
						<BeepVisualizer enable={curBeat === 3} />
					</Flex>
					<Flex
						gap="4"
						style={{
							alignSelf: "center",
						}}
					>
						<Text>
							{hitOffset === null
								? t("latencyTestDialog.latencyDisplay.fastest", "最快延迟")
								: `${hitOffset.max}ms`}
						</Text>

						<Text
							color={
								hitOffset === null
									? "gray"
									: hitOffset.cur > 0
										? "blue"
										: hitOffset.cur < 0
											? "red"
											: "green"
							}
						>
							{hitOffset === null
								? t("latencyTestDialog.latencyDisplay.current.none", "未测量")
								: hitOffset.cur > 0
									? t("latencyTestDialog.latencyDisplay.current.fast", "快") +
										` ${hitOffset.cur}ms`
									: hitOffset.cur < 0
										? t("latencyTestDialog.latencyDisplay.current.slow", "慢") +
											` ${hitOffset.cur}ms`
										: t(
												"latencyTestDialog.latencyDisplay.current.perfect",
												"完美",
											) + " 0ms"}
						</Text>

						<Text>
							{hitOffset === null
								? t("latencyTestDialog.latencyDisplay.slowest", "最慢延迟")
								: `${-hitOffset.min}ms`}
						</Text>
					</Flex>

					<canvas
						style={{
							width: "14em",
							height: "1em",
							margin: "1em",
							borderRadius: "var(--radius-2)",
							boxShadow: "var(--shadow-2)",
							alignSelf: "center",
						}}
						ref={visualizerRef}
					/>

					<Text as="label" size="2">
						<Flex direction="column" gap="2">
							{t("latencyTestDialog.bpmInputLabel", "节拍 BPM")}
							<TextField.Root
								type="number"
								min={60}
								max={320}
								value={latencyBPM}
								onChange={(evt) => setLatencyBPM(evt.target.valueAsNumber)}
							/>
						</Flex>
					</Text>

					<Flex gap="2">
						<Button onClick={() => setStart((v) => !v)}>
							{start
								? t("latencyTestDialog.button.stop", "结束")
								: t("latencyTestDialog.button.start", "开始")}
						</Button>
					</Flex>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
});
