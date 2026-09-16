/**
 * @description 可编辑表格的组件
 * @date 2025-10-24
 */
import React from "react";
import { Form } from "antd";
import type { GetRef } from "antd";

type FormInstance<T> = GetRef<typeof Form<T>>;

export interface EditableRowProps {
    index: number;
    EditableContext: React.Context<FormInstance<any> | null>;
}

const EditableRow: React.FC<EditableRowProps> = ({ index, EditableContext, ...props }) => {

    const [form] = Form.useForm();

    return (
        <Form
            form={form}
            component={false}
            autoComplete="off"
        >
            <EditableContext.Provider value={form}>
                <tr {...props} />
            </EditableContext.Provider>
        </Form>
    );
};

export default EditableRow;
