/**
 * @description 地图关联的弹窗
 * @date 2025-7-23
 */
import { useEffect, useState } from "react";
import { Modal, Form, Input, Card, Button, Select, message } from "antd";
import type { FormListFieldData } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import type { CreateCrossMap, SimpleMap, Elevator, CrossMapStation, CrossMapRecord } from "@/types/MultipleMaps";
import { getSimpleMaps, getCrossMapStations, getElevators, createCrossMap, updateCrossMap } from "@/api";
import { useI18n } from "@/hooks/useI18n";

interface MultipMapModalProps {
    open: boolean;
    isModify: boolean;
    modifyRow?: CrossMapRecord;
    getCrossMaps: () => void;
    setModifyRow: (value: React.SetStateAction<CrossMapRecord | undefined>) => void;
    setOpenMultip: (value: React.SetStateAction<boolean>) => void;
}

export default (props: MultipMapModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, isModify, modifyRow, getCrossMaps, setModifyRow, setOpenMultip } = props;

    // 简单地图列表
    const [simpleMaps, setSimpleMaps] = useState<SimpleMap[]>([]);
    // 站点列表
    const [crossMapStations, setCrossMapStations] = useState<CrossMapStation[]>([]);
    // 所有的电梯列表
    const [elevators, setElevators] = useState<Elevator[]>([]);

    const [form] = Form.useForm<CreateCrossMap>();

    const handleCreateCrossMap = (data: CreateCrossMap) => {
        createCrossMap(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                getCrossMaps();
                setOpenMultip(false);
                message.success(t("创建关联地图成功"));
            } else {
                message.warning(t("创建关联地图出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("创建关联地图出错") + err?.message);
            }
        })
    };

    const handleUpdateCrossMap = (data: CreateCrossMap) => {
        updateCrossMap(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                getCrossMaps();
                setOpenMultip(false);
                message.success(t("编辑跨地图关联成功"));
            } else {
                message.warning(t("编辑跨地图关联出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("编辑跨地图关联出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const values = form.getFieldsValue(true);
        if (isModify) {
            handleUpdateCrossMap(values);
        } else {
            handleCreateCrossMap(values);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setModifyRow(undefined);
        setOpenMultip(false);
    };

    const onNodeIdOpenChange = (field: FormListFieldData) => {
        const mapId = form.getFieldValue(["crossMaps", field.name, "mapId"]);
        if (!mapId) return;
        getCrossMapStations({ mapId }).then(res => {
            if (res.code === 200 && res.message === "success") {
                setCrossMapStations(res?.data || []);
            } else {
                message.warning(t("查询跨地图节点出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询跨地图节点出错") + err?.message);
            }
        })
    };

    // 地图改变的时候清空节点的选项
    const onMapIdChange = (field: FormListFieldData) => {
        form.setFieldValue(["crossMaps", field.name, "nodeId"], undefined);
    };

    useEffect(() => {
        if (modifyRow) {
            form.setFieldsValue(modifyRow);
            // 回显的时候回填节点的名称
            const { crossMaps } = modifyRow;
            const trans = crossMaps.map(cross => ({
                name: cross.nodeName,
                id: cross.nodeId,
                mapId: cross.mapId
            }));
            setCrossMapStations(trans);
        }
    }, [modifyRow])

    useEffect(() => {
        getSimpleMaps().then(res => {
            if (res.code === 200 && res.message === "success") {
                setSimpleMaps(res?.data || []);
            } else {
                message.warning(t("查询简单地图列表出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询简单地图列表出错") + err?.message);
            }
        })
    }, [])

    useEffect(() => {
        getElevators().then(res => {
            if (res.code === 200 && res.message === "success") {
                setElevators(res?.data || []);
            } else {
                message.warning(t("查询电梯列表出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询电梯列表出错") + err?.message);
            }
        })
    }, [])

    return (
        <Modal
            title={isModify ? t("编辑跨地图关联") : t("创建跨地图关联")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
        >
            <Form
                name="crossMapsForm"
                labelCol={{ span: 8 }}
                wrapperCol={{ span: 16 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<CreateCrossMap>
                    label={t("跨地图名称")}
                    name="crossMapName"
                    rules={[{ required: true, message: t("请输入跨地图名称") }]}
                >
                    <Input
                        placeholder={t("请输入跨地图名称")}
                        maxLength={64}
                        showCount
                        allowClear
                    />
                </Form.Item>

                <Form.Item<CreateCrossMap>
                    label={t("跨地图电梯")}
                    name="deviceKey"
                    rules={[{ required: true, message: t("请选择跨地图电梯") }]}
                >
                    <Select
                        placeholder={t("请选择跨地图电梯")}
                        allowClear
                        showSearch
                        optionFilterProp="deviceName"
                        options={elevators}
                        fieldNames={{ label: "deviceName", value: "deviceKey" }}
                    />
                </Form.Item>

                <Form.List
                    name="crossMaps"
                    rules={[
                        {
                            validator: async (_, value) => {
                                if (!value || value.length < 2) {
                                    return Promise.reject(new Error(t("至少关联两张地图")));
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
                                    title={t("地图 {index}", { index: field.name + 1 })}
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
                                        validateFirst
                                        rules={[
                                            { required: true, message: t("请选择地图名称") },
                                            ({ getFieldValue }) => ({
                                                validator(_, value) {
                                                    // 判断当前地图是不是被选择了
                                                    const selectedMaps = fields.filter(field => value === getFieldValue(["crossMaps", field.name, "mapId"]));
                                                    if (value && selectedMaps?.length === 1) {
                                                        return Promise.resolve();
                                                    }
                                                    return Promise.reject(new Error(t("不能重复选择相同的地图")));
                                                }
                                            })
                                        ]}
                                    >
                                        <Select
                                            placeholder={t("请选择地图名称")}
                                            showSearch
                                            allowClear
                                            optionFilterProp="mapName"
                                            options={simpleMaps}
                                            fieldNames={{ label: "mapName", value: "mapId" }}
                                            onChange={() => onMapIdChange(field)}
                                        />
                                    </Form.Item>

                                    <Form.Item
                                        label={t("节点名称")}
                                        name={[field.name, "nodeId"]}
                                        rules={[{ required: true, message: t("请选择节点名称") }]}
                                    >
                                        <Select
                                            placeholder={t("请选择节点名称")}
                                            allowClear
                                            showSearch
                                            optionFilterProp="name"
                                            fieldNames={{ label: "name", value: "id" }}
                                            options={crossMapStations}
                                            onOpenChange={(open) => open && onNodeIdOpenChange(field)}
                                        />
                                    </Form.Item>
                                </Card>
                            ))}
                            <Button
                                type="dashed"
                                onClick={() => add()}
                                block
                            >
                                {t("+ 添加关联地图")}
                            </Button>
                            <Form.ErrorList errors={errors} />
                        </div>
                    )}
                </Form.List>

            </Form>
        </Modal>
    )
};
