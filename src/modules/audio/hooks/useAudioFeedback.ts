import { useAtom } from "jotai";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { audioErrorAtom } from "$/modules/audio/states/index.ts";

export const useAudioFeedback = () => {
	const [errorMsg, setErrorMsg] = useAtom(audioErrorAtom);
	const { t } = useTranslation();

	useEffect(() => {
		if (errorMsg) {
			toast.error(
				`${t("audio.error.workerError", "处理音频时出错")}: ${errorMsg}`,
				{
					autoClose: 5000,
					closeOnClick: true,
					draggable: true,
				},
			);

			setErrorMsg(null);
		}
	}, [errorMsg, setErrorMsg, t]);
};
