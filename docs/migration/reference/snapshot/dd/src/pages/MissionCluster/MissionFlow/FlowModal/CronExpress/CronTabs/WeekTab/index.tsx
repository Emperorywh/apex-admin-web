/**
 * @description 星期对应的栏
 * @date 2025-10-31
 */
import { useState, useRef } from "react";
import { Radio } from "antd";
import type { RadioChangeEvent } from "antd";
import FromToInterval from "@/components/FromToInterval";
import FromToChecbox from "@/components/FromToChecbox";
import { cronIndex } from "@/constants/MissionCluster";
import FromToWhich from "./FromToWhich";
import FromToLast from "./FromToLast";
import { useI18n } from "@/hooks/useI18n";

const style: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 8,
};

interface WeekTabProps {
    text: string;
    cronValue: string;
    triggerChange: (value: string) => void;
}

export default (props: WeekTabProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { text, cronValue, triggerChange } = props;

    // 当前选中的单选框
    const [radioValue, setRadioValue] = useState<string>("*");

    // 范围默认值
    const defaultRange = useRef<string>("1-2");
    // 多个值默认值
    const defaultCheckbox = useRef<string>("1");
    // 周的第几个默认值
    const defaultWhich = useRef<string>("1#1");
    // 最后一个工作日
    const defaultLast = useRef<string>("1L");

    const onRadioChange = (e: RadioChangeEvent) => {
        const value = e.target.value;
        setRadioValue(value);
        const splitCron = cronValue.split(" ");
        // 处理当前时间下标前的*换成0
        const replaceToZero = splitCron.map<string>((item, index) => item === "*" && cronIndex[text] > index ? "0" : item);
        if (value === "*" || value === "?") {
            if (!cronValue) return;
            const updateCron = replaceToZero.toSpliced(cronIndex[text], 1, value).join(" ");
            triggerChange(updateCron);
            return;
        }
        switch (value) {
            case "fromTo":
                const range = replaceToZero.toSpliced(cronIndex[text], 1, defaultRange.current).join(" ");
                triggerChange(range);
                break;
            case "fromChecbox":
                const checkbox = replaceToZero.toSpliced(cronIndex[text], 1, defaultCheckbox.current).join(" ");
                triggerChange(checkbox);
                break;
            case "fromToWhich":
                const which = replaceToZero.toSpliced(cronIndex[text], 1, defaultWhich.current).join(" ");
                triggerChange(which);
                break;
            case "fromToLast":
                const last = replaceToZero.toSpliced(cronIndex[text], 1, defaultLast.current).join(" ");
                triggerChange(last);
                break;
            default:
                break;
        }
    };

    return (
        <Radio.Group
            onChange={onRadioChange}
            value={radioValue}
            style={style}
            options={[
                {
                    value: "*",
                    label: t("每周")
                },
                {
                    value: "?",
                    label: t("不指定")
                },
                {
                    value: "fromInterval",
                    label: (
                        <FromToInterval
                            text={text}
                            min={1}
                            max={7}
                            cronValue={cronValue}
                            radioValue={radioValue}
                            triggerChange={triggerChange}
                        />
                    )
                },
                {
                    value: "fromToWhich",
                    label: (
                        <FromToWhich
                            text={text}
                            cronValue={cronValue}
                            radioValue={radioValue}
                            triggerChange={triggerChange}
                        />
                    )
                },
                {
                    value: "fromToLast",
                    label: (
                        <FromToLast
                        text={text}
                        cronValue={cronValue}
                        radioValue={radioValue}
                        triggerChange={triggerChange}
                        />
                    )
                },
                {
                    value: "fromChecbox",
                    label: (
                        <FromToChecbox
                            text={text}
                            cronValue={cronValue}
                            radioValue={radioValue}
                            triggerChange={triggerChange}
                        />
                    ),
                    style: {
                        display: "inline"
                    }
                }
            ]}
        />
    )
};