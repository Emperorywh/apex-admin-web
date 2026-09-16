/**
 * @description 策略配置的表格
 * @date 2025-6-9
 */
import { createContext } from "react";
import { Table, Form } from "antd";
import type { TableProps, GetRef } from "antd";
import type { ChildConfig, StrategyConfigTypes } from "@/types/DispatchHub/typing";
import EditableRow from "./EditableRow";
import EditableCell from "./EditableCell";
import type { EditableCellProps } from "./EditableCell";
import type { EditableRowProps } from "./EditableRow";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

type ColumnTypes = Exclude<TableProps<ChildConfig>['columns'], undefined>;
type FormInstance<T> = GetRef<typeof Form<T>>;

const EditableContext = createContext<FormInstance<any> | null>(null);

interface StrategyTableProps {
    data: ChildConfig[];
    setDispatchConfigs: (value: React.SetStateAction<StrategyConfigTypes[]>) => void;
}

export default (props: StrategyTableProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();
/* 按钮级权限判定 */ const { hasPerm } = useAccess();
/*
 * 可编辑权限：后端在 dispatch-hub 下仅有 save/reset 两码，无独立「编辑」码。
 * 编辑的唯一目的是经「保存」提交，故以 dispatch-hub:save 统一控制单元格是否可编辑。
 * 无权限时单元格退化为只读文本展示（避免隐藏致配置值列空荡，见 SPEC §7.3）。
 */
    const canSave = hasPerm(PERM_BUTTON.DISPATCH_HUB_SAVE);

    const { data, setDispatchConfigs } = props;

    const handleSave = (row: ChildConfig) => {
        const { configKey, configValue } = row;
        setDispatchConfigs(configs => {
            return configs.map(cfgs => {
                const { childTaskConfigs } = cfgs;
                return {
                    ...cfgs,
                    childTaskConfigs: childTaskConfigs.map(child => ({
                        ...child,
                        configValue: child.configKey === configKey ? configValue : child.configValue
                    }))
                }
            })
        })
    };

    const columns: (ColumnTypes[number] & { editable?: boolean; dataIndex: string })[] = [
        // {
        //     title: "配置标识",
        //     dataIndex: "configKey"
        // },
        {
            title: t("配置名称"),
            dataIndex: "configKeyName",
            align: "center",
            ellipsis: { showTitle: true }
        },
        // {
        //     title: "配置类型",
        //     dataIndex: "configType"
        // },
        // {
        //     title: "配置类型名称",
        //     dataIndex: "configTypeName"
        // },
        {
            title: t("默认值"),
            dataIndex: "defaultConfigValue",
            align: "center",
            ellipsis: { showTitle: true }
        },
        {
            title: t("配置值"),
            dataIndex: "configValue",
            align: "center",
            editable: canSave,
            onCell: (record) => ({
                record,
                editable: canSave,
                dataIndex: "configValue",
                title: t("配置值"),
                handleSave,
                ellipsis: { showTitle: true }
            }),
            ellipsis: { showTitle: true }
        },
        {
            title: t("配置值范围"),
            dataIndex: "configValueRange",
            align: "center",
            ellipsis: { showTitle: true }
        },
        // {
        //     title: "配置值类型",
        //     dataIndex: "configValueType",
        //     align: "center"
        // },
        {
            title: t("配置值单位"),
            dataIndex: "configValueUnit",
            align: "center",
            ellipsis: { showTitle: true }
        }
    ];

    return (
        <Table<ChildConfig>
            style={{ marginTop: 10 }}
            columns={columns}
            dataSource={data}
            components={{
                body: {
                    row: (props: EditableRowProps) => <EditableRow {...props} EditableContext={EditableContext} />,
                    cell: (props: EditableCellProps) => <EditableCell {...props} EditableContext={EditableContext} />
                }
            }}
            rowKey={r => r.configKey}
            scroll={{ x: 800, y: "calc(100vh - 220px)" }}
            pagination={false}
            bordered={false}
        />
    )
};
