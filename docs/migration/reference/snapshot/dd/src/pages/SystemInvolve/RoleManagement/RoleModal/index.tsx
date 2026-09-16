/**
 * @description 角色新增 / 编辑弹窗
 * 对应接口：新增角色 addRole、更新角色 updateRole
 */
import { useEffect } from "react";
import { Modal, Form, Input, Select, message } from "antd";
import { addRole, updateRole } from "@/api";
import type { AuthRole, AuthRoleState } from "@/api";
import { useI18n } from "@/hooks/useI18n";

/** 角色表单字段类型 */
type RoleFormValues = {
    code: string;
    name: string;
    state: AuthRoleState;
};

interface RoleModalProps {
    /** 弹窗是否打开 */
    open: boolean;
    /** 是否为编辑模式 */
    isModify: boolean;
    /** 编辑时回填的角色数据 */
    modifyRow?: AuthRole;
    /** 关闭弹窗 */
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
    /** 刷新列表回调 */
    refreshList: () => void;
}

export default (props: RoleModalProps) => {
    const { open, isModify, modifyRow, setOpenModal, refreshList } = props;
    /* 国际化翻译方法 */ const { t } = useI18n();

    const [form] = Form.useForm<RoleFormValues>();

    // 角色状态选项：启用 / 禁用
    const stateOptions: { label: string; value: AuthRoleState }[] = [
        { label: t("启用"), value: "ENABLED" },
        { label: t("禁用"), value: "DISABLED" },
    ];

    /**
     * 新增角色
     */
    const handleAdd = (values: RoleFormValues) => {
        addRole(values).then(res => {
            if (res.code === 200 && res.message === "success") {
                refreshList();
                setOpenModal(false);
                form.resetFields();
                message.success(t("新增角色成功"));
            } else {
                message.warning(t("新增角色失败") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("新增角色失败") + err?.message);
            }
        });
    };

    /**
     * 编辑角色
     */
    const handleUpdate = (values: RoleFormValues) => {
        if (!modifyRow?.id) return;
        updateRole({ ...values, id: modifyRow.id }).then(res => {
            if (res.code === 200 && res.message === "success") {
                refreshList();
                setOpenModal(false);
                form.resetFields();
                message.success(t("编辑角色成功"));
            } else {
                message.warning(t("编辑角色失败") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("编辑角色失败") + err?.message);
            }
        });
    };

    /**
     * 弹窗确认：校验通过后按模式调用新增 / 编辑
     */
    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            if (isModify) {
                handleUpdate(values);
            } else {
                handleAdd(values);
            }
        } catch {
            // 校验失败，无需处理
        }
    };

    /**
     * 弹窗取消：关闭并重置表单
     */
    const handleCancel = () => {
        setOpenModal(false);
        form.resetFields();
    };

    /**
     * 编辑模式下回填表单数据
     */
    useEffect(() => {
        if (isModify && modifyRow) {
            form.setFieldsValue({
                code: modifyRow.code,
                name: modifyRow.name,
                state: modifyRow.state,
            });
        }
    }, [modifyRow]);

    return (
        <Modal
            title={isModify ? t("编辑角色") : t("新增角色")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
            destroyOnClose
        >
            <Form
                name="role-form"
                labelCol={{ span: 5 }}
                wrapperCol={{ span: 17 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<RoleFormValues>
                    label={t("角色编码")}
                    name="code"
                    rules={[{ required: true, message: t("请输入角色编码") }]}
                >
                    <Input placeholder={t("请输入角色编码")} maxLength={64} showCount />
                </Form.Item>

                <Form.Item<RoleFormValues>
                    label={t("角色名称")}
                    name="name"
                    rules={[{ required: true, message: t("请输入角色名称") }]}
                >
                    <Input placeholder={t("请输入角色名称")} maxLength={64} showCount />
                </Form.Item>

                <Form.Item<RoleFormValues>
                    label={t("角色状态")}
                    name="state"
                    rules={[{ required: true, message: t("请选择角色状态") }]}
                >
                    <Select placeholder={t("请选择角色状态")} options={stateOptions} />
                </Form.Item>
            </Form>
        </Modal>
    );
};
