/**
 * @description 路径上的避障策略，不允许批量编辑
 * @date 2025-8-11
 */
import { useEffect, useState, useRef } from "react";
import { Table, Divider, Switch, Select } from "antd";
import type { TableProps, SelectProps, SwitchProps } from "antd";
import type { AvoidType } from "@/types/MapNestModify";
import type Konva from "konva";
import { avoidList } from "@/constants/mapThrough";
import { useI18n } from "@/hooks/useI18n";

interface AvoidProps {
    selectShapes: Konva.Shape[];
}

export default (props: AvoidProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    // 避障表格的数据
    const [avoidTableData, setAvoidTableData] = useState<AvoidType[]>([]);

    const asIndexOptions = useRef<SelectProps["options"]>(Array.from({ length: 64 }, (_, index) => ({
        label: index,
        value: index
    })));


    const onOnOffChange = (record: AvoidType, checked: boolean) => {
        const { id } = record;
        // 修改表格的数据
        const changeAvoid: AvoidType[] = avoidTableData.map(avoid => ({
            ...avoid,
            on_off: avoid.id === id ? checked : avoid.on_off
        }))
        setAvoidTableData(changeAvoid);
        // 修改当前路径的避障策略
        selectShapes.forEach(shape => {
            const { attrs: { data } } = shape;
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    forward_avoid: changeAvoid,
                    reverse_avoid: changeAvoid
                }
            });
        })
    };

    // 跟上面同理，不想写了，用到了再写
    const onAsIndexChange = () => {};

    const columns: TableProps<AvoidType>["columns"] = [
        {
            title: t("名称"),
            dataIndex: "name",
            fixed: "left",
            ellipsis: { showTitle: true }
        },
        {
            title: t("开启"),
            dataIndex: "on_off",
            render: (value, record) => (
                <Switch
                    checked={value}
                    onChange={(checked) => onOnOffChange(record, checked)}
                />
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("范围"),
            dataIndex: "as_index",
            render: (value) => (
                <Select
                    value={value}
                    placeholder={t("传感器范围")}
                    options={asIndexOptions.current}
                    showSearch
                    optionFilterProp="label"
                    onChange={() => onAsIndexChange()}
                />
            ),
            ellipsis: { showTitle: true }
        }
    ];

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data } } = shape;
        // 处理避障策略
        if (!data?.isBackEdge && data?.forward_avoid) {
            // 正向路径显示正向避障策略
            setAvoidTableData(
                (data?.forward_avoid as AvoidType[] || []).map((avoid: AvoidType) => ({
                    ...avoid,
                    // 找到传感器的名字
                    name: t(avoidList.find(avo => avo.id === avoid?.id)?.name || "")
                }))
            );
        }
        if (data?.isBackEdge && data?.reverse_avoid) {
            // 反向路径显示反向避障策略
            setAvoidTableData(
                (data?.reverse_avoid as AvoidType[] || []).map((avoid: AvoidType) => ({
                    ...avoid,
                    // 找到传感器的名字
                    name: t(avoidList.find(avo => avo.id === avoid?.id)?.name || "")
                }))
            );
        }
    }, [selectShapes])

    return (
        <>
            <Divider style={{ borderColor: "#1677FF", fontWeight: 550 }} plain>{t("传感器配置")}</Divider>
            <Table<AvoidType>
                columns={columns}
                dataSource={avoidTableData}
                rowKey={r => r.id}
                size="small"
                pagination={false}
                // scroll={{ x: 300 }}
            />
        </>
    )
};
