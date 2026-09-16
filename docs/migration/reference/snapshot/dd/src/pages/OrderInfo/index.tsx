/**
 * @description 订单的详情页
 * @date 2025-6-18
 */
import { useEffect, useState } from "react";
import { useLocation } from "@umijs/max";
import { Descriptions, message, Table } from "antd";
import type { DescriptionsProps, TableProps, TablePaginationConfig } from "antd";
import { transformOrderInfo } from "@/utils/public";
import { getOrderRecordDetail } from "@/api";
import type { OrderInfoType, OrderMissions, OrderRecordDetailDTO } from "@/types/OrderRecord/OrderInfo";
import ExpandedActions from "./ExpandedActions";
import styles from "./index.less";
import { MissionState } from "@/utils/enum";
import { useI18n } from "@/hooks/useI18n";

export default () => {

    /* 国际化翻译方法，用于将订单详情页的所有文案进行多语言转换 */
    const { t } = useI18n();

    const location = useLocation();

    // 描述列表
    const [items, setItems] = useState<DescriptionsProps["items"]>([]);
    // 订单数据
    const [orderMissions, setOrderMissions] = useState<OrderInfoType["orderMissions"]>([]);
    // 子任务(mission)服务端分页：paginationParams 分页器配置(current/total/pageSize)，均以后端 missionPage 返回为准
    const [paginationParams, setPaginationParams] = useState<TablePaginationConfig>({});

    const getOrderDetail = (orderTaskKey: string, currentPageNo: number, currentPageSize: number) => {
        getOrderRecordDetail({ orderTaskKey, pageNo: currentPageNo, pageSize: currentPageSize }).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: OrderRecordDetailDTO = res.data;
                const { orderRecord, missionPage } = data;
                // 子任务列表改取分页结果 missionPage.records，并预拼装「动作描述」列文本
                const records = missionPage?.records || [];
                const result = records.map(item => {
                    return {
                        ...item,
                        actionDescription: item?.actions?.map?.(action => action.actionDescription)?.join(",") || '',
                    }
                });
                setOrderMissions(result);
                // 同步分页器：current/total/size 均以后端返回为准
                setPaginationParams({
                    current: missionPage?.current,
                    total: missionPage?.total,
                    pageSize: missionPage?.size
                });
                // 订单主体生成顶部描述列表（transformOrderInfo 内部已跳过 orderMissions）
                const infos = transformOrderInfo(orderRecord);
                /* 将描述列表中的标签（来自 orderRefer 常量的中文）翻译为当前语言 */
                const translatedInfos = infos.map(item => ({
                    ...item,
                    label: t(item.label as string),
                    children: typeof item.children === "string" ? t(item.children) : item.children
                }));
                setItems(translatedInfos);
            } else {
                message.warning(t("查询订单详情出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询订单详情出错") + err?.message);
            }
        })
    };

    // 子任务表格翻页 / 切换每页条数：以分页器回传的 current/pageSize 重新请求对应页数据
    const onMissionTableChange: TableProps<OrderMissions>["onChange"] = (pagination) => {
        const { current, pageSize: currentPageSize } = pagination;
        const orderKey = location?.search;
        getOrderDetail(orderKey.substring(1), current as number, currentPageSize as number);
    };

    const columns: TableProps<OrderMissions>["columns"] = [
        {
            title: t("子任务标识"),
            dataIndex: "orderMissionKey",
            ellipsis: { showTitle: true }
        },
        {
            title: t("动作描述"),
            dataIndex: "actionDescription",
            ellipsis: { showTitle: true }
        },
        {
            title: t("地图名称"),
            dataIndex: "mapName",
            ellipsis: { showTitle: true }
        },
        {
            title: t("站点名称"),
            dataIndex: "stationName",
            ellipsis: { showTitle: true }
        },
        {
            title: t("任务状态"),
            dataIndex: "missionState",
            render: (value: OrderMissions["missionState"]) => t(MissionState[value] ?? value ?? ""),
            ellipsis: { showTitle: true }
        }
    ];

    useEffect(() => {
        const orderKey = location?.search
        // 路由 orderKey 变化时从第一页(每页10条)加载
        getOrderDetail(orderKey.substring(1), 1, 10);
    }, [location?.search])

    return (
        <div className={styles.order_info}>
            <Descriptions
                title={t("订单详情")}
                size="small"
                bordered
                column={3}
                items={items}
            />
            <Table<OrderMissions>
                style={{ marginTop: 20 }}
                columns={columns}
                dataSource={orderMissions}
                pagination={{
                    ...paginationParams,
                    showSizeChanger: true,
                    pageSizeOptions: [10, 20, 50, 100],
                    showTotal: (total) => t("总数{total}条", { total }),
                    hideOnSinglePage: false
                }}
                onChange={onMissionTableChange}
                rowKey={r => r.id}
                expandable={{ expandedRowRender: (record) => <ExpandedActions data={record.actions} /> }}
            />
        </div>
    )
};
