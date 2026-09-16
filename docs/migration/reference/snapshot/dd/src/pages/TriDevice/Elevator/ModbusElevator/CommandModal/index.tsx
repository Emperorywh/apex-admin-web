/**
 * @description 电梯的操作项
 * @date 2026-1-20
 */
import { Modal, Form, InputNumber, message } from "antd";
import { outerCall, innerCall } from "@/api";
import type { CommandParams } from "@/types/TriDevice/ModbusElevator";
import { useI18n } from "@/hooks/useI18n";

type FieldType = {
    deviceKey: string;
    currentFloor: number;
    targetFloor: number;
};

interface CommandModalProps {
    open: boolean;
    deviceKey: string;
    commandKey: string;
    openModal: (value: React.SetStateAction<boolean>) => void;
}

export default (props: CommandModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, deviceKey, commandKey, openModal } = props;

    const [form] = Form.useForm();

    // 呼叫电梯 currentFloor
    const handleElevatorOuterCall = (data: CommandParams) => {
        outerCall(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                openModal(false);
                message.success(t("呼叫电梯成功"));
            } else {
                message.warning(t("呼叫电梯出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("呼叫电梯出错") + err?.message);
            }
        })
    };

    // 电梯上楼 targetFloor
    const handleElevatorInnerCall = (data: CommandParams) => {
        innerCall(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                openModal(false);
                message.success(t("电梯上楼成功"));
            } else {
                message.warning(t("电梯上楼出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("电梯上楼出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const { currentFloor, targetFloor } = form.getFieldsValue();
        const outerData: CommandParams = {
            currentFloor,
            deviceKey
        };
        const innerData: CommandParams = {
            targetFloor,
            deviceKey
        };
        switch (commandKey) {
            case "outerCall":
                handleElevatorOuterCall(outerData);
                break;
            case "innerCall":
                handleElevatorInnerCall(innerData);
                break;
            default:
                break;
        }
    };

    const handleCancel = () => {
        form.resetFields();
        openModal(false);
    };

    return (
        <Modal
            title={t("电梯操作")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            forceRender
        >
            <Form
                name="elevatorCommandForm"
                labelCol={{ span: 4 }}
                wrapperCol={{ span: 20 }}
                autoComplete="off"
                form={form}
            >
                {
                    commandKey === "outerCall" && (
                        <Form.Item<FieldType>
                            label={t("当前楼层")}
                            name="currentFloor"
                            rules={[{ required: true, message: t("请输入电梯当前楼层") }]}
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                placeholder={t("请输入当前楼层")}
                                min={-200}
                                max={200}
                                step={1}
                                precision={0}
                            />
                        </Form.Item>
                    )
                }

                {
                    commandKey === "innerCall" && (
                        <Form.Item<FieldType>
                            label={t("目标楼层")}
                            name="targetFloor"
                            rules={[{ required: true, message: t("请输入电梯目标楼层") }]}
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                placeholder={t("请输入目标楼层")}
                                min={-200}
                                max={200}
                                step={1}
                                precision={0}
                            />
                        </Form.Item>
                    )
                }

            </Form>
        </Modal>
    )
};
