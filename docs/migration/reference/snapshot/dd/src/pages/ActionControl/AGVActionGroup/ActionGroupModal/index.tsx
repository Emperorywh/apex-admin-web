/**
 * @description 动作分组弹窗
 * @date 2025-9-12
 */
import { useEffect, useState } from "react";
import { Modal, Form, Input, Select, message } from "antd";
import { addAGVActionGroup, getAgvActions, updateAGVActionGroup } from "@/api";
import type { AGVActionGroupType, AgvGroupRecord } from "@/types/ActionControl/AGVActionGroup";
import type { ActionRecord } from "@/types/ActionControl/AGVActions";
import { useI18n } from "@/hooks/useI18n";

interface ActionGroupModalProps {
    open: boolean;
    modifyRow?: AgvGroupRecord;
    setOpenModal: (value: boolean) => void;
    setModifyRow: (value?: AgvGroupRecord) => void;
    getAgvActionGroups: () => void;
}

export default (props: ActionGroupModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, modifyRow, setOpenModal, setModifyRow, getAgvActionGroups } = props;

    const [agvActions, setAgvActions] = useState<ActionRecord[]>([]);

    const [form] = Form.useForm();

    const handleAddActionGroup = (values: AGVActionGroupType) => {
        addAGVActionGroup(values).then(res => {
            if (res.code === 200 && res.message === "success") {
                getAgvActionGroups();
                setOpenModal(false);
                form.resetFields();
                message.success(t("新增动作组成功"));
            } else {
                message.warning(t("新增动作组出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("新增动作组出错") + err?.message);
            }
        })
    };

    const handleModifyActionGroup = (values: AGVActionGroupType) => {
        updateAGVActionGroup(values).then(res => {
            if (res.code === 200 && res.message === "success") {
                getAgvActionGroups();
                setOpenModal(false);
                form.resetFields();
                message.success(t("编辑动作组成功"));
            } else {
                message.warning(t("编辑动作组出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("编辑动作组出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const values = form.getFieldsValue(true);
        if (!!modifyRow) {
            handleModifyActionGroup(values);
        } else {
            handleAddActionGroup(values);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setModifyRow(undefined);
        setOpenModal(false);
    };

    useEffect(() => {
        getAgvActions().then(res => {
            if (res.code === 200 && res.message) {
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
        if (modifyRow) {
            const agvActionIds = modifyRow.agvActions?.map(item => item.id) || [];
            form.setFieldsValue({
                id: modifyRow.id,
                agvActionGroupName: modifyRow.actionGroupName,
                agvActionIds
            });
        }
    }, [modifyRow])

    return (
        <Modal
            title={!!modifyRow ? t("编辑车辆动作分组") : t("新增车辆动作分组")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
        >
            <Form
                name="agvActionGroup"
                labelCol={{ span: 8 }}
                wrapperCol={{ span: 16 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<AGVActionGroupType>
                    label={t("动作组名称")}
                    name="agvActionGroupName"
                    rules={[{ required: true, message: t("请输入动作组名称!") }]}
                >
                    <Input
                        placeholder={t("请输入动作组名称")}
                    />
                </Form.Item>

                <Form.Item<AGVActionGroupType>
                    label={t("动作组动作")}
                    name="agvActionIds"
                    rules={[{ required: true, message: t("请选择动作组动作!") }]}
                >
                    <Select
                        placeholder={t("请选择动作组动作")}
                        options={agvActions}
                        mode="multiple"
                        fieldNames={{ label: "actionDescription", value: "id" }}
                    />
                </Form.Item>

            </Form>
        </Modal>
    )
};
