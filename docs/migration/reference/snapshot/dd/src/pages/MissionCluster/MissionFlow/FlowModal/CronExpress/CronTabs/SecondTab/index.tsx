/**
 * @description 秒对应的栏
 * @date 2025-10-31
 */
import { useState, useRef } from "react";
import { Radio } from "antd";
import type { RadioChangeEvent } from "antd";
import FromToInput from "@/components/FromToInput";
import FromToInterval from "@/components/FromToInterval";
import FromToChecbox from "@/components/FromToChecbox";
import { cronIndex } from "@/constants/MissionCluster";
import { useI18n } from "@/hooks/useI18n";

const style: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 8,
};

interface SecondTabProps {
    text: string;
    cronValue: string;
    triggerChange: (value: string) => void;
}

export default (props: SecondTabProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { text, cronValue, triggerChange } = props;

    // 当前选中的单选框
    const [radioValue, setRadioValue] = useState<string>("*");

    // 范围默认值
    const defaultRange = useRef<string>("1-2");
    // 步长默认值
    const defaultInterval = useRef<string>("1/2");
    // 多个值默认值
    const defaultCheckbox = useRef<string>("0");

    const onRadioChange = (e: RadioChangeEvent) => {
        const value = e.target.value;
        setRadioValue(value);
        const splitCron = cronValue.split(" ");
        switch (value) {
            case "*":
                // 每秒执行的时候更新所有的时间
                triggerChange("* * * * * ?");
                break;
            case "fromTo":
                const range = splitCron.toSpliced(cronIndex[text], 1, defaultRange.current).join(" ");
                triggerChange(range);
                break;
            case "fromInterval":
                const interval = splitCron.toSpliced(cronIndex[text], 1, defaultInterval.current).join(" ");
                triggerChange(interval);
                break;
            case "fromChecbox":
                const checkbox = splitCron.toSpliced(cronIndex[text], 1, defaultCheckbox.current).join(" ");
                triggerChange(checkbox);
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
                    label: t("每秒")
                },
                {
                    value: "fromTo",
                    label: (
                        <FromToInput
                            text={text}
                            min={1}
                            max={59}
                            cronValue={cronValue}
                            radioValue={radioValue}
                            triggerChange={triggerChange}
                        />
                    )
                },
                {
                    value: "fromInterval",
                    label: (
                        <FromToInterval
                            text={text}
                            min={0}
                            max={59}
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
