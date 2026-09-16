/**
 * @description 风淋门弹窗
 * @date 2025-7-22
 */
import { memo, useEffect } from "react";
import { Modal, Form, Input, InputNumber, Select, message } from "antd";
import type { AirDoorForm, AirDoorDriver, AddAirDoor, AirDoorRecord, AirDoorDeviceConfig } from "@/types/TriDevice/AirShowerDoor";
import { addAirShowerDoor, updateAirShowerDoor } from "@/api";
import { useI18n } from "@/hooks/useI18n";

const { TextArea } = Input;

interface AirDoorModalProps {
    open: boolean;
    isModify: boolean;
    modifyRow?: AirDoorRecord;
    airDoorDrivers: AirDoorDriver[];
    setModifyRow: (value: React.SetStateAction<AirDoorRecord | undefined>) => void;
    setOpenAirDoor: (value: React.SetStateAction<boolean>) => void;
    refreshAirShowerDoorList: () => void;
}

export default memo((props: AirDoorModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, isModify, modifyRow, airDoorDrivers, setModifyRow, setOpenAirDoor, refreshAirShowerDoorList } = props;

    const [form] = Form.useForm<AirDoorForm>();

    const handleAddAirDoor = (data: AddAirDoor) => {
        addAirShowerDoor(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                refreshAirShowerDoorList();
                setOpenAirDoor(false);
                message.success(t("新增风淋门成功"));
            } else {
                message.warning(t("新增风淋门出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("新增风淋门出错") + err?.message);
            }
        })
    };

    const handleUpdateAirDoor = (data: AddAirDoor) => {
        updateAirShowerDoor(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                refreshAirShowerDoorList();
                setOpenAirDoor(false);
                message.success(t("编辑风淋门成功"));
            } else {
                message.warning(t("编辑风淋门出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("编辑风淋门出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const values = form.getFieldsValue(true);
        const { deviceConfig, ...rest } = values;
        /**
         * 设备配置以 JSON 文本录入，提交前解析为领域配置对象。
         * 使用统一类型后，接口入参与列表展示无需在页面层重复转换或断言。
         */
        let config: AirDoorDeviceConfig = {};
        try {
            config = JSON.parse(deviceConfig);
        } catch (error) {
            if (error) {
                message.warning(t("解析设备配置json出错") + String(error));
                return;
            }
        }
        const data: AddAirDoor = {
            ...rest,
            deviceConfig: config
        };
        if (isModify) {
            handleUpdateAirDoor(data);
        } else {
            handleAddAirDoor(data);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setModifyRow(undefined);
        setOpenAirDoor(false);
    };

    useEffect(() => {
        if (modifyRow) {
            const { deviceConfig, ...rest } = modifyRow;
            // 回填时把设备配置对象序列化为带缩进的 JSON 文本（复刻充电桩 ChargePileModal 逻辑）
            const data: string = JSON.stringify(deviceConfig, null, 4);
            form.setFieldsValue({
                ...rest,
                deviceConfig: data
            });
        }
    }, [modifyRow])

    return (
        <Modal
            title={isModify ? t("编辑风淋门") : t("新增风淋门")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
        >
            <Form
                name="airShowerDoorForm"
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 18 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<AirDoorForm>
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

                <Form.Item<AirDoorForm>
                    label={t("设备驱动")}
                    name="driverKey"
                    rules={[{ required: true, message: t("请选择设备驱动") }]}
                >
                    <Select
                        placeholder={t("请选择设备驱动")}
                        allowClear
                        options={airDoorDrivers}
                        fieldNames={{ label: "name", value: "key" }}
                        onChange={(value) => {
                            // 设备驱动联动设备配置（复刻充电桩 ChargePileModal）：选中驱动 → 把 driverProtocol 序列化为 JSON 文本回填；反选 → 清空
                            form.setFieldValue("deviceConfig", JSON.stringify(airDoorDrivers.find(d => d.key === value)?.driverProtocol || {}, null, 4));
                        }}
                        onDeselect={() => form.setFieldValue("deviceConfig", undefined)}
                    />
                </Form.Item>

                <Form.Item<AirDoorForm>
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

                <Form.Item<AirDoorForm>
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

                <Form.Item<AirDoorForm>
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
});
