/**
 * @description 充电桩弹窗
 * @date 2026-1-21
 */
import { useEffect } from "react";
import { Modal, Form, Input, Select, InputNumber, message } from "antd";
import type { ChargePileRecord, ChargeDriver } from "@/types/TriDevice/ModbusChargePie";
import { IP_REGEXP } from "@/constants";
import { addChargePile, updateChargePile } from "@/api";
import { transformListJson, transformJsonList } from "@/utils/format";
import { useI18n } from "@/hooks/useI18n";

const { TextArea } = Input;

interface ChargePieModalProps {
    open: boolean;
    modifyCharge?: ChargePileRecord;
    chargeDrivers: ChargeDriver[];
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
    getChargePiles: () => void;
    setModifyCharge: (value: React.SetStateAction<ChargePileRecord | undefined>) => void;
}

export default (props: ChargePieModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, modifyCharge, chargeDrivers, setOpenModal, getChargePiles, setModifyCharge } = props;

    const [form] = Form.useForm();

    // 新增充电桩
    const handleAddChargePie = (data: ChargePileRecord) => {
        addChargePile(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                setOpenModal(false);
                form.resetFields();
                getChargePiles();
                message.success(t("新增充电桩成功"));
            } else {
                message.warning(t("新增充电桩出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("新增充电桩出错") + err?.message);
            }
        })
    };

    // 编辑充电桩
    const handleUpdateChargePile = (data: ChargePileRecord) => {
        updateChargePile(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                setOpenModal(false);
                form.resetFields();
                getChargePiles();
                message.success(t("编辑充电桩成功"));
            } else {
                message.warning(t("编辑充电桩出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("编辑充电桩出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const values = form.getFieldsValue(true);
        const { deviceConfig, ...rest } = values;
        let config: object = {};
        try {
            config = JSON.parse(deviceConfig);  
        } catch (error) {
            if (error) {
                message.warning(t("解析设备配置json出错") + String(error));
                return;
            }
        }
        const data: ChargePileRecord = {
            ...rest,
            deviceConfig: config
        };
        if (modifyCharge) {
            handleUpdateChargePile(data);
        } else {
            handleAddChargePie(data);
        }
    };

    const handleCancel = () => {
        setModifyCharge(undefined);
        form.resetFields();
        setOpenModal(false);
    };

    useEffect(() => {
        if (modifyCharge) {
            const { deviceConfig, ...rest } = modifyCharge;
            const data: string = JSON.stringify(deviceConfig, null, 4);
            form.setFieldsValue({
                ...rest,
                deviceConfig: data
            });
        } else {
            form.resetFields();
        }
    }, [modifyCharge])

    return (
        <Modal
            title={modifyCharge ? t("编辑充电桩") : t("新增充电桩")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            forceRender
        >
            <Form
                name="chargePieForm"
                labelCol={{ span: 8 }}
                wrapperCol={{ span: 16 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<ChargePileRecord>
                    label={t("设备名称")}
                    name="deviceName"
                    rules={[{ required: true, message: t("请输入设备名称") }]}
                >
                    <Input
                        placeholder={t("请输入设备名称")}
                        maxLength={64}
                    />
                </Form.Item>

                <Form.Item<ChargePileRecord>
                    label={t("设备驱动")}
                    name="driverKey"
                    rules={[{ required: true, message: t("请输入设备驱动") }]}
                >
                    <Select
                        placeholder={t("请选择设备驱动")}
                        allowClear
                        showSearch
                        optionFilterProp="name"
                        fieldNames={{ label: "name", value: "key" }}
                        options={chargeDrivers}
                        onChange={(value) => form.setFieldValue("deviceConfig", JSON.stringify(chargeDrivers.find(d => d.key === value)?.driverProtocol || {}, null, 4))}
                        onDeselect={() => form.setFieldValue("deviceConfig", undefined)}
                    />
                </Form.Item>

                <Form.Item<ChargePileRecord>
                    label={t("是否启用")}
                    name="deviceStatus"
                    rules={[{ required: true, message: t("请选择是否启用") }]}
                >
                    <Select
                        placeholder={t("请选择是否启用")}
                        allowClear
                        options={[
                            { label: t("启用"), value: true },
                            { label: t("禁用"), value: false }
                        ]}
                    />
                </Form.Item>

                <Form.Item<ChargePileRecord>
                    label={t("设备IP地址")}
                    name="ip"
                    validateFirst
                    rules={[
                        { required: true, message: t("请输入设备IP地址") },
                        { pattern: IP_REGEXP, message: t("请输入正确的IP地址") }
                    ]}
                >
                    <Input
                        placeholder={t("请输入设备IP地址")}
                    />
                </Form.Item>

                <Form.Item<ChargePileRecord>
                    label={t("设备端口号")}
                    name="port"
                    rules={[{ required: true, message: t("请输入设备端口号") }]}
                >
                    <InputNumber
                        placeholder={t("请输入设备端口号")}
                        style={{ width: "100%" }}
                        min={0}
                        max={65536}
                    />
                </Form.Item>

                <Form.Item<ChargePileRecord>
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
