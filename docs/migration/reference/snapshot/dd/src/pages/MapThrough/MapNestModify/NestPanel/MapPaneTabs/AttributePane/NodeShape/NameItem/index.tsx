/**
 * @description 节点的名称表单项
 * @date 2025-7-9
 */
import { useEffect, useRef } from "react";
import { Form, Input } from "antd";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface NameItemProps {
    selectShapes: Konva.Shape[];
}

export default (props: NameItemProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    // 记录初始化的时候节点的名字，如果不符合名称修改条件的话，还原初始化的时候的名字
    const initName = useRef<string>("");
    const form = Form.useFormInstance();

    const onNodeNameChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectShapes?.length) return;
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

    const onNodeNameBlur = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectShapes?.length) return;
        const value = event.target.value;
        const [shape] = selectShapes;
        const stage = shape.getStage();
        // 找到是节点的且名字相同的
        const names = stage?.find((shape: Konva.Shape) => shape.attrs?.enableSelect == "node" && shape.attrs?.data?.name === value);
        if (names?.length !== 1 || !value) {
            const { data } = shape.attrs;
            shape.setAttrs({
                data: {
                    ...data,
                    name: initName.current || ""
                }
            });
            form.setFieldValue("name", initName.current);
        }
    };

    useEffect(() => {
        if (selectShapes?.length !== 1) return;
        const [shape] = selectShapes;
        const { data: { name } } = shape.attrs;
        form.setFieldValue("name", name);
        initName.current = name;
    }, [selectShapes])

    if (selectShapes?.length === 1) {
        return (
            <Form.Item
                label={t("名称")}
                name="name"
                validateFirst
                rules={[
                    { required: true, message: t("请输入名称") },
                    () => ({
                        validator(_, value) {
                            const [shape] = selectShapes;
                            const stage = shape.getStage();
                            // 找到是节点的且名字相同的
                            const names = stage?.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "node" && shape.attrs?.data?.name === value);
                            if (names?.length === 1) {
                                return Promise.resolve();
                            }
                            return Promise.reject(new Error(t("节点名重复")));
                        }
                    })
                ]}
            >
                <Input
                    placeholder={t("请输入节点名称")}
                    onChange={onNodeNameChange}
                    maxLength={64}
                    showCount
                    onBlur={onNodeNameBlur}
                />
            </Form.Item>
        )
    }
    return null;
};
