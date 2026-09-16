/**
 * @description 自动门弹窗
 * @date 2026-1-19
 */
import { useEffect } from "react";
import { Modal, Form, Input, Select, InputNumber, message } from "antd";
import { IP_REGEXP } from "@/constants";
import { readOptions, writeOptions } from "@/constants/autodoor";
import { addModbusAutoDoor, updateAutoDoor } from "@/api";
import type { AutoDoorRecord } from "@/types/TriDevice/ModbusAutodoor";
import { useI18n } from "@/hooks/useI18n";

interface AutodoorModalProps {
    open: boolean;
    modifyRecord?: AutoDoorRecord;
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
    getAutoDoors: () => void;
    setModifyRecord: (value: React.SetStateAction<AutoDoorRecord | undefined>) => void;
}

export default (props: AutodoorModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, modifyRecord, setOpenModal, getAutoDoors, setModifyRecord } = props;

    const [form] = Form.useForm();

    // 新增
    const handleAddAutodoor = (data: AutoDoorRecord) => {
        addModbusAutoDoor(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                setOpenModal(false)
                form.resetFields();
                getAutoDoors();
                message.success(t("新增自动门成功"));
            } else {
                message.warning(t("新增自动门出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("新增自动门出错") + err?.message);
            }
        })
    };

    // 编辑
    const handleModifyAutodoor = (data: AutoDoorRecord) => {
        updateAutoDoor(data as any).then(res => {
            if (res.code === 200 && res.message === "success") {
                setOpenModal(false)
                form.resetFields();
                getAutoDoors();
                message.success(t("编辑自动门成功"));
            } else {
                message.warning(t("编辑自动门出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("编辑自动门出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const values = form.getFieldsValue(true);
        if (modifyRecord) {
            handleModifyAutodoor(values);
        } else {
            handleAddAutodoor(values);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setModifyRecord(undefined);
        setOpenModal(false);
    };

    useEffect(() => {
        if (modifyRecord) {
            form.setFieldsValue(modifyRecord);
        } else {
            form.resetFields();
        }
    }, [modifyRecord])

    return (
        <Modal
            title={ modifyRecord ? t("编辑自动门") : t("新增自动门") }
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            forceRender
        >
            <Form
                name="basic"
                labelCol={{ span: 8 }}
                wrapperCol={{ span: 16 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<AutoDoorRecord>
                    label={t("自动门名称")}
                    name="deviceName"
                    rules={[{ required: true, message: t("请输入自动门名称") }]}
                >
                    <Input
                        placeholder={t("请输入自动门名称")}
                        maxLength={64}
                    />
                </Form.Item>

                <Form.Item<AutoDoorRecord>
                    label={t("自动门状态")}
                    name="deviceStatus"
                    rules={[{ required: true, message: "" }]}
                >
                    <Select
                        placeholder={t("请选择自动门状态")}
                        allowClear
                        options={[
                            { label: t("启用"), value: true },
                            { label: t("禁用"), value: false }
                        ]}
                    />
                </Form.Item>

                <Form.Item<AutoDoorRecord>
                    label={t("自动门的ip地址")}
                    name="ip"
                    validateFirst
                    rules={[
                        { required: true, message: t("请输入自动门的IP地址") },
                        { pattern: IP_REGEXP, message: t("请输入正确的IP地址") }
                    ]}
                >
                    <Input
                        placeholder={t("请输入自动门的IP地址")}
                    />
                </Form.Item>

                <Form.Item<AutoDoorRecord>
                    label={t("自动门的端口号")}
                    name="port"
                    rules={[{ required: true, message: t("请输入自动门的端口号") }]}
                >
                    <InputNumber
                        placeholder={t("请输入自动门的端口号")}
                        style={{ width: "100%" }}
                        min={0}
                        max={65535}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<AutoDoorRecord>
                    label={t("从站ID")}
                    name="slaveId"
                    rules={[{ required: true, message: t("请输入从站ID") }]}
                >
                    <InputNumber
                        placeholder={t("请输入从站ID")}
                        style={{ width: "100%" }}
                        min={-2147483648}
                        max={2147483648}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<AutoDoorRecord>
                    label={t("读类型")}
                    name="readFunction"
                    rules={[{ required: true, message: t("请选择读类型") }]}
                >
                    <Select
                        placeholder={t("请选择读类型")}
                        options={readOptions}
                        allowClear
                    />
                </Form.Item>

                <Form.Item<AutoDoorRecord>
                    label={t("故障位(读)")}
                    name="faultSignal"
                    rules={[{ required: true, message: t("请输入故障位") }]}
                >
                    <InputNumber
                        placeholder={t("请输入故障位")}
                        style={{ width: "100%" }}
                        min={-2147483648}
                        max={2147483648}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<AutoDoorRecord>
                    label={t("自动门开门到位(读)")}
                    name="doorFullyOpenSignal"
                    rules={[{ required: true, message: t("请输入自动门开门到位") }]}
                >
                    <InputNumber
                        placeholder={t("请输入自动门开门到位")}
                        style={{ width: "100%" }}
                        min={-2147483648}
                        max={2147483648}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<AutoDoorRecord>
                    label={t("自动门关门到位(读)")}
                    name="doorFullyCloseSignal"
                    rules={[{ required: true, message: t("请输入自动门关门到位") }]}
                >
                    <InputNumber
                        placeholder={t("请输入自动门关门到位")}
                        style={{ width: "100%" }}
                        min={-2147483648}
                        max={2147483648}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<AutoDoorRecord>
                    label={t("写类型")}
                    name="writeFunction"
                    rules={[{ required: true, message: t("请选择写类型") }]}
                >
                    <Select
                        placeholder={t("请选择写类型")}
                        allowClear
                        options={writeOptions}
                    />
                </Form.Item>

                <Form.Item<AutoDoorRecord>
                    label={t("自动门开门(写)")}
                    name="doorOpeningSignal"
                    rules={[{ required: true, message: t("请输入自动门开门") }]}
                >
                    <InputNumber
                        placeholder={t("请输入自动门开门")}
                        style={{ width: "100%" }}
                        min={-2147483648}
                        max={2147483648}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<AutoDoorRecord>
                    label={t("自动门关门(写)")}
                    name="doorClosingSignal"
                    rules={[{ required: true, message: t("请输入自动门关门") }]}
                >
                    <InputNumber
                        placeholder={t("请输入自动门关门")}
                        style={{ width: "100%" }}
                        min={-2147483648}
                        max={2147483648}
                        precision={0}
                    />
                </Form.Item>

            </Form>
        </Modal>
    )
};
