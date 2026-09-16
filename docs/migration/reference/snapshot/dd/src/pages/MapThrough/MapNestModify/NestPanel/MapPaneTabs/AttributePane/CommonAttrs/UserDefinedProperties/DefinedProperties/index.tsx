/**
 * @description 用户的自定义属性 改造
 * @date 2026-3-9
 */
import { useEffect } from "react";
import { Form, Divider, Input, Space, Button } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import type Konva from "konva";
import { transformUserDefined, feedbackUserDefinedProperties, excludeUserDefined } from "@/utils/format";
import { useI18n } from "@/hooks/useI18n";

interface DefinedPropertiesProps {
    selectShapes: Konva.Shape[];
}

export default (props: DefinedPropertiesProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    const userDefinedProperties = Form.useWatch(values => transformUserDefined(values?.userDefinedProperties), form);

    // 自定义属性有变化的时候，合并自定义属性
    useEffect(() => {
        if (!userDefinedProperties) return;
        // 批量修改，外面没放开，这里批量修改无所谓
        selectShapes.forEach(shape => {
            const { attrs: { data } } = shape;
            const deviceAttrs = excludeUserDefined(data?.userDefinedProperties);
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    userDefinedProperties: Object.assign(deviceAttrs, userDefinedProperties)
                }
            });
        })
    }, [userDefinedProperties])

    // 回显自定义属性
    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data } } = shape;
        const isEdgeShape = selectShapes.every(shape => shape.attrs?.enableSelect === "edge") || selectShapes.every(shape => shape.attrs?.data?.type === "charge");
        // 回显的时候只针对路径和充电站点时过滤掉三方设备的参数，其他节点不需要过滤
        const feedbackProperties = feedbackUserDefinedProperties(data?.userDefinedProperties || {}, isEdgeShape);
        form.setFieldValue("userDefinedProperties", feedbackProperties);
    }, [selectShapes])

    return (
        <>
            <Divider style={{ borderColor: "#1677FF", fontWeight: 550 }} plain>{t("自定义属性")}</Divider>
            <Form.List name="userDefinedProperties">
                {(fields, { add, remove }) => (
                    <>
                        {fields.map(({ key, name, ...restField }) => (
                            <Space key={key} style={{ display: "flex", marginBottom: 8 }} align="baseline">
                                <Form.Item
                                    {...restField}
                                    name={[name, "key"]}
                                    rules={[{ required: true, message: t("请输入属性名") }]}
                                >
                                    <Input
                                        placeholder={t("属性名")}
                                        maxLength={64}
                                    />
                                </Form.Item>
                                <Form.Item
                                    {...restField}
                                    name={[name, "value"]}
                                    validateTrigger="onBlur"
                                    rules={[{ required: true, message: t("请输入属性值") }]}
                                >
                                    <Input
                                        placeholder={t("属性值")}
                                        maxLength={64}
                                    />
                                </Form.Item>
                                <DeleteOutlined onClick={() => remove(name)} />
                            </Space>
                        ))}
                        <Form.Item noStyle>
                            <Button
                                type="dashed"
                                onClick={() => add()}
                                block
                                icon={<PlusOutlined />}
                            >
                                {t("添加属性")}
                            </Button>
                        </Form.Item>
                    </>
                )}
            </Form.List>
        </>
    )
};
