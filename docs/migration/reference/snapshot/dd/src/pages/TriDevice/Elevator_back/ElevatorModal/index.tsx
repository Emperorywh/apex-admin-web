/**
 * @description 电梯新增编辑的弹窗
 * @date 2025-7-22
 */
import { useEffect } from "react";
import { Modal, Form, Input, InputNumber, Radio, Select, message } from "antd";
import type { AddElevator, ElevatorForm, ElevatorDriver, ElevatorRecord } from "@/types/TriDevice/Elevators";
import { addElevator, updateElevator } from "@/api";
import { useI18n } from "@/hooks/useI18n";

const { TextArea } = Input;

interface ElevatorModalProps {
    open: boolean;
    isModify: boolean;
    modifyRow?: ElevatorRecord;
    elevatorDrivers: ElevatorDriver[];
    getElevators: () => void;
    setModifyRow: (value: React.SetStateAction<ElevatorRecord | undefined>) => void;
    setOpenElevator: (value: React.SetStateAction<boolean>) => void;
}

export default (props: ElevatorModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, isModify, modifyRow, elevatorDrivers, getElevators, setModifyRow, setOpenElevator } = props;

    const [form] = Form.useForm();

    const handleAddElevator = (data: AddElevator) => {
        addElevator(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                getElevators();
                setOpenElevator(false);
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

    const handleUpdateElevator = (data: AddElevator) => {
        updateElevator(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                getElevators();
                setOpenElevator(false);
                message.success(t("更新电梯成功"));
            } else {
                message.warning(t("更新电梯出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("更新电梯出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const { deviceConfig, ...rest } = form.getFieldsValue(true);
        // 转化数组为对象
        let config: object = {};
        try {
            config = JSON.parse(deviceConfig);
        } catch (error) {
            message.error(t("解析json格式出错") + String(error));
            return;
        }
        const data: AddElevator = {
            ...rest,
            deviceConfig: config
        };
        if (isModify) {
            handleUpdateElevator(data);
        } else {
            handleAddElevator(data);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setModifyRow(undefined);
        setOpenElevator(false);
    };

    useEffect(() => {
        if (modifyRow) {
            // form.setFieldsValue(modifyRow);
            const { deviceConfig, ...rest } = modifyRow;
            const config: string = JSON.stringify(deviceConfig, null, 4);
            form.setFieldsValue({
                ...rest,
                deviceConfig: config
            });
        }
    }, [modifyRow])

    return (
        <Modal
            title={isModify ? t("编辑电梯") : t("新增电梯")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
        >
            <Form
                name="elevatorform"
                labelCol={{ span: 8 }}
                wrapperCol={{ span: 16 }}
                autoComplete="off"
                form={form}
                initialValues={{
                    deviceStatus: true
                }}
            >
                <Form.Item<ElevatorForm>
                    label={t("设备名称")}
                    name="deviceName"
                    rules={[{ required: true, message: t("请输入设备名称") }]}
                >
                    <Input
                        placeholder={t("请输入设备名称")}
                        maxLength={64}
                        showCount
                    />
                </Form.Item>

                <Form.Item<ElevatorForm>
                    label={t("驱动名称")}
                    name="driverKey"
                    rules={[{ required: true, message: t("请输入驱动名称") }]}
                >
                    <Select
                        placeholder={t("请选择驱动")}
                        options={elevatorDrivers}
                        fieldNames={{ label: "name", value: "key" }}
                        onChange={(value) => form.setFieldValue("deviceConfig", JSON.stringify(elevatorDrivers.find(d => d.key === value)?.driverProtocol || {}, null, 4))}
                        onDeselect={() => form.setFieldValue("deviceConfig", undefined)}
                    />
                </Form.Item>

                <Form.Item<ElevatorForm>
                    label={t("电梯楼层")}
                    name="floors"
                    rules={[{ required: true, message: t("请输入电梯楼层") }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入电梯楼层")}
                        min={-200}
                        max={200}
                        step={1}
                    />
                </Form.Item>

                <Form.Item<ElevatorForm>
                    label={t("IP地址")}
                    name="ip"
                    rules={[{ required: true, message: t("请输入ip地址") }]}
                >
                    <Input
                        placeholder={t("请输入ip地址")}
                        maxLength={64}
                        showCount
                    />
                </Form.Item>

                <Form.Item<ElevatorForm>
                    label={t("端口")}
                    name="port"
                    rules={[{ required: true, message: t("请输入端口") }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入端口")}
                        min={0}
                        max={65535}
                        step={1}
                    />
                </Form.Item>

                <Form.Item<ElevatorForm>
                    label={t("是否启用")}
                    name="deviceStatus"
                    rules={[{ required: true, message: t("请选择是否启用") }]}
                >
                    <Radio.Group
                        name="deviceStatus"
                        options={[
                            { value: true, label: t("启用") },
                            { value: false, label: t("禁用") }
                        ]}
                    />
                </Form.Item>

                <Form.Item<ElevatorForm>
                    label={t("设备配置")}
                    name="deviceConfig"
                    rules={[{ required: true, message: t("请输入设备配置") }]}
                >
                    <TextArea
                        placeholder={t("请输入设备配置")}
                        autoSize={{ minRows: 1, maxRows: 10 }}
                    />
                </Form.Item>

            </Form>
        </Modal>
    )
};
