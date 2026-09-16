/**
 * @description 任务的统计
 * @date 2025-6-10
 */
import { useEffect, useState } from "react";
import { message, Statistic, Row, Col } from "antd";
import { useRequest } from "ahooks";
import { orderRecordStateStatistic } from "@/api";
import type { RecordStatistics, StatisticItem } from "@/types/OrderRecord";
import { defaultRecordList } from "@/constants/OrderRecord/Statistics";
import { useI18n } from "@/hooks/useI18n";



export default () => {

    /* 国际化翻译方法，用于将统计指标的标题进行多语言转换 */
    const { t } = useI18n();

    // 统计的数值
    const [statisticList, setStatisticList] = useState<StatisticItem[]>([]);

    // 转化为统计数据的样式
    const transformRecordList = (data: RecordStatistics) => (
        defaultRecordList?.map(order => ({
            ...order,
            title: t(order.title as string),
            value: data[order?.key as keyof RecordStatistics]
        }))
    );

    const { data } = useRequest(orderRecordStateStatistic, {
        pollingInterval: 1000,
        pollingWhenHidden: false,
        pollingErrorRetryCount: 1,
        onError: (err) => message.error(t("查询订单统计出错") + err?.message)
    });

    useEffect(() => {
        if (data?.code === 200 && data?.message === "success") {
            const orderList = transformRecordList(data?.data);
            setStatisticList(orderList);
        }
    }, [data])

    return (
        <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}
            justify="center"
        >
            {
                statisticList.map(order => (
                    <Col key={order.key} flex={1 / 7}>
                        <Statistic
                            title={t(order.title)}
                            value={order.value}
                            valueStyle={{ color: "#1677FF" }}
                        />
                    </Col>
                ))
            }
        </Row>
    )
};
