/**
 * @description 风淋门控制弹窗(开门，关门 —— 需选择前门 / 后门；风淋、清除占用已改为菜单直接触发)
 * @date 2025-7-22
 */
import { Modal, Form, Select, message } from "antd";
import type { AirDoorControlForm, AirDoorOpen } from "@/types/TriDevice/AirShowerDoor";
import { airDoorOpen, airDoorClose } from "@/api";
import { useI18n } from "@/hooks/useI18n";

interface ControlModalProps {
    open: boolean;
    curDeviceKey: string;
    currentControlKey: string;
    setOpenControl: (value: React.SetStateAction<boolean>) => void;
}

export default (props: ControlModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, curDeviceKey, currentControlKey, setOpenControl } = props;

    const [form] = Form.useForm();

    /* 各操作类型对应的弹窗标题、门类型字段标题与占位符 */
    const controlTextMap: Record<string, { title: string; label: string; placeholder: string }> = {
        openDoor: { title: t("风淋门开门"), label: t("开门类型"), placeholder: t("请选择开门类型") },
        closeDoor: { title: t("风淋门关门"), label: t("关门类型"), placeholder: t("请选择关门类型") }
    };
    const controlText = controlTextMap[currentControlKey] ?? controlTextMap.openDoor;

    const handleOpenAirDoor = (data: AirDoorOpen) => {
        airDoorOpen(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                setOpenControl(false);
                message.success(t("风淋门开门成功"));
            } else {
                message.warning(t("风淋门开门出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("风淋门开门出错") + err?.message);
            }
        })
    };

    const handleCloseAirDoor = (data: AirDoorOpen) => {
        airDoorClose(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                setOpenControl(false);
                message.success(t("风淋门关门成功"));
            } else {
                message.warning(t("风淋门关门出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("风淋门关门出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const { doorWay } = form.getFieldsValue();
        const data: AirDoorOpen = {
            deviceKey: curDeviceKey,
            doorWay
        };
        switch (currentControlKey) {
            case "openDoor":
                handleOpenAirDoor(data);
                break;
            case "closeDoor":
                handleCloseAirDoor(data);
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
            title={controlText.title}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
        >
            <Form
                name="controlAirDoorForm"
                labelCol={{ span: 5 }}
                wrapperCol={{ span: 19 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<AirDoorControlForm>
                    label={controlText.label}
                    name="doorWay"
                    rules={[{ required: true, message: t("请选择(开/关)门类型") }]}
                >
                    <Select
                        placeholder={controlText.placeholder}
                        options={[
                            {
                                label: t("前门"),
                                value: "FRONT"
                            },
                            {
                                label: t("后门"),
                                value: "BACK"
                            }
                        ]}
                    />
                </Form.Item>

            </Form>
        </Modal>
    )
};
