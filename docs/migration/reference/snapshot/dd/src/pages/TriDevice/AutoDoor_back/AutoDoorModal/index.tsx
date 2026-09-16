/**
 * @description 自动门添加编辑的弹窗
 * @date 2025-7-21
 */
import { useEffect } from "react";
import { Modal, Form, Input, InputNumber, message, Select, Radio } from "antd";
import { addAutoDoor, updateAutoDoor } from "@/api";
import type { AutoDoorParams, AutoDoorDriver, AutoDoorRecord } from "@/types/TriDevice/AutoDoor";
import { useI18n } from "@/hooks/useI18n";

const { TextArea } = Input;

interface AutoDoorModalProps {
    open: boolean;
    isModify: boolean;
    modifyRow?: AutoDoorRecord;
    doorDrivers: AutoDoorDriver[];
    setDoorModal: (value: React.SetStateAction<boolean>) => void;
    getAutoDoors: () => void;
    setModifyRow: (value: React.SetStateAction<AutoDoorRecord | undefined>) => void;
}

export default (props: AutoDoorModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, isModify, modifyRow, doorDrivers, setDoorModal, getAutoDoors, setModifyRow } = props;


    const [form] = Form.useForm<AutoDoorRecord>();

    const handleAddAutoDoor = (data: AutoDoorParams) => {
        addAutoDoor(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                getAutoDoors();
                setDoorModal(false);
                message.success(t("添加自动门成功"));
            } else {
                message.warning(t("添加自动门出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("添加自动门出错") + err?.message);
            }
        })
    };

    const handleUpdateAutoDoor = (data: AutoDoorParams) => {
        updateAutoDoor(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                getAutoDoors();
                setDoorModal(false);
                message.success(t("更新自动门成功"));
            } else {
                message.warning(t("更新自动门出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("更新自动门出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const { deviceConfig, ...rest } = form.getFieldsValue(true);
        let config: object = {};
        try {
            config = JSON.parse(deviceConfig);
        } catch (error) {
            if (error) {
                message.warning(t("设备配置json解析出错") + String(error));
                return;
            }
        }
        const data: AutoDoorParams = {
            ...rest,
            deviceConfig: config
        };
        if (isModify) {
            handleUpdateAutoDoor(data);
        } else {
            handleAddAutoDoor(data);
        }
    };

    const handleCancel = () => {
        form.resetFields()
        setDoorModal(false);
        setModifyRow(undefined);
    };

    useEffect(() => {
        if (modifyRow) {
            const { deviceConfig, ...rest } = modifyRow;
            // 转化对象为数组
            const config: string = JSON.stringify(deviceConfig, null, 4);
            form.setFieldsValue({
                ...rest,
                deviceConfig: config
            });
        }
    }, [modifyRow])

    return (
        <Modal
            title={isModify ? t("编辑自动门") : t("添加自动门")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
        >
            <Form
                name="basic"
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 18 }}
                autoComplete="off"
                form={form}
                initialValues={{
                    deviceStatus: true
                }}
            >
                <Form.Item<AutoDoorRecord>
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

                <Form.Item<AutoDoorRecord>
                    label={t("设备驱动")}
                    name="driverKey"
                    rules={[{ required: true, message: t("请选择设备驱动") }]}
                >
                    <Select
                        placeholder={t("请选择设备驱动")}
                        options={doorDrivers}
                        fieldNames={{ label: "name", value: "key" }}
                        onChange={(value) => form.setFieldValue("deviceConfig", JSON.stringify(doorDrivers.find(d => d.key === value)?.driverProtocol || {}, null, 4))}
                        onDeselect={() => form.setFieldValue("deviceConfig", undefined)}
                    />
                </Form.Item>

                <Form.Item<AutoDoorRecord>
                    label={t("ip地址")}
                    name="ip"
                    rules={[{ required: true, message: t("请输入ip地址") }]}
                >
                    <Input
                        placeholder={t("请输入ip地址")}
                        maxLength={64}
                        showCount
                    />
                </Form.Item>

                <Form.Item<AutoDoorRecord>
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

                <Form.Item<AutoDoorRecord>
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

                <Form.Item<AutoDoorRecord>
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
