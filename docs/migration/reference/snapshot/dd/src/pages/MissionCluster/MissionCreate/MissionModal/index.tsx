/**
 * @description 任务的弹窗
 * @date 2025-10-29
 */
import { useState, useEffect, Children } from "react";
import { Modal, Form, Input, Select, Card, Button, message, Col, Row } from "antd";
import type { FormListFieldData } from "antd";
import { CloseOutlined, MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import type { SimpleVehicle, Records } from "@/types/VehicleDeploy/GroupType";
import type { SimpleMapList } from "@/types/OverLook";
import type { CrossMapStation, VehicleAction } from "@/types/MultipleMaps";
import { getCrossMapStations, getSimpleVehicles, getVehicleGroups, getSimpleMaps, createOrderTemplate, updateOrderTemplate } from "@/api";
import type { OrderGroupType, OrderTemplateRecord, Actions } from "@/types/MissionCluster/MissionCreate";
import { blockingOptions } from "@/constants";
import { useI18n } from "@/hooks/useI18n";

interface MissionCreateProps {
    open: boolean;
    isModify: boolean;
    modifyRow?: OrderTemplateRecord;
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
    setModifyRow: (value: React.SetStateAction<OrderTemplateRecord | undefined>) => void;
    getOrderGroups: () => void;
}

export default (props: MissionCreateProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, isModify, modifyRow, setOpenModal, setModifyRow, getOrderGroups } = props;

    // 车辆列表
    const [simpleVehicles, setSimpleVehicles] = useState<SimpleVehicle[]>([]);
    // 车辆分组列表
    const [vehicleGroups, setVehicleGroups] = useState<Records[]>([]);
    // 地图列表
    const [simpleMaps, setSimpleMaps] = useState<SimpleMapList[]>([]);
    /**
     * 每个地图对应的站点列表，按 mapId 分类存储，
     * 避免多个子任务共享同一份站点选项导致数据错乱
     */
    const [stationsMap, setStationsMap] = useState<Record<string, CrossMapStation[]>>({});

    const [form] = Form.useForm();

    // 新增任务组合的请求
    const createOrderTemplateRequest = (data: OrderGroupType) => {
        createOrderTemplate(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                setOpenModal(false);
                form.resetFields();
                getOrderGroups();
                message.success(t("创建任务成功"));
            } else {
                message.warning(t("创建任务出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("创建任务出错") + err?.message);
            }
        })
    };

    // 编辑任务组合的请求
    const updateOrderTemplateRequest = (data: OrderGroupType) => {
        updateOrderTemplate(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                setOpenModal(false);
                form.resetFields();
                getOrderGroups();
                message.success(t("更新任务成功"));
            } else {
                message.warning(t("更新任务出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("更新任务出错") + err?.message);
            }
        })
    };

    /**
     * 提交表单，用 try-catch 包裹 validateFields，
     * 避免验证失败时抛出未捕获异常
     */
    const handleOk = async () => {
        try {
            await form.validateFields();
            const values = form.getFieldsValue(true);
            console.log("提交的值", values);
            if (isModify) {
                updateOrderTemplateRequest(values);
            } else {
                createOrderTemplateRequest(values);
            }
        } catch (error) {
            // 表单验证失败，antd 会自动显示错误信息
            console.log("表单验证失败", error);
        }
    };

    const handleCancel = () => {
        setOpenModal(false);
        form.resetFields();
        setModifyRow(undefined);
    };

    // 重新选择地图的时候 清空已选择的站点
    const onMissionMapIdChange = (field: FormListFieldData) => {
        form.setFieldValue(["orderMissions", field.name, "stationId"], undefined);
    };

    /**
     * 根据地图 id 获取对应的站点列表，按 mapId 缓存到 stationsMap，
     * 避免不同子任务的站点选项互相覆盖
     */
    const onNodeIdOpenChange = (field: FormListFieldData) => {
        const mapId = form.getFieldValue(["orderMissions", field.name, "mapId"]);
        if (!mapId) return;
        getCrossMapStations({ mapId }).then(res => {
            if (res.code === 200 && res.message === "success") {
                setStationsMap(prev => ({
                    ...prev,
                    [mapId]: res?.data || []
                }));
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

    /**
     * 编辑/复制时回显表单数据，
     * 先重置表单再赋值，避免残留上一个工艺的数据
     */
    useEffect(() => {
        if (modifyRow) {
            form.resetFields();
            // 回显时把每个地图的站点名按 mapId 分类存储
            const { orderMissions } = modifyRow;
            const initialStations: Record<string, CrossMapStation[]> = {};
            orderMissions?.forEach(order => {
                if (order.mapId) {
                    if (!initialStations[order.mapId]) {
                        initialStations[order.mapId] = [];
                    }
                    initialStations[order.mapId].push({
                        id: order?.stationId,
                        name: order?.stationName
                    });
                }
            });
            setStationsMap(initialStations);
            // 回显表格
            form.setFieldsValue(modifyRow);
        }
    }, [modifyRow])

    return (
        <Modal
            title={isModify && modifyRow ? t("编辑任务") : !isModify && modifyRow ? t("复制任务") : t("创建任务")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
        >
            <Form
                name="createOrderGroupForm"
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 18 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<OrderGroupType>
                    label={t("模板名称")}
                    name="orderTemplateName"
                    rules={[{ required: true, message: t("请输入模板名称") }]}
                >
                    <Input
                        placeholder={t("请输入模板名称")}
                    />
                </Form.Item>

                <Form.Item<OrderGroupType>
                    noStyle
                    shouldUpdate={(preValue, curValue) => preValue.appointVehicleGroupKey !== curValue.appointVehicleGroupKey}
                >
                    {
                        ({ getFieldValue }) => (
                            !getFieldValue("appointVehicleGroupKey") && (
                                <Form.Item<OrderGroupType>
                                    label={t("指定车辆")}
                                    name="appointVehicleKey"
                                    rules={[{ required: false, message: t("请选择指定车辆") }]}
                                >
                                    <Select
                                        placeholder={t("请选择订单指定车辆")}
                                        allowClear
                                        showSearch
                                        options={simpleVehicles}
                                        fieldNames={{ label: "name", value: "key" }}
                                    />
                                </Form.Item>
                            )
                        )
                    }
                </Form.Item>

                <Form.Item<OrderGroupType>
                    noStyle
                    shouldUpdate={(preValue, curValue) => preValue.appointVehicleKey !== curValue.appointVehicleKey}
                >
                    {
                        ({ getFieldValue }) => (
                            !getFieldValue("appointVehicleKey") && (
                                <Form.Item<OrderGroupType>
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

                {/* 子任务列表 */}
                <Form.List
                    name="orderMissions"
                    rules={[
                        {
                            validator: async (_, orderMissions) => {
                                if (!orderMissions || orderMissions?.length < 1) {
                                    return Promise.reject(new Error(t("子任务不能为空")));
                                }
                            }
                        }
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
                                            options={stationsMap[form.getFieldValue(["orderMissions", field.name, "mapId"])] || []}
                                            onOpenChange={(open) => open && onNodeIdOpenChange(field)}
                                        />
                                    </Form.Item>

                                    {/* 动作列表 */}
                                    <Form.List name={[field.name, "actions"]}>
                                        {(actionFields, { add: addAction, remove: removeAction }) => (
                                            <div style={{ display: "flex", rowGap: 16, flexDirection: "column" }}>
                                                {actionFields.map(({ key: actionKey, name: ActionName, ...restActionField }) => (
                                                    <Card
                                                        size="small"
                                                        title={t("动作 {index}", { index: ActionName + 1 })}
                                                        key={actionKey}
                                                        extra={
                                                            <CloseOutlined
                                                                onClick={() => {
                                                                    removeAction(ActionName);
                                                                }}
                                                            />
                                                        }
                                                    >
                                                        <Form.Item<Actions>
                                                            {...restActionField}
                                                            label={t("动作类型")}
                                                            name={[ActionName, "actionType"]}
                                                            rules={[{ required: true, message: t("请输入动作类型!") }]}
                                                        >
                                                            <Input
                                                                placeholder={t("请输入动作类型")}
                                                            />
                                                        </Form.Item>

                                                        <Form.Item<Actions>
                                                            {...restActionField}
                                                            label={t("动作描述")}
                                                            name={[ActionName, "actionDescription"]}
                                                            rules={[{ required: true, message: t("请输入动作描述!") }]}
                                                        >
                                                            <Input
                                                                placeholder={t("请输入动作描述")}
                                                            />
                                                        </Form.Item>

                                                        <Form.Item<Actions>
                                                            {...restActionField}
                                                            label={t("阻塞类型")}
                                                            name={[ActionName, "blockingType"]}
                                                            rules={[{ required: true, message: t("请选择阻塞类型!") }]}
                                                        >
                                                            <Select
                                                                allowClear
                                                                placeholder={t("请选择阻塞类型")}
                                                                options={blockingOptions}
                                                            />
                                                        </Form.Item>

                                                        {/* 动作参数列表 */}
                                                        <Form.List {...restActionField} name={[ActionName, "actionParameters"]}>
                                                            {(paramterFields, { add: addParamter, remove: removeParamter }) => (
                                                                <>
                                                                    {paramterFields.map(({ key, name, ...restField }) => (
                                                                        <Row key={key}>
                                                                            <Col span={11}>
                                                                                <Form.Item
                                                                                    {...restField}
                                                                                    name={[name, "key"]}
                                                                                    rules={[{ required: true, message: t("请输入动作名") }]}
                                                                                >
                                                                                    <Input placeholder={t("动作名")} />
                                                                                </Form.Item>
                                                                            </Col>
                                                                            <Col span={11}>
                                                                                <Form.Item
                                                                                    {...restField}
                                                                                    name={[name, "value"]}
                                                                                    rules={[{ required: true, message: t("请输入动作值") }]}
                                                                                >
                                                                                    <Input placeholder={t("动作值")} />
                                                                                </Form.Item>
                                                                            </Col>
                                                                            <Col span={2}>
                                                                                <MinusCircleOutlined onClick={() => removeParamter(name)} />
                                                                            </Col>
                                                                        </Row>
                                                                    ))}
                                                                    <Form.Item noStyle>
                                                                        <Button type="dashed" onClick={() => addParamter()} block icon={<PlusOutlined />}>
                                                                            {t("添加子任务动作参数")}
                                                                        </Button>
                                                                    </Form.Item>
                                                                </>
                                                            )}
                                                        </Form.List>
                                                    </Card>
                                                ))}

                                                <Button type="dashed" onClick={() => addAction()} block icon={<PlusOutlined />}>
                                                    {t("添加子任务动作")}
                                                </Button>
                                            </div>
                                        )}
                                    </Form.List>
                                </Card>
                            ))}
                            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                {t("添加子任务")}
                            </Button>
                            <Form.ErrorList errors={errors} />
                        </div>
                    )}
                </Form.List>

            </Form>
        </Modal>
    )
};
