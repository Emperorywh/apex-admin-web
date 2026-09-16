/**
 * @description 模拟停靠的弹窗
 * @date 2025-6-24
 */
import { useEffect, useState, memo } from "react";
import { useModel } from "@umijs/max";
import { Modal, Form, Select, message } from "antd";
import { mockPark, getStations, getSimpleMaps } from "@/api";
import type { MockPark, GetStations, GetStationsItem } from "@/types/OverLook";
import { useI18n } from "@/hooks/useI18n";

type FieldType = {
    mapId: string;
    stationId: string;
};

type MapItem = {
    mapId: string;
    mapName: string;
};

interface MockParkModalProps {
    open: boolean;
    agvKey: string;
    setOpenParkModal: (value: React.SetStateAction<boolean>) => void;
}

export default memo((props: MockParkModalProps) => {

    const { open, agvKey, setOpenParkModal } = props;

    /* 国际化翻译方法，用于将停车检测弹窗的文案进行多语言转换 */
    const { t } = useI18n();

    const [parkList, setParkList] = useState<GetStationsItem[]>([]);
    const [mapList, setMapList] = useState<MapItem[]>([]);

    const [form] = Form.useForm<FieldType>();
    const { currentMapInfo } = useModel("currentMapInfo");

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
        setParkList([]);
        if (mapId) {
            getParkStations({ mapId, type: "park" });
        }
    };

    const getParkStations = (data: GetStations) => {
        getStations(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                setParkList(res.data);
            } else {
                message.warning(t("查询停车点出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询停车点出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const { mapId, stationId } = form.getFieldsValue();
        const data: MockPark = {
            mapId,
            vehicleKey: agvKey,
            stationId
        };
        mockPark(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                setOpenParkModal(false);
                form.resetFields();
                message.success(t("模拟停靠成功"));
            } else {
                message.warning(t("模拟停靠出错") + ": " + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("模拟停靠出错") + err?.message);
            }
        })
    };

    const handleCancel = () => {
        form.resetFields();
        setOpenParkModal(false);
    };

    useEffect(() => {
        if (open) {
            getMapList();
            if (currentMapInfo.mapId) {
                form.setFieldValue("mapId", currentMapInfo.mapId as string);
                getParkStations({
                    mapId: currentMapInfo.mapId,
                    type: "park"
                });
            }
        } else {
            form.resetFields();
            setParkList([]);
            setMapList([]);
        }
    }, [open])

    return (
        <Modal
            title={t("停车检测")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
            destroyOnHidden
        >
            <Form
                name="mock-park-form"
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
                    label={t("停车点")}
                    name="stationId"
                    rules={[{ required: true, message: t("请选择检测停车点") }]}
                >
                    <Select
                        placeholder={t("请选择检测停车点")}
                        allowClear
                        showSearch
                        optionFilterProp="name"
                        options={parkList}
                        fieldNames={{ label: "name", value: "id" }}
                    />
                </Form.Item>
            </Form>
        </Modal>
    )
});