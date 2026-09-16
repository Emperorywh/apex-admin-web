/**
 * @description 多地图点边组合的创建/编辑弹窗
 * @date 2026-6-22
 */
import { useEffect, useState } from "react";
import { Modal, Form, Input, Transfer, message } from "antd";
import type {
    SystemNodeEdgeGroupRecord,
    LittleSimpleMapNodeEdgeGroup,
    CreateSystemNodeEdgeGroupParam
} from "@/types/PointEdgeCombination";
import {
    getAllSimpleNodeEdgeGroups,
    createSystemNodeEdgeGroup,
    updateSystemNodeEdgeGroup
} from "@/api";
import styles from "./PointEdgeCombinationModal.less";
import { useI18n } from "@/hooks/useI18n";

interface PointEdgeCombinationModalProps {
    /** 弹窗是否打开 */
    open: boolean;
    /** 是否为编辑状态 */
    isModify: boolean;
    /** 当前编辑的行数据 */
    modifyRow?: SystemNodeEdgeGroupRecord;
    /** 刷新列表的回调 */
    getList: () => void;
    /** 设置当前编辑行 */
    setModifyRow: (value: React.SetStateAction<SystemNodeEdgeGroupRecord | undefined>) => void;
    /** 设置弹窗开关 */
    setOpen: (value: React.SetStateAction<boolean>) => void;
}

export default (props: PointEdgeCombinationModalProps) => {

    const { open, isModify, modifyRow, getList, setModifyRow, setOpen } = props;
    /* 国际化翻译方法 */ const { t } = useI18n();

    /* 所有点边组合（下拉选项） */
    const [simpleNodeEdgeGroups, setSimpleNodeEdgeGroups] = useState<LittleSimpleMapNodeEdgeGroup[]>([]);

    const [form] = Form.useForm<CreateSystemNodeEdgeGroupParam>();

    /* 创建多地图点边组合 */
    const handleCreate = (data: CreateSystemNodeEdgeGroupParam) => {
        createSystemNodeEdgeGroup(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                getList();
                setOpen(false);
                message.success(t("创建多地图点边组合成功"));
            } else {
                message.warning(t("创建多地图点边组合出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("创建多地图点边组合出错") + err?.message);
            }
        });
    };

    /* 更新多地图点边组合 */
    const handleUpdate = (data: CreateSystemNodeEdgeGroupParam) => {
        if (!modifyRow) return;
        updateSystemNodeEdgeGroup({
            systemNodeEdgeGroupId: modifyRow.id,
            systemNodeEdgeGroupName: data.systemNodeEdgeGroupName,
            mapNodeEdgeGroupIds: data.mapNodeEdgeGroupIds
        }).then(res => {
            if (res.code === 200 && res.message === "success") {
                form.resetFields();
                getList();
                setOpen(false);
                message.success(t("更新多地图点边组合成功"));
            } else {
                message.warning(t("更新多地图点边组合出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("更新多地图点边组合出错") + err?.message);
            }
        });
    };

    /* 确定按钮：校验并提交 */
    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            if (isModify) {
                handleUpdate(values);
            } else {
                handleCreate(values);
            }
        } catch {
            /* 校验失败时忽略，antd 会展示错误信息 */
        }
    };

    /* 取消按钮：重置表单并关闭 */
    const handleCancel = () => {
        form.resetFields();
        setModifyRow(undefined);
        setOpen(false);
    };

    /* 编辑时回显表单：名称直接回填，点边组合由明细中的 nodeEdgeGroup.id 提取
       注意：接口返回嵌套结构 { nodeEdgeGroup, simpleMap }，id 在 nodeEdgeGroup 内 */
    useEffect(() => {
        if (modifyRow) {
            form.setFieldsValue({
                systemNodeEdgeGroupName: modifyRow.nodeEdgeGroupName,
                mapNodeEdgeGroupIds: (modifyRow.nodeEdgeGroups || [])
                    .map(group => group.nodeEdgeGroup?.id)
                    .filter((id): id is string => !!id)
            });
        }
    }, [modifyRow]);

    /* 弹窗打开时获取所有地图的点边组合作为下拉选项 */
    useEffect(() => {
        /* 弹窗未打开时不查询，避免组件挂载即请求 */
        if (!open) return;
        getAllSimpleNodeEdgeGroups().then(res => {
            if (res.code === 200 && res.message === "success") {
                setSimpleNodeEdgeGroups(res?.data || []);
            } else {
                message.warning(t("查询所有地图点边组合出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询所有地图点边组合出错") + err?.message);
            }
        });
    }, [open]);

    /* 将点边组合转换为穿梭框所需的 { key, title } 数据结构，便于搜索与渲染 */
    const transferDataSource = simpleNodeEdgeGroups.map(item => ({
        key: item.id,
        title: item.name
    }));

    return (
        <Modal
            title={isModify ? t("编辑多地图点边组合") : t("创建多地图点边组合")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
            maskClosable={false}
            width={1200}
            /* 挂载命名空间类，配合 less 固定 Transfer 左右两栏宽高 */
            className={styles.point_edge_combination_modal}
        >
            <Form
                name="pointEdgeCombinationForm"
                labelCol={{ span: 4 }}
                wrapperCol={{ span: 20 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<CreateSystemNodeEdgeGroupParam>
                    label={t("组合名称")}
                    name="systemNodeEdgeGroupName"
                    rules={[{ required: true, message: t("请输入组合名称") }]}
                >
                    <Input
                        placeholder={t("请输入组合名称")}
                        maxLength={64}
                        showCount
                        allowClear
                    />
                </Form.Item>

                <Form.Item<CreateSystemNodeEdgeGroupParam>
                    label={t("点边组合")}
                    name="mapNodeEdgeGroupIds"
                    valuePropName="targetKeys"
                    rules={[
                        { required: true, message: t("请选择点边组合") },
                        { type: "array", min: 1, message: t("至少选择一个点边组合") }
                    ]}
                >
                    {/*
                        使用穿梭框（Transfer）选择点边组合：
                        - valuePropName="targetKeys" 让表单字段值绑定到右侧已选项集合，
                          Transfer 的 onChange 第一个参数即新的 targetKeys 数组，Form 会自动收集；
                        - dataSource 为全部可选项，showSearch 支持左侧按名称搜索。
                    */}
                    <Transfer
                        dataSource={transferDataSource}
                        showSearch
                        filterOption={(inputValue, item) =>
                            String(item?.title ?? "").toLowerCase().includes(inputValue.toLowerCase())
                        }
                        render={item => (
                            /* 文本省略时通过 title 悬停展示完整名称 */
                            <span title={item.title}>{item.title}</span>
                        )}
                        titles={[t("可选点边组合"), t("已选点边组合")]}
                        operations={[t("加入"), t("移除")]}
                        /* 左右两栏的固定宽高在 PointEdgeCombinationModal.less 中约束，
                           避免长文本撑开列宽 */
                        locale={{
                            searchPlaceholder: t("请输入点边组合名称"),
                            notFoundContent: t("暂无数据")
                        }}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};
