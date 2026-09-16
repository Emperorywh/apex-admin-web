/**
 * @description 订单的统计
 * @date 2025-11-5
 */
import { Tabs } from "antd";
import QuantityStatistics from "./QuantityStatistics";
import EfficiencyStatistics from "./EfficiencyStatistics";
import styles from "./index.less";
import { useI18n } from "@/hooks/useI18n";

export default () => {
    /* 国际化翻译方法 */ const { t } = useI18n();

    const tabItems = [
        {
            key: "quantity",
            label: t("任务数量统计"),
            children: <QuantityStatistics />,
        },
        {
            key: "efficiency",
            label: t("任务效率统计"),
            children: <EfficiencyStatistics />,
        },
    ];

    return (
        <div className={styles.order_statistics}>
            <Tabs defaultActiveKey="quantity" items={tabItems} />
        </div>
    );
};
