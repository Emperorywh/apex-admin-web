/**
 * @description 控制电梯的弹窗 呼叫电梯
 * @date 2025-7-22
 */
import { memo } from "react";
import { Modal, Form, InputNumber, message, Select } from "antd";
import type { ElevatorControlForm, OuterCallParams, InnerCallParams, ElevatorCommand } from "@/types/TriDevice/Elevators";
import { outerCall, innerCall, openDoor, closeDoor } from "@/api";
import { useI18n } from "@/hooks/useI18n";

interface ControlModalProps {
    open: boolean;
    currentControl: string;
    currentDeviceKey: string;
    setOpenControl: (value: React.SetStateAction<boolean>) => void;
}

export default memo((props: ControlModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, currentControl, currentDeviceKey, setOpenControl } = props;

    const [form] = Form.useForm<ElevatorControlForm>();

    // 呼叫电梯 currentFloor
    const handleElevatorOuterCall = (data: OuterCallParams) => {
        outerCall(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                setOpenControl(false);
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
    const handleElevatorInnerCall = (data: InnerCallParams) => {
        innerCall(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                setOpenControl(false);
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

    // 电梯开门
    const handleElevatorOpenDoor = (data: ElevatorCommand) => {
        openDoor(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                setOpenControl(false);
                message.success(t("电梯开门成功"));
            } else {
                message.warning(t("电梯开门出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("电梯开门出错") + err?.message);
            }
        })
    };

    // 电梯关门
    const handleElevatorCloseDoor = (data: ElevatorCommand) => {
        closeDoor(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                setOpenControl(false);
                message.success(t("电梯关门成功"));
            } else {
                message.warning(t("电梯关门出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("电梯关门出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const { currentFloor, targetFloor, doorWay } = form.getFieldsValue();
        const outerData: OuterCallParams = {
            currentFloor,
            deviceKey: currentDeviceKey
        };
        const innerData: InnerCallParams = {
            targetFloor,
            deviceKey: currentDeviceKey
        };
        const openDoor: ElevatorCommand = {
            deviceKey: currentDeviceKey,
            doorWay
        };
        const closeDoor = {
            deviceKey: currentDeviceKey,
            doorWay
        };
        switch (currentControl) {
            case "outerCall":
                handleElevatorOuterCall(outerData);
                break;
            case "innerCall":
                handleElevatorInnerCall(innerData);
                break;
            case "openDoor":
                handleElevatorOpenDoor(openDoor);
                break;
            case "closeDoor":
                handleElevatorCloseDoor(closeDoor);
                break;
            default:
                break;
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setOpenControl(false);
    };

    return (
        <Modal
            title={currentControl === "outerCall" ? t("呼叫电梯") : currentControl === "innerCall" ? t("电梯上楼") : t("电梯操作")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
        >
            <Form
                name="elevatorControlForm"
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 18 }}
                autoComplete="off"
                form={form}
            >
                {
                    currentControl === "outerCall" && (
                        <Form.Item<ElevatorControlForm>
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
                    currentControl === "innerCall" && (
                        <Form.Item<ElevatorControlForm>
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

                {
                    (currentControl === "openDoor" || currentControl === "closeDoor") && (
                        <Form.Item<ElevatorControlForm>
                            label={t("目标电梯门")}
                            name="doorWay"
                            rules={[{ required: true, message: t("请选择要操作的电梯门") }]}
                        >
                            <Select
                                placeholder={t("请选择要操作的电梯门")}
                                allowClear
                                options={[
                                    { label: t("前门"), value: "FRONT" },
                                    { label: t("后门"), value: "BACK" }
                                ]}
                            />
                        </Form.Item>
                    )
                }

            </Form>
        </Modal>
    )
});
