/**
 * @description 拉取地图的弹窗
 * @date 2025-7-21
 */
import { useState } from "react";
import { Modal, Form, Input, message } from "antd";
import type { PullMapType } from "@/types/MapList";
import { downloadMapInfo } from "@/api";
import { useI18n } from "@/hooks/useI18n";

interface PullModalProps {
    open: boolean;
    getMapInfos: () => void;
    setOpenPullModal: (value: React.SetStateAction<boolean>) => void;
}

export default (props: PullModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, getMapInfos, setOpenPullModal } = props;

    const [pullLoading, setPullLoading] = useState<boolean>(false);

    const [form] = Form.useForm<PullMapType>();

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        setPullLoading(true);
        const values = await form.getFieldsValue();
        downloadMapInfo(values).then(res => {
            if (res.code === 200 && res.message === "success") {
                getMapInfos();
                setOpenPullModal(false);
                message.success(t("拉取地图成功"));
            } else {
                message.warning(t("拉取地图出错") + res?.message);
            }
            setPullLoading(false);
        }).catch(err => {
            if (err) {
                setPullLoading(false);
                message.error(t("拉取地图出错") + err?.message);
            }
        })
    };

    const handleCancel = () => {
        form.resetFields();
        setOpenPullModal(false);
    };

    return (
        <Modal
            title={t("拉取地图")}
            open={open}
            okText={t("确定")}
            cancelText={t("取消")}
            onOk={handleOk}
            onCancel={handleCancel}
            confirmLoading={pullLoading}
        >
            <Form
                name="pullMap"
                labelCol={{ span: 4 }}
                wrapperCol={{ span: 20 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<PullMapType>
                    label={t("IP地址")}
                    name="ip"
                    rules={[{ required: true, message: t("请输入车辆的IP") }]}
                >
                    <Input
                        placeholder={t("要拉取地图的IP地址")}
                    />
                </Form.Item>

                <Form.Item<PullMapType>
                    label={t("地图名称")}
                    name="mapName"
                    rules={[{ required: false, message: t("请输入地图名称") }]}
                >
                    <Input
                        placeholder={t("要拉取的地图名称(非必填)")}
                    />
                </Form.Item>

            </Form>
        </Modal>
    )
};
