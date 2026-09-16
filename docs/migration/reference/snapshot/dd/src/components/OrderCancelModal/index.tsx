/**
 * @description 取消订单时填写原因的表单
 * @date 2025-6-16
 */
import { Modal, Form, Input, message } from "antd";
import { orderTaskOperate } from "@/api";
import type { TaskOperate } from "@/types/OrderRecord";
import { useI18n } from "@/hooks/useI18n";

type FieldType = {
    cancelReason: string;
}

interface CancelModalProps {
    open: boolean;
    orderKey: string;
    setOpenCancelModal: (value: React.SetStateAction<boolean>) => void;
    run?: () => void;
}

export default (props: CancelModalProps) => {

    const { open, orderKey, setOpenCancelModal, run } = props;

    const { t } = useI18n();

    const [form] = Form.useForm<FieldType>();

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate || !orderKey) return;
        const values = form.getFieldsValue();
        const data: TaskOperate = {
            orderTaskKey: orderKey,
            cancelReason: values.cancelReason,
            operate: "CMD_ORDER_CANCEL"
        };
        orderTaskOperate(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                run?.();
                setOpenCancelModal(false);
                form.resetFields();
                message.success(t("订单操作成功"));
            } else {
                message.warning(t("订单操作失败") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("订单操作失败") + err?.message);
            }
        })
    };

    const handleCancel = () => {
        form.resetFields();
        setOpenCancelModal(false);
    };

    return (
        <Modal
            title={t("取消原因")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
        >
            <Form
                name="cancel_reason_form"
                labelCol={{ span: 4 }}
                wrapperCol={{ span: 20 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<FieldType>
                    label={t("取消原因")}
                    name="cancelReason"
                    rules={[{ required: true, message: t("请输入取消订单的原因") }]}
                >
                    <Input
                        placeholder={t("请输入取消订单的原因")}
                        maxLength={20}
                        showCount
                    />
                </Form.Item>
            </Form>
        </Modal>
    )
};
