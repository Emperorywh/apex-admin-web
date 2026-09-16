/**
 * @description 指定某一月的值
 * @date 2025-10-30
 */
import { useMemo, useState } from "react";
import { Checkbox, Space, Typography } from "antd";
import type { CheckboxOptionType, GetProp } from "antd";
import { cornCountEnum, cronIndex } from "@/constants/MissionCluster";
import { useI18n } from "@/hooks/useI18n";

interface FromToCheckboxProps {
    text: string;
    cronValue: string;
    radioValue: string;
    triggerChange: (value: string) => void;
}

export default (props: FromToCheckboxProps) => {

    const { text, cronValue, radioValue, triggerChange } = props;

    const { t } = useI18n();

    // const [selectedValues, setSelectedValues] = useState<number[]>([]);

    const { options } = useMemo(() => {
        const options: CheckboxOptionType<string>[] = Array.from({ length: cornCountEnum[text] }, (_, index) => ({
            label: ["日", "月", "周"].includes(text) ? index + 1 : `${index < 10 ? "0" + index : index}`,
            value: ["日", "月", "周"].includes(text) ? String(index + 1) : String(index)
        }))
        return { options }
    }, [text])

    const onCheckboxChange: GetProp<typeof Checkbox.Group, "onChange"> = (checkedValues) => {
        console.log("选择了哪个", checkedValues, cronValue)
        if (!cronValue || radioValue !== "fromChecbox") return;
        const splitCron = cronValue.split(" ");
        // 找到当前值
        const currentValue = splitCron[cronIndex[text]];
        const updateCron = splitCron.toSpliced(cronIndex[text], 1, checkedValues.join(",")).join(" ");
        triggerChange(updateCron);
    };

    return (
        <Space direction="vertical">
            <Typography.Text>{t("指定")}</Typography.Text>
            <Checkbox.Group
                style={{ width: 600 }}
                disabled={radioValue !== "fromChecbox"}
                /*
                 * 仅在「指定」模式下解析对应 cron 字段；
                 * cronValue 可能为空或不完整（对应下标缺失），用 ?? "" 兜底避免 undefined.split 报错，
                 * 其余模式组件已禁用，传空数组即可。
                 */
                value={radioValue === "fromChecbox"
                    ? (cronValue.split(" ")[cronIndex[text]] ?? "").split(",")
                    : []}
                options={options}
                onChange={onCheckboxChange}
            />
        </Space>
    )
};
