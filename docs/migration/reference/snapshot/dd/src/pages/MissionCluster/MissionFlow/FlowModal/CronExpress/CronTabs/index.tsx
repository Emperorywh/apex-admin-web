/**
 * @description 时间表达式的规则
 * @date 2025-10-30
 */
import { useState } from "react";
import { Tabs } from "antd";
import type { TabsProps } from "antd";
// 秒 分 时 日 月 星期
import SecondTab from "./SecondTab";
import MinuteTab from "./MinuteTab";
import HourTab from "./HourTab";
import DayTab from "./DayTab";
import MonthTab from "./MonthTab";
import WeekTab from "./WeekTab";
import { useI18n } from "@/hooks/useI18n";

interface CronTabsProps {
    cronValue: string;
    triggerChange: (value: string) => void;
}

export default (props: CronTabsProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { cronValue, triggerChange } = props;

    const [activeKey, setActiveKey] = useState<string>("second");

    const onTabsChange: TabsProps["onChange"] = (value) => {
        setActiveKey(value);
    };

    const items: TabsProps['items'] = [
        {
            key: "second",
            label: t("秒"),
            children: (
                <SecondTab
                    text="秒"
                    cronValue={cronValue}
                    triggerChange={triggerChange}
                />
            )
        },
        {
            key: "minute",
            label: t("分"),
            children: (
                <MinuteTab
                    text="分"
                    cronValue={cronValue}
                    triggerChange={triggerChange}
                />
            )
        },
        {
            key: "hour",
            label: t("时"),
            children: (
                <HourTab
                    text="小时"
                    cronValue={cronValue}
                    triggerChange={triggerChange}
                />
            )
        },
        {
            key: "day",
            label: t("日"),
            children: (
                <DayTab
                    text="日"
                    cronValue={cronValue}
                    triggerChange={triggerChange}
                />
            )
        },
        {
            key: "month",
            label: t("月"),
            children: (
                <MonthTab
                    text="月"
                    cronValue={cronValue}
                    triggerChange={triggerChange}
                />
            )
        },
        {
            key: "week",
            label: t("周"),
            children: (
                <WeekTab
                    text="周"
                    cronValue={cronValue}
                    triggerChange={triggerChange}
                />
            )
        }
    ];

    return (
        <Tabs
            activeKey={activeKey}
            items={items}
            onChange={onTabsChange}
        />
    )
};
