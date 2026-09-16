/**
 * @description 连通性校验
 * @date 2025-7-29
 */
import { useEffect, useState } from "react";
import { Modal, Form, Select, message } from "antd";
import { getSimpleMaps, connectivityVerification, getStations } from "@/api";
import type { SimpleMapList, GetStationsItem } from "@/types/OverLook";
import { useI18n } from "@/hooks/useI18n";

type FieldType = {
    mapId?: string;
    endMapId?: string;
    snodeId: string;
    enodeId: string;
}

interface VerifyConnectModalProps {
    open: boolean;
    setOpenVerifyModal: (value: React.SetStateAction<boolean>) => void;
}

export default (props: VerifyConnectModalProps) => {

    const { open, setOpenVerifyModal } = props;

    /* 国际化翻译方法，用于将连通性校验弹窗的文案进行多语言转换 */
    const { t } = useI18n();

    // 地图列表
    const [simpleMaps, setSimpleMaps] = useState<SimpleMapList[]>([]);
    // 起点站点列表
    const [stations, setStations] = useState<GetStationsItem[]>([]);
    // 终点站点列表
    const [endStations, setEndStations] = useState<GetStationsItem[]>([]);

    const [form] = Form.useForm<FieldType>();
    const mapId = Form.useWatch("mapId", form);
    const endMapId = Form.useWatch("endMapId", form);

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const values = form.getFieldsValue();
        connectivityVerification(values).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                setOpenVerifyModal(false);
                message.success(t("路径连通性校验成功") + res?.message);
            } else {
                message.warning(t("校验出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("校验出错") + err?.message);
            }
        })
    };

    const handleCancel = () => {
        form.resetFields();
        setOpenVerifyModal(false);
    };

    useEffect(() => {
        if (!mapId) return;
        getStations({ mapId, type: "" }).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.setFieldsValue({
                    snodeId: undefined
                });
                setStations(res?.data || []);
            } else {
                message.warning(t("节点列表查询出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("节点列表查询出错") + err?.message);
            }
        })
    }, [mapId])

    useEffect(() => {
        if (!endMapId) return;
        getStations({ mapId: endMapId, type: "" }).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.setFieldsValue({
                    enodeId: undefined
                });
                setEndStations(res?.data || []);
            } else {
                message.warning(t("终点节点列表查询出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("终点节点列表查询出错") + err?.message);
            }
        })
    }, [endMapId])

    useEffect(() => {
        getSimpleMaps().then(res => {
            if (res.code === 200 && res.message === "success") {
                setSimpleMaps(res?.data || []);
            } else {
                message.warning(t("查询简单地图出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询简单地图出错") + err?.message);
            }
        })
    }, [])

    return (
        <Modal
            title={t("路径连通性校验")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
        >
            <Form
                name="basic"
                labelCol={{ span: 4 }}
                wrapperCol={{ span: 20 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<FieldType>
                    label={t("起点地图")}
                    name="mapId"
                    rules={[{ required: true, message: t("请选择地图") }]}
                >
                    <Select
                        placeholder={t("请选择地图")}
                        options={simpleMaps}
                        fieldNames={{ label: "mapName", value: "mapId" }}
                    />
                </Form.Item>
                <Form.Item<FieldType>
                    label={t("起点")}
                    name="snodeId"
                    validateFirst
                    rules={[{ required: true, message: t("请选择路径起点") },
                    ({ getFieldValue }) => ({
                        validator(_, value) {
                            if (getFieldValue("enodeId") !== value) {
                                return Promise.resolve();
                            }
                            return Promise.reject(new Error(t("起点和终点不能相同")));
                        }
                    })
                    ]}
                >
                    <Select
                        placeholder={t("请选择路径起点")}
                        allowClear
                        showSearch
                        options={stations}
                        fieldNames={{ label: "name", value: "id" }}
                        optionFilterProp="name"
                    />
                </Form.Item>
                <Form.Item<FieldType>
                    label={t("终点地图")}
                    name="endMapId"
                    rules={[{ required: true, message: t("请选择地图") }]}
                >
                    <Select
                        placeholder={t("请选择地图")}
                        options={simpleMaps}
                        fieldNames={{ label: "mapName", value: "mapId" }}
                    />
                </Form.Item>
                <Form.Item<FieldType>
                    label={t("终点")}
                    name="enodeId"
                    validateFirst
                    rules={[{ required: true, message: t("请选择路径终点") },
                    ({ getFieldValue }) => ({
                        validator(_, value) {
                            if (getFieldValue("snodeId") !== value) {
                                return Promise.resolve();
                            }
                            return Promise.reject(new Error(t("终点和起点不能相同")));
                        }
                    })
                    ]}
                >
                    <Select
                        placeholder={t("请选择路径终点")}
                        allowClear
                        showSearch
                        options={endStations}
                        fieldNames={{ label: "name", value: "id" }}
                        optionFilterProp="name"
                    />
                </Form.Item>
            </Form>
        </Modal>
    )
};
