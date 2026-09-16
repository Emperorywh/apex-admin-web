/**
 * @description 车辆分组的弹窗
 * @date 2025-6-5
 */
import { useState, useEffect } from "react";
import { Modal, Form, Input, Transfer, message } from "antd";
import type { TransferProps } from "antd";
import { getSimpleVehicles, addVehicleGroup, updateVehicleGroup } from "@/api";
import type { SimpleVehicle, VehicleGroupForm, UpdateVehicleGroup } from "@/types/VehicleDeploy/GroupType";
import { useI18n } from "@/hooks/useI18n";

interface GroupModalProps {
    open: boolean;
    isModify: boolean;
    modifyRow: VehicleGroupForm;
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
    getVehicleGroups: () => void;
}

export default (props: GroupModalProps) => {

    const { open, isModify, modifyRow, setOpenModal, getVehicleGroups } = props;

    /* 国际化翻译方法，用于将车辆分组弹窗的所有文案进行多语言转换 */
    const { t } = useI18n();

    // 左右选择框已选择的事件
    const [selectedKeys, setSelectedKeys] = useState<TransferProps["targetKeys"]>([]);
    // 已添加的车辆
    const [targetKeys, setTargetKeys] = useState<TransferProps["targetKeys"]>([]);
    // 所有车辆列表
    const [simpleVehicles, setSimpleVehicles] = useState<SimpleVehicle[]>([]);

    const [form] = Form.useForm();

    // 新增分组
    const handleAddGroup = (values: VehicleGroupForm) => {
        addVehicleGroup(values).then(res => {
            if (res.code === 200 && res.message === "success") {
                getVehicleGroups();
                setOpenModal(false);
                setTargetKeys([]);
                setSelectedKeys([]);
                form.resetFields();
                message.success(t("添加车辆组成功"));
            } else {
                message.warning(t("添加车辆组出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("添加车辆组出错") + err?.message);
            }
        })
    };

    // 更新分组
    const handleUpdateGroup = (values: UpdateVehicleGroup) => {
        updateVehicleGroup(values).then(res => {
            if (res.code === 200 && res.message === "success") {
                getVehicleGroups();
                setOpenModal(false);
                setTargetKeys([]);
                setSelectedKeys([]);
                form.resetFields();
                message.success(t("更新车辆组成功"));
            } else {
                message.warning(t("更新车辆组出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("更新车辆组出错") + err?.message);
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const values = form.getFieldsValue(true);
        if (isModify) {
            handleUpdateGroup(values);
        } else {
            handleAddGroup(values);
        }
    };

    const handleCancel = () => {
        setOpenModal(false);
        setTargetKeys([]);
        setSelectedKeys([]);
        form.resetFields();
    };

    // 已选择的Key数组
    const onChange: TransferProps["onChange"] = (nextTargetKeys) => {
        setTargetKeys(nextTargetKeys);
    };

    // 选中的Key数组
    const onSelectChange: TransferProps["onSelectChange"] = (sourceSelectedKeys, targetSelectedKeys) => {
        setSelectedKeys([...sourceSelectedKeys, ...targetSelectedKeys]);
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
        if (isModify && modifyRow.groupName) {
            form.setFieldsValue(modifyRow);
            setTargetKeys(modifyRow.vehicleKeys);
        }
    }, [modifyRow])

    return (
        <Modal
            title={isModify ? t("编辑车辆分组") : t("新增车辆分组")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
            width={1150}
        >
            <Form
                name="vehicle-group"
                labelCol={{ span: 4 }}
                wrapperCol={{ span: 20 }}
                autoComplete="off"
                form={form}
                initialValues={{ groupName: "", vehicleKeys: [] }}
            >
                <Form.Item<VehicleGroupForm>
                    label={t("分组名称")}
                    name="groupName"
                    rules={[{ required: true, message: t("请输入分组名称") }]}
                >
                    <Input
                        placeholder={t("请输入分组名称")}
                        maxLength={64}
                        showCount
                    />
                </Form.Item>

                <Form.Item<VehicleGroupForm>
                    label={t("选择车辆")}
                    name="vehicleKeys"
                    rules={[{ required: false, message: t("请选择车辆") }]}
                >
                    <Transfer
                        dataSource={simpleVehicles}
                        showSearch={{ placeholder: t("根据名称搜索") }}
                        listStyle={{
                            width: 420,
                            height: 400
                        }}
                        titles={[t("车辆列表"), t("已添加")]}
                        operations={[t("添加"), t("撤回")]}
                        targetKeys={targetKeys}
                        selectedKeys={selectedKeys}
                        onChange={onChange}
                        onSelectChange={onSelectChange}
                        render={(item) => item.name}
                    />
                </Form.Item>
            </Form>
        </Modal>
    )
};
