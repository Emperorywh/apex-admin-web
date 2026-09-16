/**
 * @description 订单详情弹窗组件，基于 OrderInfo 页面抽离
 * @date 2026-4-8
 */
import { useEffect, useState } from "react";
import { Descriptions, message, Modal, Table } from "antd";
import type { DescriptionsProps, TableProps, TablePaginationConfig } from "antd";
import dayjs from "dayjs";
import { transformOrderInfo } from "@/utils/public";
import { getOrderRecordDetail } from "@/api";
import type { OrderInfoType, OrderMissions, OrderRecordDetailDTO } from "@/types/OrderRecord/OrderInfo";
import ExpandedActions from "@/pages/OrderInfo/ExpandedActions";
import { MissionState } from "@/utils/enum";
import { useI18n } from "@/hooks/useI18n";

interface OrderInfoModalProps {
    open: boolean;
    orderKey: string;
    onClose: () => void;
    getContainer?: () => HTMLElement;
}

export default (props: OrderInfoModalProps) => {

    const { open, orderKey, onClose, getContainer } = props;

    const { t } = useI18n();

    const [items, setItems] = useState<DescriptionsProps["items"]>([]);
    const [orderMissions, setOrderMissions] = useState<OrderInfoType["orderMissions"]>([]);
    /* 子任务(mission)服务端分页：paginationParams 分页器配置(current/total/pageSize)，均以后端 missionPage 返回为准 */
    const [paginationParams, setPaginationParams] = useState<TablePaginationConfig>({});

    const getOrderDetail = (orderTaskKey: string, currentPageNo: number, currentPageSize: number) => {
        getOrderRecordDetail({ orderTaskKey, pageNo: currentPageNo, pageSize: currentPageSize }).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: OrderRecordDetailDTO = res.data;
                const { orderRecord, missionPage } = data;
                /* 子任务列表改取分页结果 missionPage.records，并预拼装「动作描述」列文本 */
                const records = missionPage?.records || [];
                const result = records.map(item => {
                    return {
                        ...item,
                        actionDescription: item?.actions?.map?.(action => action.actionDescription)?.join(",") || '',
                    }
                });
                setOrderMissions(result);
                /* 同步分页器：current/total/size 均以后端返回为准 */
                setPaginationParams({
                    current: missionPage?.current,
                    total: missionPage?.total,
                    pageSize: missionPage?.size
                });
                /* 订单主体生成顶部描述列表（transformOrderInfo 内部已跳过 orderMissions） */
                const infos = transformOrderInfo(orderRecord);
                setItems(infos.map(item => ({
                    ...item,
                    label: t(item.label as string),
                    children: typeof item.children === "string" ? t(item.children) : item.children
                })));
            } else {
                message.warning(t("查询订单详情出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询订单详情出错") + err?.message);
            }
        })
    };

    /* 子任务表格翻页 / 切换每页条数：以分页器回传的 current/pageSize 重新请求对应页数据 */
    const onMissionTableChange: TableProps<OrderMissions>["onChange"] = (pagination) => {
        const { current, pageSize: currentPageSize } = pagination;
        getOrderDetail(orderKey, current as number, currentPageSize as number);
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
        },
        {
            title: t("开始时间"),
            dataIndex: "executeTime",
            width: 170,
            // executeTime 可能为 null（任务尚未开始），空值展示占位符 "-"
            render: (value: string) => value || ""
        },
        {
            title: t("结束时间"),
            dataIndex: "finalTime",
            width: 170,
            // finalTime 可能为 null（任务尚未结束），空值展示占位符 "-"
            render: (value: string) => value || ""
        },
        {
            title: t("耗时"),
            width: 110,
            render: (_, record) => {
                // 开始或结束时间任一缺失则无法计算耗时，展示占位符 "-"
                if (!record.executeTime || !record.finalTime) return "-";
                // 以秒为单位计算差值，再格式化为 HH:mm:ss，与二级表格「耗时」列保持一致
                const diff = dayjs(record.finalTime).diff(dayjs(record.executeTime), "second");
                const h = Math.floor(diff / 3600);
                const m = Math.floor((diff % 3600) / 60);
                const s = diff % 60;
                return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
            }
        }
    ];

    useEffect(() => {
        if (open && orderKey) {
            /* 每次打开弹窗都从第一页(每页10条)开始加载，避免残留上一次的分页位置 */
            getOrderDetail(orderKey, 1, 10);
        }
        if (!open) {
            setItems([]);
            setOrderMissions([]);
            setPaginationParams({});
        }
    }, [open, orderKey]);

    return (
        <Modal
            title={t("订单详情")}
            open={open}
            onCancel={onClose}
            footer={null}
            width={1600}
            destroyOnClose
            getContainer={getContainer}
        >
            <Descriptions
                size="small"
                bordered
                column={2}
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
        </Modal>
    )
};
