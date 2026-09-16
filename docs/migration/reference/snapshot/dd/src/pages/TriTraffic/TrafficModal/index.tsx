/**
 * @description 三方交管的弹窗
 * @date 2026-1-15
 */
import { useEffect } from "react";
import { Modal, Form, Input, Space, Button, Switch, message, Select } from "antd";
import type { } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { addTripartiteTraffic, updateTripartiteTraffic } from "@/api";
import type { TriTrafficRecord, SimpleTrafficEdgeGroups } from "@/types/TriTraffic";
import { transformListJson, transformJsonList } from "@/utils/format";
import { useI18n } from "@/hooks/useI18n";

interface TrafficModalProps {
    open: boolean;
    edgeGroups: SimpleTrafficEdgeGroups[];
    updateRecord?: TriTrafficRecord;
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
    getTraffics: () => void;
}

export default (props: TrafficModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, edgeGroups, updateRecord, setOpenModal, getTraffics } = props;

    const [form] = Form.useForm();

    const handleAddTraffic = (data: TriTrafficRecord) => {
        addTripartiteTraffic(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                setOpenModal(false);
                getTraffics();
                message.success(t("新增三方交管成功"))
            } else {
                message.warning(t("新增三方交管出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("新增三方交管出错") + err?.message);
            }
        })
    };

    const handleUpdateTraffic = (data: TriTrafficRecord) => {
        updateTripartiteTraffic(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                setOpenModal(false);
                getTraffics();
                message.success(t("编辑三方交管成功"))
            } else {
                message.warning(t("编辑三方交管出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("编辑三方交管出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const values = form.getFieldsValue(true);
        const { extendParam } = values;
        const obj = transformListJson(extendParam);
        const data = {
            ...values,
            extendParam: obj
        }
        if (updateRecord) {
            handleUpdateTraffic(data);
        } else {
            handleAddTraffic(data);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setOpenModal(false);
    };

    useEffect(() => {
        if (updateRecord) {
            // 回显的时候把json转化为数组
            const { extendParam, ...rest } = updateRecord;
            const list = transformJsonList(extendParam as any);
            const data = {
                ...rest,
                extendParam: list
            }
            form.setFieldsValue(data);
        } else {
            form.resetFields();
        }
    }, [updateRecord, open])

    return (
        <Modal
            title={updateRecord ? t("编辑三方交管") : t("新增三方交管")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            forceRender
        >
            <Form
                name="tri-traffic"
                labelCol={{ span: 10 }}
                wrapperCol={{ span: 14 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<TriTrafficRecord>
                    label={t("区域编号")}
                    name="areaCode"
                    rules={[{ required: true, message: t("请输入区域编号") }]}
                >
                    <Input
                        placeholder={t("请输入区域编号")}
                        maxLength={64}
                    />
                </Form.Item>

                <Form.Item<TriTrafficRecord>
                    label={t("点边组合")}
                    name="nodeEdgeGroupId"
                    rules={[{ required: true, message: t("请输入点边组合") }]}
                >
                    <Select
                        placeholder={t("请选择点边组合")}
                        showSearch
                        allowClear
                        optionFilterProp="name"
                        fieldNames={{ label: "name", value: "id" }}
                        options={edgeGroups}
                    />
                </Form.Item>

                <Form.Item<TriTrafficRecord>
                    label={t("是否外部系统作为仲裁方")}
                    name="isExternalArbitrator"
                    rules={[{ required: false, message: "" }]}
                >
                    <Switch />
                </Form.Item>

                <Form.List
                    name="extendParam"
                    rules={[{
                        validator: async (_, extendParam) => {
                            const hasUrl = extendParam?.find((param: { key: string }) => param?.key === "url")
                            if (!hasUrl) {
                                return Promise.reject(new Error(t("必须添加一个URL地址")))
                            }
                            return Promise.resolve();
                        }
                    }]}
                >
                    {(fields, { add, remove }, { errors }) => (
                        <>
                            {fields.map(({ key, name, ...restField }) => (
                                <Space
                                    key={key}
                                    style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }} align="baseline"
                                >
                                    <Form.Item
                                        {...restField}
                                        name={[name, "key"]}
                                        rules={[{ required: true, message: t("Key为必填项") }]}
                                    >
                                        <Input
                                            style={{ width: "150%" }}
                                            placeholder={t("扩展key")}
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        {...restField}
                                        name={[name, "value"]}
                                        rules={[{ required: true, message: t("value为必填项") }]}
                                    >
                                        <Input
                                            style={{ width: "150%" }}
                                            placeholder={t("扩展value")}
                                        />
                                    </Form.Item>
                                    <MinusCircleOutlined onClick={() => remove(name)} />
                                </Space>
                            ))}
                            <Form.Item noStyle>
                                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                    {t("新增扩展参数")}
                                </Button>
                            </Form.Item>
                            <Form.ErrorList errors={errors} />
                        </>
                    )}
                </Form.List>

            </Form>
        </Modal>
    )
};
