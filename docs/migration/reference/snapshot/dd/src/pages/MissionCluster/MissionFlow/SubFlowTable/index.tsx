/**
 * @description 子任务的表格
 * @date 2025-10-30
 */
import { Table, Space, Dropdown, message } from "antd";
import type { TableColumnsType } from "antd";
import { operates } from "@/constants/MissionCluster";
import type { OrderGroupRecord, SubOrderFlowType, OrderFlowOperationType } from "@/types/MissionCluster/MissionFlow";
import type { MenuInfo } from "rc-menu/lib/interface";
import { subOrderFlowOperation } from "@/api";
import { FlowState } from "@/utils/enum";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

interface SubFlowTableProps {
    getOrderFlows: () => void;
}

export default (props: OrderGroupRecord & SubFlowTableProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    /* 按钮级权限判定（SPEC §8.3）：子工艺操作 Dropdown（粗粒度码） */
    const { hasPerm } = useAccess();
    const canSubOperate = hasPerm(PERM_BUTTON.MISSION_TEMPLATE_SUB_OPERATE); // 子工艺操作（§7.2/§7.4）

    const { subOrderFlows, getOrderFlows } = props;

    const onOperateClick = ({ key }: MenuInfo, record: SubOrderFlowType) => {
        const { id } = record;
        const data: OrderFlowOperationType = {
            id,
            operation: key as unknown as ("PAUSE" | "CONTINUE" | "CANCEL")
        };
        subOrderFlowOperation(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                getOrderFlows();
                message.success(t("当前任务操作成功"));
            } else {
                message.warning(t("当前任务操作出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("当前任务操作出错") + err?.message);
            }
        })
    };

    const expandColumns: TableColumnsType<SubOrderFlowType> = [
        {
            title: t("订单模版名称"),
            dataIndex: "orderTemplateName",
            ellipsis: { showTitle: true }
        },
        {
            title: t("订单模版标识"),
            dataIndex: "orderTemplateKey",
            ellipsis: { showTitle: true }
        },
        {
            title: t("工艺状态"),
            dataIndex: "subOrderFlowState",
            render: (value: SubOrderFlowType["subOrderFlowState"]) => t(FlowState[value] ?? value ?? ""),
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            width: 150,
            fixed: "right",
            render: (_, record) => (
                <Space>
                    {/* 子工艺操作 Dropdown（粗粒度码 §7.4）：无权限隐藏入口 */}
                    {canSubOperate && (
                        <Dropdown.Button
                            type="default"
                            menu={{
                                items: operates?.map(op => op && "label" in op ? { ...op, label: t(op.label as string) } : op),
                                onClick: (e) => onOperateClick(e, record)
                            }}
                        >
                            {t("操作")}
                        </Dropdown.Button>
                    )}
                </Space>
            ),
            ellipsis: { showTitle: true }
        }
    ];

    return (
        <Table<SubOrderFlowType>
            columns={expandColumns}
            dataSource={subOrderFlows}
            pagination={false}
            rowKey={r => r.id}
        />
    )
};
