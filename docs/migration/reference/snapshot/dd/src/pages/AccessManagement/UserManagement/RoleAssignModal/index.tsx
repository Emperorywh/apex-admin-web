/**
 * @description 分配用户角色弹窗
 * 基于角色列表（getRoles）展示可勾选的角色，
 * 提交时调用 assignRoles 完成用户角色分配。
 *
 * 数据约定：
 *  - getRoles() 返回全部角色列表，用于渲染；
 *  - getRoles({ userId }) 返回当前用户已分配的角色，用于回显勾选。
 */
import { useEffect, useState } from "react";
import { Modal, Tree, Spin, message } from "antd";
import type { TreeDataNode, TreeProps } from "antd";
import { getRoles, assignRoles } from "@/api";
import type { AuthRole } from "@/api";
import { useI18n } from "@/hooks/useI18n";

interface RoleAssignModalProps {
    /** 弹窗是否打开 */
    open: boolean;
    /** 当前分配角色的用户 id */
    userId?: number;
    /** 当前用户名（用于弹窗标题展示） */
    username?: string;
    /** 关闭弹窗 */
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
    /** 刷新列表回调（分配成功后刷新表格的角色列） */
    refreshList?: () => void;
}

export default (props: RoleAssignModalProps) => {
    const { open, userId, username, setOpenModal, refreshList } = props;
    /* 国际化翻译方法 */ const { t } = useI18n();

    const [loading, setLoading] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);
    // 全部角色列表（用于渲染，角色为扁平结构）
    const [treeData, setTreeData] = useState<TreeDataNode[]>([]);
    // 已勾选的角色（checkStrictly 模式下 checkedKeys 为 { checked, halfChecked }）
    const [checkedKeys, setCheckedKeys] = useState<{
        checked: React.Key[];
        halfChecked: React.Key[];
    }>({ checked: [], halfChecked: [] });

    /**
     * 将后端返回的角色列表映射为 antd Tree 的 treeData
     * 角色为扁平结构，每个角色作为树的一个根节点
     */
    const buildTreeData = (list: AuthRole[]): TreeDataNode[] =>
        (list || []).map(item => ({
            key: item.id,
            title: item.name,
        }));

    /**
     * 加载角色数据：
     * 1. getRoles() 获取全部角色列表，用于渲染；
     * 2. getRoles({ userId }) 获取当前用户已分配的角色，用于回显勾选。
     */
    const loadRoles = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const [allRes, userRes] = await Promise.all([
                getRoles(),
                getRoles({ userId }),
            ]);
            if (allRes.code === 200 && allRes.message === "success") {
                setTreeData(buildTreeData(allRes.data || []));
            } else {
                message.warning(t("查询角色列表失败") + allRes?.message);
            }
            if (userRes.code === 200 && userRes.message === "success") {
                const userList = userRes.data || [];
                setCheckedKeys({
                    checked: userList.map(item => item.id),
                    halfChecked: [],
                });
            }
        } catch (err) {
            if (err) {
                message.error(t("查询角色列表失败") + (err as any)?.message);
            }
        } finally {
            setLoading(false);
        }
    };

    /**
     * 勾选回调：checkStrictly 模式下 checkedKeys 为 { checked, halfChecked }
     */
    const onCheck: TreeProps["onCheck"] = (checkedKeysValue) => {
        setCheckedKeys(
            checkedKeysValue as { checked: React.Key[]; halfChecked: React.Key[] },
        );
    };

    /**
     * 点击节点标题切换勾选（实现"点击 label 也能选中 / 取消"）：
     * 角色为扁平结构（每个角色即叶子），直接在 checked 列表中切换该 key。
     * checkStrictly 模式下 checkedKeys 为 { checked, halfChecked }，
     * 角色无层级故 halfChecked 恒为空。
     */
    const onSelect: TreeProps["onSelect"] = (_, info) => {
        const key = info.node.key as React.Key;
        const isChecked = checkedKeys.checked.includes(key);
        const nextChecked = isChecked
            ? checkedKeys.checked.filter(k => k !== key)
            : Array.from(new Set([...checkedKeys.checked, key]));
        setCheckedKeys({ checked: nextChecked, halfChecked: [] });
    };

    /**
     * 提交角色分配
     */
    const handleOk = async () => {
        if (!userId) return;
        setSaving(true);
        try {
            const res = await assignRoles({
                userId,
                roleIds: checkedKeys.checked.map(key => Number(key)),
            });
            if (res.code === 200 && res.message === "success") {
                message.success(t("分配角色成功"));
                setOpenModal(false);
                refreshList?.();
            } else {
                message.warning(t("分配角色失败") + res?.message);
            }
        } catch (err) {
            if (err) {
                message.error(t("分配角色失败") + (err as any)?.message);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setOpenModal(false);
    };

    useEffect(() => {
        if (open && userId) {
            loadRoles();
        }
    }, [open, userId]);

    return (
        <Modal
            title={t("分配角色") + (username ? ` - ${username}` : "")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
            confirmLoading={saving}
            destroyOnClose
            width={520}
        >
            {/* 加载角色或提交分配期间，均以页面级 loading 遮罩覆盖，阻止重复操作 */}
            <Spin spinning={loading || saving}>
                <Tree
                    checkable
                    checkStrictly
                    checkedKeys={checkedKeys}
                    selectedKeys={[]}
                    treeData={treeData}
                    onCheck={onCheck}
                    onSelect={onSelect}
                    style={{ maxHeight: "60vh", overflow: "auto" }}
                />
            </Spin>
        </Modal>
    );
};
