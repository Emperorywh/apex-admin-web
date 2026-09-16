/**
 * @description 订单模拟的弹窗
 * @date 2025-6-24
 */
import { memo, useEffect, useState } from "react";
import { Modal, Form, Select, message } from "antd";
import { mockDispatch, getSimpleVehicles } from "@/api";
import type { MockDispatch } from "@/types/OverLook";
import { SimpleVehicle } from "@/types/VehicleDeploy/GroupType";
import { useI18n } from "@/hooks/useI18n";

type FieldType = {
    vehicleKey: string;
}

interface MockDispatchModalProps {
    open: boolean;
    orderTaskKey: string;
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
}

export default memo((props: MockDispatchModalProps) => {

    const { open, orderTaskKey, setOpenModal } = props;

    const { t } = useI18n();

    const [vehicleList, setVehicleList] = useState<SimpleVehicle[]>([]);

    const [form] = Form.useForm<FieldType>();

    const getVehicles = () => {
        getSimpleVehicles().then(res => {
            if (res.code === 200 && res.message === "success") {
                setVehicleList(res?.data || []);
            } else {
                message.warning(t("查询车辆列表出错"), res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询车辆列表出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const { vehicleKey } = form.getFieldsValue();
        const data: MockDispatch = {
            orderTaskKey,
            vehicleKey
        };
        mockDispatch(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                setOpenModal(false);
                message.success(t("模拟订单成功"));
            } else {
                message.warning(t("模拟订单出错") + ": " + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("模拟订单出错") + err?.message);
            }
        })
    };

    const handleCancel = () => {
        setOpenModal(false);
    };

    useEffect(() => {
        getVehicles();
    }, [])

    return (
        <Modal
            title={t("订单检测")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
        >
            <Form
                name="simulate-form"
                labelCol={{ span: 4 }}
                wrapperCol={{ span: 20 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<FieldType>
                    label={t("车辆")}
                    name="vehicleKey"
                    rules={[{ required: true, message: t("请选择车辆!") }]}
                >
                    <Select
                        placeholder={t("请选择检测车辆")}
                        allowClear
                        showSearch
                        options={vehicleList}
                        fieldNames={{ label: "name", value: "key" }}
                        optionFilterProp="name"
                    />
                </Form.Item>
            </Form>
        </Modal>
    )
});
