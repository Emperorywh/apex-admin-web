/**
 * @description 
 * @date 2026-1-13
 */
import { useEffect, useState } from "react";
import { Form, Select, message } from "antd";
import type { SelectProps } from "antd";
import { getObstacleAvoidanceList } from "@/api";
import { edgeHighlightColors } from "@/plugins/konva/path/edgeHighlightColors";
import type Konva from "konva";
import type { ObstacleRecord } from "@/types/ObstacleAvoidance";
import { useI18n } from "@/hooks/useI18n";

interface LoadSecurityProps {
    selectShapes: Konva.Shape[];
}

export default (props: LoadSecurityProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    // 避障列表数据
    const [obstacleList, setObstacleList] = useState<ObstacleRecord[]>([]);

    const form = Form.useFormInstance();

    /**
     * 载货避障策略变更处理
     * 直接绑定obstacleList的id字段到边的loadSecurity属性
     */
    const onLoadSecurityChange: SelectProps["onChange"] = (value) => {
        selectShapes.forEach(shape => {
            const { attrs: { data } } = shape;
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    loadSecurity: value ?? null
                }
            });
        })
    };

    useEffect(() => {
        getObstacleAvoidanceList().then(res => {
            if (res.code === 200 && res.message === "success") {
                setObstacleList(res?.data || []);
            } else {
                message.warning(t("查询避障数据列表出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询避障数据列表出错") + err?.message);
            }
        })
    }, [])

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data } } = shape;
        // 直接回显loadSecurity中存储的id
        form.setFieldValue("loadSecurity", data?.loadSecurity);
    }, [selectShapes])

    return (
        <Form.Item
            name="loadSecurity"
            label={
                <span>
                    {t("载货避障策略")}
                    <span style={{ display: "inline-block", width: 12, height: 12, backgroundColor: edgeHighlightColors.loadSecurity, borderRadius: 2, verticalAlign: "middle", marginLeft: 4 }} />
                </span>
            }
        >
            <Select
                placeholder={t("请选择载货避障策略")}
                options={obstacleList}
                allowClear
                showSearch
                optionFilterProp="obstacleAvoidanceName"
                fieldNames={{ label: "obstacleAvoidanceName", value: "id" }}
                filterSort={(optionA, optionB) =>
                    (optionA?.obstacleAvoidanceName ?? "").toLowerCase().localeCompare((optionB?.obstacleAvoidanceName ?? "").toLowerCase())
                }
                onChange={onLoadSecurityChange}
            />
        </Form.Item>
    )
};
