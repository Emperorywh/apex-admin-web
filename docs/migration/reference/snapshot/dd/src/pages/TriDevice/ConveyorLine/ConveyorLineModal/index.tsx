/**
 * @description 输送线弹窗
 * @date 2026-2-10
 */
import { useEffect } from "react";
import { Modal, Form, Input, Switch, Select, InputNumber, Space, Button, message } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import type { LineRecord, LineDriver } from "@/types/TriDevice/ConveyorLine";
import { IP_REGEXP } from "@/constants";
import { addConveyorLine, updateConveyorLine } from "@/api";
import { useI18n } from "@/hooks/useI18n";

interface ConveyorLineModalProps {
    open: boolean;
    modifyLine?: LineRecord;
    conveyorLineDrivers: LineDriver[];
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
    setModifyLine: (value: React.SetStateAction<LineRecord | undefined>) => void;
    getConveyorLines: () => void;
}

export default (props: ConveyorLineModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, modifyLine, conveyorLineDrivers, setOpenModal, setModifyLine, getConveyorLines } = props;

    const [form] = Form.useForm();

    // 新增输送线
    const handleAddConveyorLine = (data: LineRecord) => {
        addConveyorLine(data).then(res => {
            if (res.code === 200 && res.message === "success"){
                getConveyorLines();
                setOpenModal(false);
                form.resetFields();
                message.success(t("新增输送线成功"));
            } else {
                message.warning(t("新增输送线出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("新增输送线出错") + err?.message);
            }
        })
    };

    // 编辑输送线
    const handleUpdateConveyorLine = (data: LineRecord) => {
        updateConveyorLine(data).then(res => {
            if (res.code === 200 && res.message === "success"){
                getConveyorLines();
                setOpenModal(false);
                form.resetFields();
                message.success(t("编辑输送线成功"));
            } else {
                message.warning(t("编辑输送线出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("编辑输送线出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = form.validateFields();
        if (!validate) return;
        const values = form.getFieldsValue(true);
        console.log(values)
        const { deviceConfig, ...rest } = values;
        const config: Record<string, any> = {};
        (deviceConfig as { key: string, value: string }[] || []).forEach(({ key, value }) => {
            config[key] = value
        })
        const data: LineRecord = {
            ...rest,
            deviceConfig: config
        }
        if (modifyLine) {
            handleUpdateConveyorLine(data);
        } else {
            handleAddConveyorLine(data);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setModifyLine(undefined);
        setOpenModal(false);
    };

    useEffect(() => {
        if (modifyLine) {
            const { deviceConfig, ...rest } = modifyLine;
            const deviceList = Object.entries(deviceConfig || {}).map(([key, value]) => ({
                key,
                value
            }))
            form.setFieldsValue({
                ...rest,
                deviceConfig: deviceList
            });
        }
    }, [modifyLine])

    return (
        <Modal
            title={ modifyLine ? t("编辑输送线") : t("新增输送线") }
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
        >
            <Form
                name="conveyorLineForm"
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 18 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<LineRecord>
                    label={t("设备名称")}
                    name="deviceName"
                    rules={[{ required: true, message: t("请输入设备名称") }]}
                >
                    <Input
                        placeholder={t("请输入设备名称")}
                        maxLength={64}
                    />
                </Form.Item>

                <Form.Item<LineRecord>
                    label={t("设备状态")}
                    name="deviceStatus"
                    rules={[{ required: true, message: "" }]}
                >
                    <Switch />
                </Form.Item>

                <Form.Item<LineRecord>
                    label={t("设备驱动")}
                    name="driverKey"
                    rules={[{ required: true, message: t("请选择设备驱动") }]}
                >
                    <Select
                        placeholder={t("请选择设备驱动")}
                        allowClear
                        showSearch
                        optionFilterProp="name"
                        fieldNames={{ label: "name", value: "clazz" }}
                        options={conveyorLineDrivers}
                    />
                </Form.Item>

                <Form.Item<LineRecord>
                    label={t("设备的IP地址")}
                    name="ip"
                    rules={[
                        { required: true, message: t("请输入设备的IP地址") },
                        { pattern: IP_REGEXP, message: t("请输入正确的IP地址") }
                    ]}
                >
                    <Input
                        placeholder={t("请输入设备的IP地址")}
                    />
                </Form.Item>

                <Form.Item<LineRecord>
                    label={t("设备的端口号")}
                    name="port"
                    rules={[{ required: true, message: t("请输入设备的端口号") }]}
                >
                    <InputNumber
                        placeholder={t("请输入设备的端口号")}
                        style={{ width: "100%" }}
                        min={0}
                        max={65535}
                        precision={0}
                    />
                </Form.Item>

                <Form.List name="deviceConfig">
                    {(fields, { add, remove }) => (
                        <>
                            {fields.map(({ key, name, ...restField }) => (
                                <Space key={key} style={{ display: "flex", marginBottom: 8 }} align="baseline">
                                    <Form.Item
                                        {...restField}
                                        name={[name, "key"]}
                                        rules={[{ required: true, message: t("请输入配置名") }]}
                                    >
                                        <Input
                                            placeholder={t("请输入配置名")}
                                            maxLength={64}
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        {...restField}
                                        name={[name, "value"]}
                                        rules={[{ required: true, message: t("请输入配置值") }]}
                                    >
                                        <Input
                                            placeholder={t("请输入配置值")}
                                            maxLength={64}
                                        />
                                    </Form.Item>
                                    <MinusCircleOutlined onClick={() => remove(name)} />
                                </Space>
                            ))}
                            <Form.Item noStyle>
                                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                    {t("新增配置项")}
                                </Button>
                            </Form.Item>
                        </>
                    )}
                </Form.List>

            </Form>
        </Modal>
    )
};
