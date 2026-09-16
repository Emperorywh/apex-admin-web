/**
 * @description 车辆动作的弹窗
 * @date 2025-9-9
 */
import { useEffect } from "react";
import { Modal, Form, Input, Space, Button, Row, Col, Select, message } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { addAGVAction, updateAGVAction } from "@/api";
import type { AGVActionType, ActionRecord } from "@/types/ActionControl/AGVActions";
import { blockingOptions } from "@/constants";
import { useI18n } from "@/hooks/useI18n";

interface ActionModalProps {
    open: boolean;
    isModify: boolean;
    modifyRow?: ActionRecord,
    pageActions: () => void;
    setOpenModal: (value: boolean) => void;
    setModifyRow: (value?: ActionRecord) => void;
}

export default (props: ActionModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, isModify, modifyRow, pageActions, setOpenModal, setModifyRow } = props;

    const [form] = Form.useForm();

    const handleAddAction = (values: AGVActionType) => {
        addAGVAction(values).then(res => {
            if (res.code === 200 && res.message === "success") {
                pageActions();
                setOpenModal(false);
                form.resetFields();
                message.success(t("添加动作成功"));
            } else {
                message.warning(t("添加动作出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("添加动作出错") + err?.message);
            }
        })
    };

    const handleUpdateAction = (values: AGVActionType) => {
        updateAGVAction(values).then(res => {
            if (res.code === 200 && res.message === "success") {
                pageActions();
                setOpenModal(false);
                form.resetFields();
                message.success(t("编辑动作成功"));
            } else {
                message.warning(t("编辑动作出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("编辑动作出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const values = form.getFieldsValue(true);
        if (isModify) {
            handleUpdateAction(values);
        } else {
            handleAddAction(values);
        }
    };

    const handleCancel = () => {
        setModifyRow(undefined);
        setOpenModal(false);
        form.resetFields();
    };

    useEffect(() => {
        if (modifyRow) {
            form.setFieldsValue(modifyRow);
        }
    }, [modifyRow])

    return (
        <Modal
            title={isModify ? t("编辑动作") : t("新增动作")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
        >
            <Form
                name="agvAction"
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 18 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<AGVActionType>
                    label={t("动作类型")}
                    name="actionType"
                    rules={[{ required: true, message: t("请输入动作类型!") }]}
                >
                    <Input
                        placeholder={t("请输入动作类型")}
                    />
                </Form.Item>

                <Form.Item<AGVActionType>
                    label={t("动作描述")}
                    name="actionDescription"
                    rules={[{ required: true, message: t("请输入动作描述!") }]}
                >
                    <Input
                        placeholder={t("请输入动作描述")}
                    />
                </Form.Item>

                <Form.Item<AGVActionType>
                    label={t("阻塞类型")}
                    name="blockingType"
                    rules={[{ required: true, message: t("请选择阻塞类型!") }]}
                >
                    <Select
                        allowClear
                        placeholder={t("请选择阻塞类型")}
                        options={blockingOptions}
                    />
                </Form.Item>

                <Form.List name="actionParameters">
                    {(fields, { add, remove }) => (
                        <>
                            {fields.map(({ key, name, ...restField }) => (
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
                                        <MinusCircleOutlined onClick={() => remove(name)} />
                                    </Col>
                                </Row>
                            ))}
                            <Form.Item noStyle>
                                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                    {t("添加动作参数")}
                                </Button>
                            </Form.Item>
                        </>
                    )}
                </Form.List>

            </Form>
        </Modal>
    )
};
