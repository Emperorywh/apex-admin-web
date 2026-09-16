/**
 * @description 三方设备的key 根据选择的三方设备类型查询对应的三方设备
 * @date 2025-7-24
 */
import { useEffect, useState } from "react";
import { Form, Select, message } from "antd";
import type { SelectProps } from "antd";
import type Konva from "konva";
import { getElevators, getAirShowerDoors, getAutoDoors, getAllChargePiles, pageTrafficLights } from "@/api";
import type { Elevator } from "@/types/MultipleMaps";
import type { AirDoorRecord } from "@/types/TriDevice/AirShowerDoor";
import type { AutoDoorRecord } from "@/types/TriDevice/AutoDoor";
import type { ChargePileRecord } from "@/types/TriDevice/ModbusChargePie";
import type { TrafficLightRecord } from "@/types/TriDevice/TrafficLight";
import { useI18n } from "@/hooks/useI18n";

interface DeviceKeyProps {
    selectShapes: Konva.Shape[];
}

export default (props: DeviceKeyProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    // 对应设备的选项
    const [deviceList, setDeviceList] = useState<SelectProps["options"]>([]);
    // 请求数据的加载
    const [loading, setLoading] = useState(false);

    const form = Form.useFormInstance();
    const deviceType = Form.useWatch("deviceType", form);

    // 切换设备
    const onDeviceKeyChange: SelectProps["onChange"] = (value) => {
        if (!selectShapes?.length) return;
        /**
         * 切换设备的时候要把申请动作和释放动作置空
         * 交通灯设备类型保持隐藏字段 applyDeviceOperationType 为 TRAFFIC_LIGHT
         */
        const isTrafficLight = deviceType === "trafficLight";
        form.setFieldsValue({
            applyDeviceOperationType: isTrafficLight ? "TRAFFIC_LIGHT" : undefined,
            releaseDeviceOperationType: undefined
        });
        selectShapes.forEach(shape => {
            const { attrs: { data: { userDefinedProperties } } } = shape;
            shape.setAttrs({
                data: {
                    ...(shape.attrs?.data || {}),
                    userDefinedProperties: {
                        ...(userDefinedProperties || {}),
                        deviceKey: value || undefined,
                        applyDeviceOperationType: isTrafficLight ? "TRAFFIC_LIGHT" : undefined,
                        releaseDeviceOperationType: undefined
                    }
                }
            });
        })
    };

    // 查询电梯列表
    const queryElevators = () => {
        setLoading(true);
        getElevators().then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: Elevator[] = res.data;
                setDeviceList(
                    data.map(elevator => ({
                        label: elevator.deviceName,
                        value: elevator.deviceKey
                    }))
                );
            } else {
                message.warning(t("查询电梯列表出错") + res?.message);
            }
            setLoading(false);
        }).catch(err => {
            if (err) {
                setLoading(false);
                message.error(t("查询电梯列表出错") + err?.message);
            }
        })
    };

    // 查询所有自动门列表
    const queryAutoDoors = () => {
        setLoading(true);
        getAutoDoors().then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: AutoDoorRecord[] = res.data || [];
                setDeviceList(
                    data.map(autoDoor => ({
                        label: autoDoor.deviceName,
                        value: autoDoor.deviceKey
                    }))
                );
            } else {
                message.warning(t("查询自动门列表出错") + res?.message);
            }
            setLoading(false);
        }).catch(err => {
            if (err) {
                setLoading(false);
                message.error(t("查询自动门列表出错") + err?.message);
            }
        })
    };

    // 获取所有的风淋门集合
    const queryAirShowerDoors = () => {
        setLoading(true);
        getAirShowerDoors().then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: AirDoorRecord[] = res.data || [];
                setDeviceList(
                    data.map(airDoor => ({
                        label: airDoor.deviceName,
                        value: airDoor.deviceKey
                    }))
                );
            } else {
                message.warning(t("查询风淋门列表出错") + res?.message);
            }
            setLoading(false);
        }).catch(err => {
            if (err) {
                setLoading(false);
                message.error(t("查询风淋门列表出错") + err?.message);
            }
        })
    }

    const queryChargePiles = () => {
        getAllChargePiles().then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: ChargePileRecord[] = res.data || [];
                setDeviceList(
                    data.map(airDoor => ({
                        label: airDoor.deviceName,
                        value: airDoor.deviceKey
                    }))
                );
            } else {
                message.warning(t("查询充电桩列表出错") + res?.message);
            }
            setLoading(false);
        }).catch(err => {
            if (err) {
                setLoading(false);
                message.error(t("查询充电桩列表出错") + err?.message);
            }
        })
    };

    /**
     * 分页查询交通信号灯列表
     * 调用 pageTrafficLights 接口获取所有交通灯数据
     */
    const queryTrafficLights = () => {
        setLoading(true);
        pageTrafficLights({ pageSize: -1, pageNo: 1 }).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: TrafficLightRecord[] = res.data?.records || [];
                setDeviceList(
                    data.map(item => ({
                        label: item.deviceName,
                        value: item.deviceKey
                    }))
                );
            } else {
                message.warning(t("查询交通灯列表出错") + res?.message);
            }
            setLoading(false);
        }).catch(err => {
            if (err) {
                setLoading(false);
                message.error(t("查询交通灯列表出错") + err?.message);
            }
        })
    };

    // 根据不同的设备类型查询类型对应的设备
    useEffect(() => {
        if (!deviceType) {
            form.setFieldValue("deviceKey", undefined);
            return;
        };
        // 切换设备类型先把设备置空
        setDeviceList([]);
        switch (deviceType) {
            case "elevator":
                queryElevators();
                break;
            case "autoDoor":
                queryAutoDoors();
                break;
            case "airShowerDoor":
                queryAirShowerDoors();
                break;
            case "chargePile":
                queryChargePiles();
                break;
            case "trafficLight":
                queryTrafficLights();
                break;
            default:
                break;
        }
    }, [deviceType])

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data: { userDefinedProperties } } } = shape;
        form.setFieldValue("deviceKey", userDefinedProperties?.deviceKey || undefined);
    }, [selectShapes])

    return (
        <Form.Item
            noStyle
            shouldUpdate={(preValues, curValues) => preValues.deviceType !== curValues.deviceType}
        >
            {
                ({ getFieldValue }) => (
                    getFieldValue("deviceType") ? (
                        <Form.Item
                            label={t("设备名称")}
                            name="deviceKey"
                            rules={[{ required: true, message: t("请选择三方设备") }]}
                        >
                            <Select
                                placeholder={t("请选择三方设备")}
                                allowClear
                                loading={loading}
                                options={deviceList}
                                onChange={onDeviceKeyChange}
                            />
                        </Form.Item>
                    ) : null
                )
            }
        </Form.Item>
    )
};
