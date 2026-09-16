/**
 * @description 编辑地图的弹窗
 * @date 2025-7-7
 */
import { useEffect } from "react";
import { Modal, Form, Input, Select, InputNumber, message } from "antd";
import { updateMap, createMap } from "@/api";
import type { MapInfo, UpdateMapType, CreateMapType } from "@/types/MapList";
import { useI18n } from "@/hooks/useI18n";

interface MapModalProps {
    open: boolean;
    isModify: boolean;
    modifyRow?: MapInfo;
    getMapInfos: () => void;
    setModifyRow: (value: React.SetStateAction<MapInfo | undefined>) => void;
    setOpenMapModal: (value: React.SetStateAction<boolean>) => void;
}

export default (props: MapModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, isModify, modifyRow, getMapInfos, setModifyRow, setOpenMapModal } = props;

    const [form] = Form.useForm<MapInfo>(undefined);

    // 创建地图
    const handleCreateMap = (data: CreateMapType) => {
        createMap(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                getMapInfos();
                setOpenMapModal(false);
                form.resetFields();
                message.success(t("创建地图成功"));
            } else {
                message.warning(t("创建地图出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("创建地图出错") + err?.message);
            }
        })
    };

    // 更新地图
    const handleUpdateMap = (data: UpdateMapType) => {
        updateMap(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                getMapInfos();
                setOpenMapModal(false);
                form.resetFields();
                message.success(t("更新地图信息成功"));
            } else {
                message.warning(t("更新地图信息出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("更新地图信息出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const { mapId, mapName, mapState, floor } = form.getFieldsValue(true);
        const updateParams: UpdateMapType = {
            mapKey: mapId,
            mapState,
            floor
        };
        const createParams: CreateMapType = {
            mapName,
            mapState,
            floor
        };
        if (isModify) {
            handleUpdateMap(updateParams);
        } else {
            handleCreateMap(createParams);
        }
    };

    const handleCancel = () => {
        setOpenMapModal(false);
        setModifyRow(undefined);
        form.resetFields();
    };

    useEffect(() => {
        if (modifyRow) {
            form.setFieldsValue(modifyRow);
        }
    }, [modifyRow])

    return (
        <Modal
            title={isModify ? t("编辑地图") : t("创建地图")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
        >
            <Form
                name="mapList-modify"
                labelCol={{ span: 8 }}
                wrapperCol={{ span: 16 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<MapInfo>
                    label={t("地图名称")}
                    name="mapName"
                    rules={[{ required: true, message: t("请输入地图名称!") }]}
                >
                    <Input
                        placeholder={t("请输入地图名称")}
                        disabled={isModify}
                        maxLength={64}
                        showCount
                    />
                </Form.Item>

                <Form.Item<MapInfo>
                    label={t("地图状态")}
                    name="mapState"
                    rules={[{ required: true, message: t("请选择地图状态!") }]}
                >
                    <Select
                        placeholder={t("请选择地图状态")}
                        options={[
                            { value: "ENABLED", label: t("启用") },
                            { value: "DISABLED", label: t("禁用") }
                        ]}
                    />
                </Form.Item>

                <Form.Item<MapInfo>
                    label={t("楼层")}
                    name="floor"
                    rules={[{ required: true, message: t("请输入地图所属楼层!") }]}
                >
                    <InputNumber
                        placeholder={t("请输入地图所属楼层")}
                        style={{ width: "100%" }}
                        min={-200}
                        max={200}
                        precision={0}
                    />
                </Form.Item>
            </Form>
        </Modal>
    )
};
