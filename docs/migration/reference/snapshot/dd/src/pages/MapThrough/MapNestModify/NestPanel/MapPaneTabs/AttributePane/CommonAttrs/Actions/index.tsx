/**
 * @description 自定义动作
 * @date 2025-8-11
 */
import { useEffect } from "react";
import { Form, Card, Input, Button, Space, Divider, Select } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import type Konva from "konva";
import { transformActionsAttr } from "@/utils/format";
import { blockingOptions } from "@/constants";
import { useI18n } from "@/hooks/useI18n";
import { refreshActionBadges } from "@/plugins/konva/actions";

interface ActionsProps {
    selectShapes: Konva.Shape[];
}

export default (props: ActionsProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();
    const actions = Form.useWatch(values => transformActionsAttr(values?.actions), form);

    useEffect(() => {
        if (!actions) return;
        selectShapes.forEach(shape => {
            const { attrs: { data } } = shape;
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    actions
                }
            });
        })
        // actions 写入 shape.data 后，立即刷新动作角标（增删/改色，D23）；
        // onActionHover 由 ActionBadgeLayer 预先存入 layer attr，此处无需传入
        const stage = selectShapes[0]?.getStage();
        if (stage) refreshActionBadges(stage);
    }, [actions])

    // 回显所有的动作
    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data } } = shape;
        form.setFieldValue("actions", data?.actions || []);
    }, [selectShapes])

    return (
        <>
            <Divider style={{ borderColor: "#1677FF", fontWeight: 550 }} plain>{t("自定义动作")}</Divider>
            <Form.List name="actions">
                {(fields, { add, remove }) => (
                    <div style={{ display: "flex", rowGap: 16, flexDirection: "column" }}>
                        {fields.map((field) => (
                            <Card
                                size="small"
                                title={t("自定义动作 {index}", { index: field.name + 1 })}
                                key={field.key}
                                extra={
                                    <CloseOutlined
                                        onClick={() => {
                                            remove(field.name);
                                        }}
                                    />
                                }
                            >
                                <Form.Item
                                    label={t("动作类型")}
                                    name={[field.name, "actionType"]}
                                    rules={[{ required: true, message: t("请输入动作类型") }]}
                                >
                                    <Input
                                        placeholder={t("动作类型")}
                                        maxLength={64}
                                    />
                                </Form.Item>

                                <Form.Item
                                    label={t("动作描述")}
                                    name={[field.name, "actionDescription"]}
                                    rules={[{ required: true, message: t("请输入动作描述") }]}
                                >
                                    <Input
                                        placeholder={t("动作描述")}
                                        maxLength={64}
                                    />
                                </Form.Item>

                                <Form.Item
                                    label={t("阻塞类型")}
                                    name={[field.name, "blockingType"]}
                                    rules={[{ required: true, message: t("请选择阻塞类型") }]}
                                >
                                    <Select
                                        allowClear
                                        placeholder={t("请选择阻塞类型")}
                                        options={blockingOptions}
                                    />
                                </Form.Item>

                                {/* 动作参数 Form.List */}
                                <Form.Item label={t("动作参数")}>
                                    <Form.List name={[field.name, "actionParameters"]}>
                                        {(subFields, subOpt) => (
                                            <div style={{ display: "flex", flexDirection: "column", rowGap: 16 }}>
                                                {subFields.map((subField) => (
                                                    <Space key={subField.key}>
                                                        <Form.Item
                                                            noStyle
                                                            name={[subField.name, "key"]}
                                                            rules={[{ required: true, message: t("请输入参数名") }]}

                                                        >
                                                            <Input
                                                                placeholder={t("参数名")}
                                                                maxLength={64}
                                                            />
                                                        </Form.Item>
                                                        <Form.Item
                                                            noStyle
                                                            name={[subField.name, "value"]}
                                                            rules={[{ required: true, message: t("请输入参数值") }]}
                                                        >
                                                            <Input
                                                                placeholder={t("参数值")}
                                                                maxLength={64}
                                                            />
                                                        </Form.Item>
                                                        <CloseOutlined
                                                            onClick={() => {
                                                                subOpt.remove(subField.name);
                                                            }}
                                                        />
                                                    </Space>
                                                ))}
                                                <Button type="dashed" onClick={() => subOpt.add()} block>
                                                    {t("+ 添加动作参数")}
                                                </Button>
                                            </div>
                                        )}
                                    </Form.List>
                                </Form.Item>

                                {/* 条件标识：仅当该条件满足时才执行当前动作 */}
                                <Form.Item
                                    label={t("条件标识")}
                                    name={[field.name, "conditionStr"]}
                                >
                                    <Input
                                        placeholder={t("条件标识")}
                                        maxLength={64}
                                    />
                                </Form.Item>
                            </Card>
                        ))}

                        <Button type="dashed" onClick={() => add()} block>
                            {t("+ 添加动作")}
                        </Button>
                    </div>
                )}
            </Form.List>
        </>
    )
};
