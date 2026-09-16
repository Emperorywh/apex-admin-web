/**
 * @description 动作表格
 * @date 2025-10-29
 */
import { Table, Descriptions } from "antd";
import type { TableColumnsType } from "antd";
import type { Actions, ActionParameterType } from "@/types/MissionCluster/MissionCreate";
import { useI18n } from "@/hooks/useI18n";


export default (props: Actions[]) => {

    const { t } = useI18n();

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
            dataSource={props}
            pagination={false}
            rowKey={r => r.actionType}
        />
    )
};
