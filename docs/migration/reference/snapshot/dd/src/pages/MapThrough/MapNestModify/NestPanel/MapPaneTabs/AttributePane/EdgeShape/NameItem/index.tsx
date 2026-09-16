/**
 * @description 路径的名称FormItem
 * @date 2025-7-10
 */
import { useEffect, useCallback } from "react";
import { Form, Input } from "antd";
import Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface NameItemProps {
    stage: Konva.Stage | null;
    selectShapes: Konva.Shape[];
}

export default (props: NameItemProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { stage, selectShapes } = props;

    const form = Form.useFormInstance();

    const onNameChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
        const value = evt.target.value;
        const [shape] = selectShapes;
        const { data } = shape.attrs;
        shape.setAttrs({
            data: {
                ...data,
                name: value
            }
        });
    };

    const checkDuplicateName = useCallback((_: unknown, value: string) => {
        if (!value || !stage) return Promise.resolve();
        const [currentShape] = selectShapes;
        const edgeShapes: Konva.Shape[] = stage.find(
            (shape: Konva.Shape) => shape.attrs?.enableSelect === "edge"
        );
        const isDuplicate = edgeShapes.some(
            shape => shape.attrs.id !== currentShape.attrs.id
                && shape.attrs.data?.name === value
        );
        if (isDuplicate) {
            return Promise.reject(t("路径名称不能重复"));
        }
        return Promise.resolve();
    }, [stage, selectShapes]);

    useEffect(() => {
        if (!selectShapes?.length || selectShapes?.length !== 1) return;
        const [shape] = selectShapes;
        const { data: { name } } = shape.attrs;
        form.setFieldValue("name", name);
    }, [selectShapes])

    if (selectShapes?.length === 1) {
        return (
            <Form.Item
                label={t("路径名称")}
                name="name"
                validateTrigger="onBlur"
                rules={[
                    { required: true, message: t("请输入名称") },
                    { validator: checkDuplicateName }
                ]}
            >
                <Input
                    placeholder={t("请输入名称")}
                    maxLength={64}
                    showCount
                    onChange={onNameChange}
                />
            </Form.Item>
        )
    }
    return null;
};
