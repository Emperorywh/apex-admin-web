/**
 * @description 处理车辆的弹窗表单
 * @date 2025-6-4
 */
import { useEffect, useState } from "react";
import { Modal, Form, Input, Select, Radio, InputNumber, message } from "antd";
import { addVehicle, updateVehicle } from "@/api";
import type { VehicleForm, QueryVehiclesParams, UnRelationSimpleVehicle } from "@/types/VehicleDeploy/VehicleType";
import { agvTypes } from "@/constants/vehicle";
import { useI18n } from "@/hooks/useI18n";

interface VehicleFormProps {
    open: boolean;
    modifyRow?: VehicleForm;
    isModify: boolean;
    searchParams: QueryVehiclesParams;
    unRelativeVehicles: UnRelationSimpleVehicle[];
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
    getPageVehicles: (data: QueryVehiclesParams) => void;
    getUnRelationVehicles: () => void;
}

export default (props: VehicleFormProps) => {

    const { open, modifyRow, isModify, searchParams, unRelativeVehicles, setOpenModal, getPageVehicles, getUnRelationVehicles } = props;
    const [form] = Form.useForm<VehicleForm>();

    /* 国际化翻译方法，用于将车辆弹窗表单的所有文案进行多语言转换 */
    const { t } = useI18n();

    // 弹窗确定的loading
    const [confirmLoading, setConfirmLoading] = useState<boolean>(false);



    const handleAddVehicle = (values: VehicleForm) => {
        setConfirmLoading(true);
        addVehicle(values).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("添加车辆成功") + res?.message);
                getUnRelationVehicles();
                getPageVehicles(searchParams);
                setOpenModal(false);
            } else {
                message.warning(t("添加车辆出错") + res?.message);
            }
            setConfirmLoading(false);
        }).catch(err => {
            if (err) {
                setOpenModal(false);
                setConfirmLoading(false);
                message.error(t("添加车辆出错") + err?.message);
            }
        })
    };

    const handleEditVehicle = (values: VehicleForm) => {
        setConfirmLoading(true);
        updateVehicle(values).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("编辑车辆成功") + res?.message);
                getPageVehicles(searchParams);
                setOpenModal(false);
            } else {
                message.warning(t("编辑车辆出错") + res?.message);
            }
            setConfirmLoading(false);
        }).catch(err => {
            if (err) {
                setOpenModal(false);
                setConfirmLoading(false);
                message.error(t("编辑车辆出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const values: VehicleForm = form.getFieldsValue();
        if (isModify) {
            handleEditVehicle(values);
        } else {
            handleAddVehicle(values);
        }
    };

    const handleCancel = () => {
        setOpenModal(false);
        form.resetFields();
    };

    useEffect(() => {
        getUnRelationVehicles();
    }, [])

    useEffect(() => {
        if (modifyRow) {
            form.setFieldsValue(modifyRow);
        } else {
            form.resetFields();
        }
    }, [modifyRow])

    return (
        <Modal
            title={isModify ? t("编辑车辆") : t("添加车辆")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
            confirmLoading={confirmLoading}
            forceRender={false}
        >
            <Form
                name="vehicle-form"
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 18 }}
                labelAlign="left"
                autoComplete="off"
                form={form}
                initialValues={{
                    dispatchState: "ENABLE"
                }}
            >
                <Form.Item<VehicleForm>
                    label={t("车辆名称")}
                    name="agvName"
                    rules={[{ required: true, message: t("请输入车辆名称") }]}
                >
                    <Input
                        maxLength={64}
                        showCount
                        placeholder={t("请输入车辆名称")}
                    />
                </Form.Item>

                <Form.Item<VehicleForm>
                    label={t("车辆类型")}
                    name="agvType"
                    rules={[{ required: true, message: t("请选择车辆类型") }]}
                >
                    <Select
                        placeholder={t("请选择车辆类型")}
                        options={agvTypes?.map(o => ({ ...o, label: t(o.label as string) }))}
                    />
                </Form.Item>

                <Form.Item<VehicleForm>
                    label={t("关联上报车辆")}
                    name="agvKey"
                    rules={[{ required: true, message: t("请选择关联上报车辆") }]}
                >
                    <Select
                        showSearch
                        disabled={isModify}
                        placeholder={t("请选择关联上报车辆")}
                        options={unRelativeVehicles}
                        fieldNames={{ label: "name", value: "key" }}
                    />
                </Form.Item>

                <Form.Item<VehicleForm>
                    label={t("调度状态")}
                    name="dispatchState"
                    rules={[{ required: true, message: t("请选择调度状态") }]}
                >
                    <Radio.Group
                        options={[
                            { value: "ENABLE", label: t("启用") },
                            { value: "DISABLE", label: t("禁用") }
                        ]}
                    />
                </Form.Item>

                <Form.Item<VehicleForm>
                    label={t("长(m)")}
                    name="length"
                    rules={[{ required: true, message: t("请输入车辆长度") }]}
                >
                    <InputNumber
                        min={0}
                        max={100}
                        precision={3}
                        placeholder={t("请输入车辆长度")}
                        style={{ width: "100%" }}
                    />
                </Form.Item>

                <Form.Item<VehicleForm>
                    label={t("宽(m)")}
                    name="width"
                    rules={[{ required: true, message: t("请输入车辆宽度") }]}
                >
                    <InputNumber
                        min={0}
                        max={100}
                        precision={3}
                        placeholder={t("请输入车辆宽度")}
                        style={{ width: "100%" }}
                    />
                </Form.Item>

                <Form.Item<VehicleForm>
                    label={t("载货长(m)")}
                    name="loadLength"
                    rules={[{ required: true, message: t("请输入车辆载货长度") }]}
                >
                    <InputNumber
                        min={0}
                        max={100}
                        precision={3}
                        placeholder={t("请输入车辆载货长度")}
                        style={{ width: "100%" }}
                    />
                </Form.Item>

                <Form.Item<VehicleForm>
                    label={t("载货宽(m)")}
                    name="loadWidth"
                    rules={[{ required: true, message: t("请输入车辆载货宽度") }]}
                >
                    <InputNumber
                        min={0}
                        max={100}
                        precision={3}
                        placeholder={t("请输入车辆载货宽度")}
                        style={{ width: "100%" }}
                    />
                </Form.Item>

                <Form.Item<VehicleForm>
                    label={t("偏移量(m)")}
                    name="centerOffset"
                    tooltip={t("车辆实际运动中心距离配置长、宽矩形中心的距离长度，实际运动中心靠近车尾为正数，靠近车头为负数")}
                    rules={[{ required: true, message: t("请输入车辆中心偏移量") }]}
                >
                    <InputNumber
                        min={-100}
                        max={100}
                        precision={3}
                        placeholder={t("车辆中心偏移量 = (车头长 - 车尾长) / 2")}
                        style={{ width: "100%" }}
                    />
                </Form.Item>

            </Form>
        </Modal>
    )
};
