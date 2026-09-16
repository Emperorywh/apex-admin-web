/**
 * @description 模拟充电
 * @date 2025-6-24
 */
import { useEffect, useState, memo } from "react";
import { useModel } from "@umijs/max";
import { Modal, Form, Select, message } from "antd";
import { mockCharge, getStations, getSimpleMaps } from "@/api";
import type { GetStations, GetStationsItem, MockCharge } from "@/types/OverLook";
import { useI18n } from "@/hooks/useI18n";

type FieldType = {
    mapId: string;
    stationId: string;
};

type MapItem = {
    mapId: string;
    mapName: string;
};

interface MockChargeModalProps {
    open: boolean;
    agvKey: string;
    setOpenChargeModal: (value: React.SetStateAction<boolean>) => void;
}

export default memo((props: MockChargeModalProps) => {

    const { open, agvKey, setOpenChargeModal } = props;

    /* 国际化翻译方法，用于将充电检测弹窗的文案进行多语言转换 */
    const { t } = useI18n();

    // 充电点列表
    const [chargeList, setChargeList] = useState<GetStationsItem[]>([]);
    const [mapList, setMapList] = useState<MapItem[]>([]);

    const { currentMapInfo } = useModel("currentMapInfo");
    const [form] = Form.useForm<FieldType>();

    const getMapList = () => {
        getSimpleMaps().then(res => {
            if (res.code === 200 && res.message === "success") {
                setMapList(res.data);
            } else {
                message.warning(t("查询地图列表出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询地图列表出错") + err?.message);
            }
        });
    };

    const handleMapChange = (mapId: string) => {
        form.setFieldValue("stationId", undefined);
        setChargeList([]);
        if (mapId) {
            getChargeStations({ mapId, type: "charge" });
        }
    };

    const getChargeStations = (data: GetStations) => {
        getStations(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                setChargeList(res.data);
            } else {
                message.warning(t("查询充电站点出错") + ": " + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询充电站点出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const { mapId, stationId } = form.getFieldsValue();
        const data: MockCharge = {
            mapId,
            vehicleKey: agvKey,
            stationId
        };
        mockCharge(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                setOpenChargeModal(false);
                message.success(t("模拟充电成功"));
            } else {
                message.warning(t("模拟充电出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("模拟充电出错") + err?.message);
            }
        })
    };

    const handleCancel = () => {
        form.resetFields();
        setOpenChargeModal(false);
    };

    useEffect(() => {
        if (open) {
            getMapList();
            if (currentMapInfo.mapId) {
                form.setFieldValue("mapId", currentMapInfo.mapId as string);
                getChargeStations({
                    mapId: currentMapInfo.mapId,
                    type: "charge"
                });
            }
        } else {
            form.resetFields();
            setChargeList([]);
            setMapList([]);
        }
    }, [open])

    return (
        <Modal
            title={t("充电检测")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
            destroyOnHidden
        >
            <Form
                name="mock-charge"
                labelCol={{ span: 4 }}
                wrapperCol={{ span: 20 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<FieldType>
                    label={t("地图")}
                    name="mapId"
                    rules={[{ required: true, message: t("请选择地图") }]}
                >
                    <Select
                        placeholder={t("请选择地图")}
                        allowClear
                        showSearch
                        optionFilterProp="mapName"
                        options={mapList}
                        fieldNames={{ label: "mapName", value: "mapId" }}
                        onChange={handleMapChange}
                    />
                </Form.Item>
                <Form.Item<FieldType>
                    label={t("充电站点")}
                    name="stationId"
                    rules={[{ required: true, message: t("请选择充电站点") }]}
                >
                    <Select
                        placeholder={t("请选择充电站点")}
                        showSearch
                        allowClear
                        options={chargeList}
                        optionFilterProp="name"
                        fieldNames={{ label: "name", value: "id" }}
                    />
                </Form.Item>
            </Form>
        </Modal>
    )
});
