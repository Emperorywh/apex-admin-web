/**
 * @description 
 */
import { useEffect, useState } from "react";
import { Modal, Form, Input, Row, Col, Button, message, Select } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { addSysAction, updateSysAction, getSysActionImplements } from "@/api";
import { SysActionType, SysActionRecord, ActionImplements } from "@/types/ActionControl/SysActions";
import { useI18n } from "@/hooks/useI18n";

interface ActionModalProps {
    open: boolean;
    isModify: boolean;
    modifyRow?: SysActionRecord;
    setOpenModal: (value: boolean) => void;
    setModifyRow: (value?: SysActionRecord) => void;
    getSysActions: () => void;
}

export default (props: ActionModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, isModify, modifyRow, setOpenModal, setModifyRow, getSysActions } = props;

    const [actionImplements, setActionImplements] = useState<ActionImplements[]>([]);

    const [form] = Form.useForm();

    const handleAddAction = (values: SysActionType) => {
        addSysAction(values).then(res => {
            if (res.code === 200 && res.message === "success") {
                setOpenModal(false);
                getSysActions();
                form.resetFields();
                message.success(t("新增系统动作成功"));
            } else {
                message.warning(t("新增系统动作出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("新增系统动作出错") + err?.message);
            }
        })
    };

    const handleUpdateAction = (values: SysActionType) => {
        updateSysAction(values).then(res => {
            if (res.code === 200 && res.message === "success") {
                setOpenModal(false);
                getSysActions();
                form.resetFields();
                message.success(t("编辑系统动作成功"));
            } else {
                message.warning(t("编辑系统动作出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("编辑系统动作出错") + err?.message);
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
        setOpenModal(false);
        setModifyRow(undefined);
        form.resetFields();
    };

    useEffect(() => {
        if (modifyRow) {
            form.setFieldsValue(modifyRow);
        }
    }, [modifyRow])

    useEffect(() => {
        getSysActionImplements().then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: ActionImplements[] = res?.data || [];
                setActionImplements(data);
            } else {
                message.warning(t("查询动作集合出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询动作集合出错") + err?.message);
            }
        })
    }, [])

    return (
        <Modal
            title={isModify ? t("编辑动作") : t("新增动作")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
        >
            <Form
                name="sysAction"
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 18 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<SysActionType>
                    label={t("动作类型")}
                    name="actionType"
                    rules={[{ required: true, message: t("请输入动作类型!") }]}
                >
                    <Select
                        allowClear
                        showSearch
                        optionFilterProp="name"
                        placeholder={t("请选择动作类型")}
                        options={actionImplements}
                        fieldNames={{ label: "name", value: "type" }}
                    />
                </Form.Item>

                <Form.Item<SysActionType>
                    label={t("动作描述")}
                    name="actionDescription"
                    rules={[{ required: true, message: t("请输入动作描述!") }]}
                >
                    <Input
                        placeholder={t("请输入动作描述")}
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
