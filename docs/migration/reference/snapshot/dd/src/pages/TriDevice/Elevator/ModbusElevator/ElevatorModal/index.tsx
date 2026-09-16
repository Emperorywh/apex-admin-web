/**
 * @description 电梯弹窗
 * @date 2026-1-19
 */
import { useEffect } from "react";
import { Modal, Form, Input, InputNumber, Select, message } from "antd";
import type { } from "antd";
import type { ModbusElevator } from "@/types/TriDevice/ModbusElevator";
import { IP_REGEXP } from "@/constants";
import { readOptions, writeOptions } from "@/constants/elevator";
import { addModbusElevator, updateModbusElevator } from "@/api";
import { useI18n } from "@/hooks/useI18n";

interface ElevatorModalProps {
    open: boolean;
    modifyElevator?: ModbusElevator;
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
    getElevators: () => void;
    setModifyElevator: (value: React.SetStateAction<ModbusElevator | undefined>) => void;
}


export default (props: ElevatorModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, modifyElevator, setOpenModal, getElevators, setModifyElevator } = props;

    const [form] = Form.useForm();

    // 新增电梯
    const handleAddElevator = (data: ModbusElevator) => {
        addModbusElevator(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                setOpenModal(false);
                form.resetFields();
                getElevators();
                message.success(t("新增电梯成功"));
            } else {
                message.warning(t("新增电梯出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("新增电梯出错") + err?.message);
            }
        })
    };

    // 更新电梯
    const handleUpdateElevator = (data: ModbusElevator) => {
        updateModbusElevator(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                setOpenModal(false);
                form.resetFields();
                getElevators();
                message.success(t("编辑电梯成功"));
            } else {
                message.warning(t("编辑电梯出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("编辑电梯出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const values = form.getFieldsValue(true);
        if (modifyElevator) {
            handleUpdateElevator(values);
        } else {
            handleAddElevator(values);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setModifyElevator(undefined);
        setOpenModal(false);
    };

    useEffect(() => {
        if (modifyElevator) {
            form.setFieldsValue(modifyElevator);
        } else {
            form.resetFields();
        }
    }, [modifyElevator])

    return (
        <Modal
            title={modifyElevator ? t("编辑电梯") : t("新增电梯")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            forceRender
        >
            <Form
                name="elevator-form"
                labelCol={{ span: 10 }}
                wrapperCol={{ span: 14 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<ModbusElevator>
                    label={t("电梯名称")}
                    name="deviceName"
                    rules={[{ required: true, message: t("请输入电梯名称") }]}
                >
                    <Input
                        placeholder={t("请输入电梯名称")}
                        maxLength={64}
                    />
                </Form.Item>

                <Form.Item<ModbusElevator>
                    label={t("电梯的ip地址")}
                    name="ip"
                    validateFirst
                    rules={[
                        { required: true, message: t("请输入IP地址") },
                        { pattern: IP_REGEXP, message: t("请输入正确的IP地址") }
                    ]}
                >
                    <Input
                        placeholder={t("请输入IP地址")}
                    />
                </Form.Item>

                <Form.Item<ModbusElevator>
                    label={t("电梯的端口号")}
                    name="port"
                    rules={[{ required: true, message: t("请输入电梯端口号") }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入电梯端口号")}
                        min={0}
                        max={65535}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<ModbusElevator>
                    label={t("电梯状态")}
                    name="deviceStatus"
                    rules={[{ required: true, message: t("请选择电梯状态") }]}
                >
                    <Select
                        placeholder={t("请选择电梯状态")}
                        allowClear
                        options={[
                            { value: true, label: t("启用") },
                            { value: false, label: t("禁用") }
                        ]}
                    />
                </Form.Item>

                <Form.Item<ModbusElevator>
                    label={t("从站号")}
                    name="slaveId"
                    rules={[{ required: true, message: "" }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入从站号")}
                        min={-2147483648}
                        max={2147483647}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<ModbusElevator>
                    label={t("读类型")}
                    name="readFunction"
                    rules={[{ required: true, message: "" }]}
                >
                    <Select
                        placeholder={t("请选择读类型")}
                        allowClear
                        options={readOptions}
                    />
                </Form.Item>

                <Form.Item<ModbusElevator>
                    label={t("故障位(读)")}
                    name="faultSignal"
                    rules={[{ required: true, message: "" }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入故障位")}
                        min={-2147483648}
                        max={2147483647}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<ModbusElevator>
                    label={t("占用标识位(读)")}
                    name="occupySignal"
                    rules={[{ required: true, message: "" }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入占用标识位")}
                        min={-2147483648}
                        max={2147483647}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<ModbusElevator>
                    label={t("前门开门到位信号位(读)")}
                    name="frontDoorFullyOpenSignal"
                    rules={[{ required: true, message: "" }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入前门开门到位信号位")}
                        min={-2147483648}
                        max={2147483647}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<ModbusElevator>
                    label={t("前门关门到位信号位(读)")}
                    name="frontDoorFullyCloseSignal"
                    rules={[{ required: true, message: "" }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入前门关门到位信号位")}
                        min={-2147483648}
                        max={2147483647}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<ModbusElevator>
                    label={t("后门开门到位信号位(读)")}
                    name="backDoorFullyOpenSignal"
                    rules={[{ required: true, message: "" }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入后门开门到位信号位")}
                        min={-2147483648}
                        max={2147483647}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<ModbusElevator>
                    label={t("后门关门到位信号位(读)")}
                    name="backDoorFullyCloseSignal"
                    rules={[{ required: true, message: "" }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入后门关门到位信号位")}
                        min={-2147483648}
                        max={2147483647}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<ModbusElevator>
                    label={t("当前楼层信号位(读)")}
                    name="currentFloor"
                    rules={[{ required: true, message: "" }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入当前楼层信号位")}
                        min={-2147483648}
                        max={2147483647}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<ModbusElevator>
                    label={t("写类型")}
                    name="writeFunction"
                    rules={[{ required: true, message: "" }]}
                >
                    <Select
                        placeholder={t("请选择写类型")}
                        allowClear
                        options={writeOptions}
                    />
                </Form.Item>

                <Form.Item<ModbusElevator>
                    label={t("前门开门信号位(写)")}
                    name="frontDoorOpeningSignal"
                    rules={[{ required: true, message: "" }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入前门开门信号位")}
                        min={-2147483648}
                        max={2147483647}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<ModbusElevator>
                    label={t("前门关门信号位(写)")}
                    name="frontDoorClosingSignal"
                    rules={[{ required: true, message: "" }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入前门开门信号位")}
                        min={-2147483648}
                        max={2147483647}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<ModbusElevator>
                    label={t("后门开门信号位(写)")}
                    name="backDoorOpeningSignal"
                    rules={[{ required: true, message: "" }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入后门开门信号位")}
                        min={-2147483648}
                        max={2147483647}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<ModbusElevator>
                    label={t("后门关门信号位(写)")}
                    name="backDoorClosingSignal"
                    rules={[{ required: true, message: "" }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入后门关门信号位")}
                        min={-2147483648}
                        max={2147483647}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<ModbusElevator>
                    label={t("目标楼层信号位(写)")}
                    name="targetFloor"
                    rules={[{ required: true, message: "" }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入目标楼层信号位")}
                        min={-2147483648}
                        max={2147483647}
                        precision={0}
                    />
                </Form.Item>

            </Form>
        </Modal>
    )
};
