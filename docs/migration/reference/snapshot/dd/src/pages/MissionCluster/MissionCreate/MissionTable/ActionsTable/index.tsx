/**
 * @description 动作表格
 * @date 2025-10-29
 */
import { Table, Descriptions } from "antd";
import type { TableColumnsType } from "antd";
import type { Actions, OrderTemplateMissionType, ActionParameterType } from "@/types/MissionCluster/MissionCreate";
import { useI18n } from "@/hooks/useI18n";


export default (props: OrderTemplateMissionType) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { actions } = props;

    const expandColumns: TableColumnsType<Actions> = [
        {
            title: t("动作类型"),
            dataIndex: "actionType",
            ellipsis: { showTitle: true }
        },
        {
            title: t("动作描述"),
            dataIndex: "actionDescription",
            ellipsis: { showTitle: true }
        },
        {
            title: t("阻塞类型"),
            dataIndex: "blockingType",
            ellipsis: { showTitle: true }
        },
        {
            title: t("动作参数"),
            dataIndex: "actionParameters",
            width: "25%",
            render: (value) => (
                <Descriptions
                    column={1}
                    size="small"
                    items={value?.map((param: ActionParameterType) => ({
                        key: param.key,
                        label: param.key,
                        children: param.value
                    }))}
                />
            ),
            ellipsis: { showTitle: true }
        }
    ];

    return (
        <Table<Actions>
            columns={expandColumns}
            dataSource={actions}
            pagination={false}
            rowKey={r => r.actionType}
        />
    )
};
