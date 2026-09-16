/**
 * @description 载具类型的新增/编辑弹窗
 * @date 2025-5-19
 */
import { useEffect } from "react";
import { Modal, Form, Input, InputNumber, message } from "antd";
import { createCarrier, updateCarrier } from "@/api";
import type { CreateCarrierParams, UpdateCarrierParams, CarrierRecord } from "@/types/VehicleDeploy/CarrierType";
import { useI18n } from "@/hooks/useI18n";

interface CarrierModalProps {
    open: boolean;
    isModify: boolean;
    modifyRow?: CarrierRecord;
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
    getCarriers: () => void;
}

export default (props: CarrierModalProps) => {

    const { open, isModify, modifyRow, setOpenModal, getCarriers } = props;
    /* 国际化翻译方法 */ const { t } = useI18n();

    const [form] = Form.useForm();

    /**
     * 新增载具类型
     * @param values 表单数据
     */
    const handleAdd = (values: CreateCarrierParams) => {
        createCarrier(values).then(res => {
            if (res.code === 200 && res.message === "success") {
                getCarriers();
                setOpenModal(false);
                form.resetFields();
                message.success(t("添加载具类型成功"));
            } else {
                message.warning(t("添加载具类型出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("添加载具类型出错") + err?.message);
            }
        })
    };

    /**
     * 编辑载具类型
     * @param values 表单数据
     */
    const handleUpdate = (values: UpdateCarrierParams) => {
        updateCarrier(values).then(res => {
            if (res.code === 200 && res.message === "success") {
                getCarriers();
                setOpenModal(false);
                form.resetFields();
                message.success(t("编辑载具类型成功"));
            } else {
                message.warning(t("编辑载具类型出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("编辑载具类型出错") + err?.message);
            }
        })
    };

    /**
     * 弹窗确认事件
     */
    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            if (isModify && modifyRow?.id) {
                handleUpdate({ ...values, id: modifyRow.id });
            } else {
                handleAdd(values);
            }
        } catch { }
    };

    /**
     * 弹窗取消事件
     */
    const handleCancel = () => {
        setOpenModal(false);
        form.resetFields();
    };

    /**
     * 编辑时回填表单数据
     */
    useEffect(() => {
        if (isModify && modifyRow) {
            form.setFieldsValue({
                carrierName: modifyRow.carrierName,
                carrierCode: modifyRow.carrierCode,
                carrierLength: modifyRow.carrierLength,
                carrierWidth: modifyRow.carrierWidth,
            });
        }
    }, [modifyRow])

    return (
        <Modal
            title={isModify ? t("编辑载具类型") : t("新增载具类型")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
            destroyOnClose
        >
            <Form
                name="carrier-form"
                labelCol={{ span: 8 }}
                wrapperCol={{ span: 14 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<CreateCarrierParams>
                    label={t("载具名称")}
                    name="carrierName"
                    rules={[{ required: true, message: t("请输入载具名称") }]}
                >
                    <Input
                        placeholder={t("请输入载具名称")}
                        maxLength={64}
                        showCount
                    />
                </Form.Item>

                <Form.Item<CreateCarrierParams>
                    label={t("载具编码")}
                    name="carrierCode"
                    rules={[{ required: true, message: t("请输入载具编码") }]}
                >
                    <Input
                        placeholder={t("请输入载具编码")}
                        maxLength={64}
                        showCount
                    />
                </Form.Item>

                <Form.Item<CreateCarrierParams>
                    label={t("载具长度(mm)")}
                    name="carrierLength"
                    rules={[{ required: true, message: t("请输入载具长度") }]}
                >
                    <InputNumber
                        placeholder={t("请输入载具长度")}
                        min={1}
                        style={{ width: "100%" }}
                    />
                </Form.Item>

                <Form.Item<CreateCarrierParams>
                    label={t("载具宽度(mm)")}
                    name="carrierWidth"
                    rules={[{ required: true, message: t("请输入载具宽度") }]}
                >
                    <InputNumber
                        placeholder={t("请输入载具宽度")}
                        min={1}
                        style={{ width: "100%" }}
                    />
                </Form.Item>
            </Form>
        </Modal>
    )
};
