/**
 * @description 编辑表格的每一行
 * @date 2025-10-24
 */
import { useContext } from "react";
import { Form, Input, InputNumber, Switch, Select, message } from "antd";
import type { GetRef } from "antd";
import type { ChildConfig } from "@/types/DispatchHub/typing";
import { useI18n } from "@/hooks/useI18n";

type FormInstance<T> = GetRef<typeof Form<T>>;

export interface EditableCellProps {
    title: React.ReactNode;
    editable: boolean;
    dataIndex: keyof ChildConfig;
    record: ChildConfig;
    EditableContext: React.Context<FormInstance<any> | null>;
    handleSave: (record: ChildConfig) => void;
}

const EditableCell: React.FC<React.PropsWithChildren<EditableCellProps>> = ({
    title,
    editable,
    children,
    dataIndex,
    record,
    handleSave,
    EditableContext,
    ...restProps
}) => {
    const form = useContext(EditableContext)!;

    /* 国际化翻译方法 */
    const { t } = useI18n();

    const save = async () => {
        try {
            const values = await form.validateFields();
            handleSave({ ...record, ...values });
        } catch (e) {
            message.warning(t("配置出错，不规范值"));
        }
    };

    // 计算INT类型的范围
    const computeIntRange = (range: string) => {
        // 匹配数字，包括逗号和点，可以匹配小括号出来
        const matches = range.match(/[\d,.]+/g);
        if (matches && matches.length) {
            const [n1, n2] = matches[0]?.split(",");
            // 将匹配的字符串转换为数字
            const min = parseInt(n1, 10);
            const max = parseInt(n2, 10);
            // 返回范围
            return {
                min: range.startsWith("[") ? Math.min(min, max) : Math.min(min, max) + 1,
                max: range.endsWith("]") ? Math.max(min, max) : Math.max(min, max) - 1
            };
        }
    };

    // 组合选项
    const transformOptions = (range: string) => {
        const optList: string[] = range.split(";");
        const options = optList.map(opt => ({
            label: opt,
            value: opt
        }));
        return options;
    };

    // 返回不同的组件
    const renderControl = () => {
        const { configValueType, configValueRange } = record;
        if (configValueType === "int") {
            const { min, max } = computeIntRange(configValueRange) || {};
            return (
                <InputNumber
                    style={{ width: "100%" }}
                    placeholder={t("请输入配置值")}
                    min={min}
                    max={max}
                    precision={0}
                    onPressEnter={save}
                    onBlur={save}
                />
            )
        }
        if (configValueType === "bool") {
            return (
                <Switch
                    onChange={save}
                />
            )
        }
        if (configValueType === "enum" || configValueType === "select") {
            const options = transformOptions(configValueRange);
            return (
                <Select
                    allowClear
                    mode={configValueType === "select" ? "multiple" : undefined}
                    placeholder={t("请选择配置值")}
                    options={options}
                    onChange={save}
                />
            )
        }
        /**
         * double类型：数字输入框，支持小数点输入
         * 复用configValueRange的范围配置，但允许小数精度
         */
        if (configValueType === "double") {
            const { min, max } = computeIntRange(configValueRange) || {};
            return (
                <InputNumber
                    style={{ width: "100%" }}
                    placeholder={t("请输入配置值")}
                    min={min}
                    max={max}
                    step={0.01}
                    onPressEnter={save}
                    onBlur={save}
                />
            )
        }
        if (configValueType === "string") {
            return (
                <Input
                    placeholder={t("请输入配置值")}
                    allowClear
                    onPressEnter={save}
                    onBlur={save}
                />
            )
        }
    };

    // 转化值
    const transformConfigValue = () => {
        const { configValueType, configValue } = record;
        if (configValueType === "bool") {
            return typeof configValue === "boolean" ? configValue : configValue === "true"
        } else if (configValueType === "int") {
            return typeof configValue === "number" ? configValue : parseInt(configValue, 10);
        } else if (configValueType === "double") {
            /**
             * double类型值转换：使用parseFloat解析，支持小数点
             */
            return typeof configValue === "number" ? configValue : parseFloat(configValue);
        } else if (configValueType === "select") {
            // "1;2;3"
            return configValue.includes(";") ? configValue.split(";") : configValue;
        }
        return configValue;
    };

    /**
     * 非编辑态下透传 title 给 <td>：
     * rc-table 在 ellipsis.showTitle 为 true 时，会把单元格完整文本通过 title 传给自定义 cell，
     * 之前解构后未透传，导致文字省略时悬停无法显示完整内容；
     * 编辑态（配置值列）不透传，因为其 title 是 onCell 传入的列标题（如“配置值”），并非单元格内容
     */
    const tdTitle = !editable && typeof title === "string" ? title : undefined;

    return (
        <td {...restProps} title={tdTitle}>
            {
                editable ? (
                    <Form.Item
                        style={{ margin: 0 }}
                        name={dataIndex}
                        initialValue={transformConfigValue()}
                        rules={[{ required: false, message: t("{title}为必填项", { title: String(title) }) }]}
                    >
                        {
                            renderControl()
                        }
                    </Form.Item>
                ) : (
                    children
                )
            }
        </td>
    );
};

export default EditableCell;
