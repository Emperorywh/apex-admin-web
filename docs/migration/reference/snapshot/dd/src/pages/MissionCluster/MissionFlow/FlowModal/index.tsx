/**
 * @description 订单分组弹窗
 * @date 2025-10-30
 */
import { useState, useEffect } from "react";
import { Modal, Form, Input, InputNumber, Radio, Transfer, message } from "antd";
import type { TransferProps } from "antd";
import type { OrderGroupForm } from "@/types/MissionCluster/MissionFlow";
import type { OrderTemplateRecord } from "@/types/MissionCluster/MissionCreate";
import type { OrderGroupRecord } from "@/types/MissionCluster/MissionFlow";
import { createOrderFlow, getOrderTemplates } from "@/api";
import { triggerTypes, cronRegex } from "@/constants/MissionCluster";
import CronExpress from "./CronExpress";
import { useI18n } from "@/hooks/useI18n";

interface GroupModalProps {
    open: boolean;
    repeatRow?: OrderGroupRecord;
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
    setRepeatRow: (value: React.SetStateAction<OrderGroupRecord | undefined>) => void;
    getOrderFlows: () => void;
}

export default (props: GroupModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, repeatRow, setOpenModal, setRepeatRow, getOrderFlows } = props;

    // 查询到的任务列表
    const [orderGroups, setOrderGroups] = useState<OrderTemplateRecord[]>([]);
    // 已经选择的任务集合 右边
    const [targetKeys, setTargetKeys] = useState<TransferProps["targetKeys"]>([]);
    // 所有可选的任务集合 左边
    const [selectedKeys, setSelectedKeys] = useState<TransferProps["targetKeys"]>([]);

    const [form] = Form.useForm();

    // 创建订单组合的请求
    const createOrderGroupRequest = (data: OrderGroupForm) => {
        createOrderFlow(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                getOrderFlows();
                setOpenModal(false);
                form.resetFields();
                message.success(t("创建任务分组成功"));
            } else {
                message.warning(t("创建任务分组出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("创建任务分组出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const values = form.getFieldsValue(true);
        console.log("表单提交项", values);
        createOrderGroupRequest(values);
    };

    const handleCancel = () => {
        setOpenModal(false);
        setRepeatRow(undefined);
        setTargetKeys([]);
        setSelectedKeys([]);
        form.resetFields();
    };

    const onChange: TransferProps["onChange"] = (nextTargetKeys, direction, moveKeys) => {
        setTargetKeys(nextTargetKeys);
    };

    const onSelectChange: TransferProps["onSelectChange"] = (sourceSelectedKeys, targetSelectedKeys) => {
        setSelectedKeys([...sourceSelectedKeys, ...targetSelectedKeys]);
    };

    useEffect(() => {
        getOrderTemplates().then(res => {
            if (res.code === 200 && res.message === "success") {
                setOrderGroups(res?.data || []);
            } else {
                message.warning(t("查询任务列表出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询任务列表出错"), err?.message);
            }
        })
    }, [])

    useEffect(() => {
        if (repeatRow) {
            // 是重发，给表单赋值
            const { orderFlowName, cronExpression, subOrderFlows, triggerTimes, triggerType } = repeatRow;
            const orderTemplateKeys = subOrderFlows.map(flow => flow.orderTemplateKey);
            form.setFieldsValue({
                orderFlowName,
                cronExpression,
                orderTemplateKeys,
                triggerTimes,
                triggerType
            });
            setTargetKeys(orderTemplateKeys);
        }
    }, [repeatRow])

    return (
        <Modal
            title={t("创建工艺")}
            open={open}
            width={1200}
            onOk={handleOk}
            onCancel={handleCancel}
        >
            <Form
                name="missionFlowForm"
                labelCol={{ span: 4 }}
                wrapperCol={{ span: 20 }}
                autoComplete="off"
                form={form}
                initialValues={{
                    triggerType: 0,
                    orderGroupKeys: []
                }}
            >
                <Form.Item<OrderGroupForm>
                    label={t("工艺名称")}
                    name="orderFlowName"
                    rules={[{ required: true, message: t("请输入工艺名称") }]}
                >
                    <Input
                        placeholder={t("请输入工艺名称")}
                    />
                </Form.Item>

                <Form.Item<OrderGroupForm>
                    label={t("时间表达式")}
                    name="cronExpression"
                    validateFirst
                    rules={[
                        { required: true, message: t("请输入时间表达式") },
                        { required: true, pattern: cronRegex, message: t("请输入符合规则的正则表达式"), validateTrigger: "onBlur" }
                    ]}
                >
                    <CronExpress />
                </Form.Item>

                <Form.Item<OrderGroupForm>
                    label={t("模板集合")}
                    name="orderTemplateKeys"
                    rules={[{ required: true, message: t("请选择任务集合") }]}
                >
                    <Transfer
                        dataSource={orderGroups}
                        rowKey={r => r.orderTemplateKey}
                        listStyle={{
                            width: 300,
                            height: 360
                        }}
                        showSearch={{ placeholder: t("搜索") }}
                        titles={[t("待选工艺"), t("已选工艺")]}
                        operations={[t("添加"), t("撤回")]}
                        targetKeys={targetKeys}
                        selectedKeys={selectedKeys}
                        onChange={onChange}
                        onSelectChange={onSelectChange}
                        render={(item) => item.orderTemplateName}
                    />
                </Form.Item>

                <Form.Item<OrderGroupForm>
                    label={t("循环次数")}
                    name="triggerTimes"
                    tooltip={t("任务成功的触发次数，-1表示无限循环")}
                    rules={[{ required: true, message: t("请输入循环次数") }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入循环次数")}
                        min={-1}
                        precision={0}
                    />
                </Form.Item>

                <Form.Item<OrderGroupForm>
                    label={t("触发方式")}
                    name="triggerType"
                    tooltip={t("并行触发:时间周期到达马上创建任务，串行触发:等待上个任务终止再创建任务")}
                    rules={[{ required: true, message: t("请选择触发方式") }]}
                >
                    <Radio.Group
                        options={triggerTypes?.map(o => typeof o === "object" && o ? { ...o, label: t(o.label as string) } : o)}
                    />
                </Form.Item>

            </Form>
        </Modal>
    )
};
