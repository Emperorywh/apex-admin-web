/**
 * @description 创建订单的弹窗
 * @date 2025-7-28
 */
import { useEffect, useState } from "react";
import { Modal, Form, Input, InputNumber, Select, Card, Button, message } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import type { FormListFieldData, SelectProps } from "antd";
import {
    getSimpleVehicles,
    getSimpleMaps,
    getVehicleGroups,
    getCrossMapStations,
    createOrderRecord,
    getAgvActions,
    getAGVActionGroups
} from "@/api";
import type { SimpleVehicle, Records } from "@/types/VehicleDeploy/GroupType";
import type { SimpleMapList } from "@/types/OverLook";
import type { CrossMapStation, VehicleAction } from "@/types/MultipleMaps";
import type { OrderMission } from "@/types/OrderRecord";
import type { AgvGroupRecord } from "@/types/ActionControl/AGVActionGroup";
import { useI18n } from "@/hooks/useI18n";

type FieldType = {
    orderName: string;
    priority: number;
    appointVehicleKey: string;
    appointVehicleGroupKey: string;
    orderMissions: OrderMission[];
}

interface CreateOrderModalProps {
    open: boolean;
    setOpenCreateOrder: (value: React.SetStateAction<boolean>) => void;
}

export default (props: CreateOrderModalProps) => {

    const { open, setOpenCreateOrder } = props;

    const { t } = useI18n();

    // 车辆列表
    const [simpleVehicles, setSimpleVehicles] = useState<SimpleVehicle[]>([]);
    // 地图列表
    const [simpleMaps, setSimpleMaps] = useState<SimpleMapList[]>([]);
    // 车辆分组列表
    const [vehicleGroups, setVehicleGroups] = useState<Records[]>([]);
    // 站点列表
    const [crossMapStations, setCrossMapStations] = useState<CrossMapStation[]>([]);
    // 车辆动作列表
    const [agvActions, setAgvActions] = useState<VehicleAction[]>([]);
    // 车辆动作组列表
    const [agvActionGroups, setAgvActionGroups] = useState<AgvGroupRecord[]>([]);

    const [form] = Form.useForm<FieldType>();

    // 确定按钮的 loading 状态，提交创建订单时展示
    const [confirmLoading, setConfirmLoading] = useState(false);

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        // 提交期间禁用确定按钮并展示 loading
        setConfirmLoading(true);
        const values = form.getFieldsValue();
        // 单独处理子任务 车辆任务和车辆任务组共用一个字段
        const { orderMissions } = values;
        const initMissions = orderMissions?.map(mission => ({
            ...mission,
            agvAction: undefined,
            agvActionGroup: undefined,
            // 车辆动作的话 直接传动作id对应的动作；车辆动作组的话传动作组下面的所有动作
            actions: (typeof mission.agvAction === "number" && !isNaN(mission.agvAction)) ? agvActions.filter(action => action?.id === mission?.agvAction) : agvActionGroups.find(group => group?.id === mission?.agvActionGroup)?.agvActions
        }))
        const initValues = {
            ...values,
            orderMissions: [...(initMissions || [])]
        };
        createOrderRecord(initValues).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                setOpenCreateOrder(false);
                message.success(t("创建订单成功"));
            } else {
                message.warning(t("创建订单出错") + res?.message);
            }
        }).catch(err => {
            message.error(t("创建订单出错") + err?.message);
        }).finally(() => {
            // 无论成功失败，都复位确定按钮的 loading
            setConfirmLoading(false);
        })
    };

    const handleCancel = () => {
        form.resetFields();
        setOpenCreateOrder(false);
    };

    // 重新选择地图的时候 清空已选择的站点
    const onMissionMapIdChange = (field: FormListFieldData) => {
        form.setFieldValue(["orderMissions", field.name, "stationId"], undefined);
    };

    // 根据地图id渲染地图对应的站点
    const onNodeIdOpenChange = (field: FormListFieldData) => {
        const mapId = form.getFieldValue(["orderMissions", field.name, "mapId"]);
        if (!mapId) return;
        getCrossMapStations({ mapId }).then(res => {
            if (res.code === 200 && res.message === "success") {
                // 按 name 升序排序（字母 a-z，数字从小到大）
                const sorted = [...(res?.data || [])].sort((a, b) =>
                    a.name.localeCompare(b.name, undefined, { numeric: true }),
                );
                setCrossMapStations(sorted);
            } else {
                message.warning(t("查询跨地图节点出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询跨地图节点出错") + err?.message);
            }
        })
    };

    useEffect(() => {
        getSimpleVehicles().then(res => {
            if (res.code === 200 && res.message === "success") {
                setSimpleVehicles(res?.data || []);
            } else {
                message.warning(t("查询车辆列表出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询车辆列表出错") + err?.message);
            }
        })
    }, [])

    useEffect(() => {
        getVehicleGroups().then(res => {
            if (res.code === 200 && res.message === "success") {
                setVehicleGroups(res?.data || []);
            } else {
                message.warning(t("查询车辆分组出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询车辆分组出错") + err?.message);
            }
        })
    }, [])

    useEffect(() => {
        getSimpleMaps().then(res => {
            if (res.code === 200 && res.message === "success") {
                setSimpleMaps(res?.data || []);
            } else {
                message.warning(t("查询地图列表出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询地图列表出错") + err?.message);
            }
        })
    }, [])

    useEffect(() => {
        getAgvActions().then(res => {
            if (res.code === 200 && res.message === "success") {
                setAgvActions(res?.data || []);
            } else {
                message.warning(t("查询车辆动作出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询车辆动作出错") + err?.message);
            }
        })
    }, [])

    useEffect(() => {
        getAGVActionGroups().then(res => {
            if (res.code === 200 && res.message === "success") {
                setAgvActionGroups(res?.data || []);
            } else {
                message.warning(t("查询车辆动作组出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询车辆动作组出错") + err?.message);
            }
        })
    }, [])

    return (
        <Modal
            title={t("创建任务")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
            confirmLoading={confirmLoading}
        >
            <Form
                name="createOrderForm"
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 18 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<FieldType>
                    label={t("任务名称")}
                    name="orderName"
                    rules={[{ required: true, message: t("请输入订单名称") }]}
                >
                    <Input
                        placeholder={t("请输入订单名称")}
                    />
                </Form.Item>

                <Form.Item<FieldType>
                    label={t("优先级")}
                    name="priority"
                    rules={[{ required: false, message: t("请输入优先级") }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        min={0}
                        max={999}
                        placeholder={t("请输入优先级[0-999]")}
                    />
                </Form.Item>

                <Form.Item
                    noStyle
                    shouldUpdate={(preValue, curValue) => preValue.appointVehicleGroupKey !== curValue.appointVehicleGroupKey}
                >
                    {
                        ({ getFieldValue }) => (
                            !getFieldValue("appointVehicleGroupKey") && (
                                <Form.Item<FieldType>
                                    label={t("指定车辆")}
                                    name="appointVehicleKey"
                                    rules={[{ required: false, message: t("请选择指定车辆") }]}
                                >
                                    <Select
                                        placeholder={t("请选择订单指定车辆")}
                                        allowClear
                                        showSearch
                                        options={simpleVehicles}
                                        optionFilterProp="name"
                                        fieldNames={{ label: "name", value: "key" }}
                                    />
                                </Form.Item>
                            )
                        )
                    }
                </Form.Item>

                <Form.Item
                    noStyle
                    shouldUpdate={(preValue, curValue) => preValue.appointVehicleKey !== curValue.appointVehicleKey}
                >
                    {
                        ({ getFieldValue }) => (
                            !getFieldValue("appointVehicleKey") && (
                                <Form.Item<FieldType>
                                    label={t("指定车辆分组")}
                                    name="appointVehicleGroupKey"
                                    rules={[{ required: false, message: t("请选择车辆分组") }]}
                                >
                                    <Select
                                        placeholder={t("请选择车辆分组")}
                                        allowClear
                                        showSearch
                                        options={vehicleGroups}
                                        fieldNames={{ label: "agvGroupName", value: "agvGroupKey" }}
                                    />
                                </Form.Item>
                            )
                        )
                    }
                </Form.Item>

                <Form.List
                    name="orderMissions"
                    rules={[
                        {
                            validator: async (_, orderMissions) => {
                                if (!orderMissions || orderMissions?.length < 1) {
                                    return Promise.reject(new Error(t("子任务不能为空")));
                                }
                            },
                        },
                    ]}
                >
                    {(fields, { add, remove }, { errors }) => (
                        <div style={{ display: "flex", rowGap: 16, flexDirection: "column" }}>
                            {fields.map((field) => (
                                <Card
                                    size="small"
                                    title={t("子任务 {index}", { index: field.name + 1 })}
                                    key={field.key}
                                    extra={
                                        <CloseOutlined
                                            onClick={() => {
                                                remove(field.name);
                                            }}
                                        />
                                    }
                                >
                                    <Form.Item
                                        label={t("地图名称")}
                                        name={[field.name, "mapId"]}
                                        rules={[{ required: true, message: t("请选择地图") }]}
                                    >
                                        <Select
                                            placeholder={t("请选择地图")}
                                            allowClear
                                            showSearch
                                            optionFilterProp="mapName"
                                            options={simpleMaps}
                                            fieldNames={{ label: "mapName", value: "mapId" }}
                                            onChange={() => onMissionMapIdChange(field)}
                                        />
                                    </Form.Item>

                                    <Form.Item
                                        label={t("站点名称")}
                                        name={[field.name, "stationId"]}
                                        rules={[{ required: true, message: t("请选择站点") }]}
                                    >
                                        <Select
                                            placeholder={t("请选择站点")}
                                            allowClear
                                            showSearch
                                            optionFilterProp="name"
                                            fieldNames={{ label: "name", value: "id" }}
                                            options={crossMapStations}
                                            onOpenChange={(open) => open && onNodeIdOpenChange(field)}
                                        />
                                    </Form.Item>

                                    <Form.Item
                                        noStyle
                                        shouldUpdate
                                    >
                                        {
                                            ({ getFieldValue }) => (
                                                !getFieldValue(["orderMissions", field.name, "agvActionGroup"]) && (
                                                    <Form.Item
                                                        label={t("车辆动作")}
                                                        name={[field.name, "agvAction"]}
                                                    >
                                                        <Select
                                                            placeholder={t("请选择车辆动作")}
                                                            allowClear
                                                            showSearch
                                                            optionFilterProp="actionDescription"
                                                            fieldNames={{ label: "actionDescription", value: "id" }}
                                                            options={agvActions}
                                                        />
                                                    </Form.Item>
                                                )
                                            )
                                        }
                                    </Form.Item>

                                    <Form.Item
                                        noStyle
                                        shouldUpdate
                                    >
                                        {
                                            ({ getFieldValue }) => (
                                                !getFieldValue(["orderMissions", field.name, "agvAction"]) && (
                                                    <Form.Item
                                                        label={t("动作分组")}
                                                        name={[field.name, "agvActionGroup"]}
                                                    >
                                                        <Select
                                                            placeholder={t("请选择车辆动作分组")}
                                                            allowClear
                                                            showSearch
                                                            optionFilterProp="actionGroupName"
                                                            fieldNames={{ label: "actionGroupName", value: "id" }}
                                                            options={agvActionGroups}
                                                        />
                                                    </Form.Item>
                                                )
                                            )
                                        }
                                    </Form.Item>

                                </Card>
                            ))}
                            <Button type="dashed" onClick={() => add()} block>
                                {t("+ 添加车辆子任务")}
                            </Button>
                            <Form.ErrorList errors={errors} />
                        </div>
                    )}
                </Form.List>

            </Form>
        </Modal>
    )
};
