/**
 * @description 子表格组件
 * @date 2025-10-29
 */
import { Table } from "antd";
import type { TableColumnsType } from "antd";
import type { OrderTemplateRecord, OrderTemplateMissionType } from "@/types/MissionCluster/MissionCreate";
import ActionsTable from "./ActionsTable";
import { useI18n } from "@/hooks/useI18n";

export default (props: OrderTemplateRecord) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { orderMissions } = props;

    const expandColumns: TableColumnsType<OrderTemplateMissionType> = [
        {
            title: t("地图名称"),
            dataIndex: "mapName",
            ellipsis: { showTitle: true }
        },
        {
            title: t("地图ID"),
            dataIndex: "mapId",
            ellipsis: { showTitle: true }
        },
        {
            title: t("站点名称"),
            dataIndex: "stationName",
            ellipsis: { showTitle: true }
        },
        {
            title: t("站点ID"),
            dataIndex: "stationId",
            ellipsis: { showTitle: true }
        }
    ];

    return (
        <Table<OrderTemplateMissionType>
            columns={expandColumns}
            dataSource={orderMissions}
            pagination={false}
            rowKey={r => r.id}
            expandable={{ expandedRowRender: (aprops) => <ActionsTable {...aprops} /> }}
        />
    )
};
