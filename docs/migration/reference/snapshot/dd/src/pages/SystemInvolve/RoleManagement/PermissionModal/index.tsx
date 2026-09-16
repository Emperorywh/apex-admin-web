/**
 * @description 分配角色权限弹窗
 * 基于权限资源树（getPermissions）展示可勾选的菜单 / 按钮权限，
 * 提交时调用 assignPermissions 完成角色权限分配。
 *
 * 数据约定：
 *  - getPermissions() 返回全部权限资源树，用于渲染；
 *  - getPermissions({ roleId }) 返回当前角色已分配的权限，用于回显勾选。
 *
 * 父子联动：
 *  - Tree 关闭 checkStrictly，由 antd 自动联动：父级选中→子级全选，
 *    子级全选→父级选中，子级部分选中→父级半选。
 *  - 回显时只收集叶子节点 id，父级（选中 / 半选）状态由 antd 依据子级推算，
 *    避免父级 id 落入 checkedKeys 导致"父级选中但子级未全选"的不一致显示。
 *  - 提交时基于 checkedKeys 重新规范化：发送所有命中（选中 / 半选）的权限，
 *    含"子级全选 / 部分选中"的父级菜单；仅完全未勾选的节点不提交。
 *    保证回显后直接提交与交互后提交结果一致。
 */
import { useEffect, useState } from "react";
import { Modal, Tree, Spin, message } from "antd";
import type { TreeDataNode, TreeProps } from "antd";
import { getPermissions, assignPermissions } from "@/api";
import type { AuthPermission } from "@/api";
import { useI18n } from "@/hooks/useI18n";

interface PermissionModalProps {
    /** 弹窗是否打开 */
    open: boolean;
    /** 当前分配权限的角色 id */
    roleId?: number;
    /** 当前角色名称（用于弹窗标题展示） */
    roleName?: string;
    /** 关闭弹窗 */
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
}

export default (props: PermissionModalProps) => {
    const { open, roleId, roleName, setOpenModal } = props;
    /* 国际化翻译方法 */ const { t } = useI18n();

    const [loading, setLoading] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);
    // 全部权限资源树（用于渲染）
    const [treeData, setTreeData] = useState<TreeDataNode[]>([]);
    // 默认展开的节点（顶层节点）
    const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
    // 已勾选的权限 key（仅叶子与"全部子级已选"的父级）
    const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);

    /**
     * 将后端返回的 AuthPermission 树映射为 antd Tree 的 treeData
     * key 取权限 id，title 取权限名称
     */
    const buildTreeData = (list: AuthPermission[]): TreeDataNode[] =>
        (list || []).map(item => ({
            key: item.id,
            title: item.name,
            children: item.childPermissions?.length
                ? buildTreeData(item.childPermissions)
                : undefined,
        }));

    /**
     * 递归收集一棵权限子树下的全部叶子节点 id（无子权限的节点）
     * 仅收集叶子，父级的选中 / 半选状态交由 antd 依据子级联动推算，
     * 从而保证回显与勾选交互的显示一致。
     */
    const collectLeafPermissionIds = (list: AuthPermission[]): number[] => {
        const ids: number[] = [];
        const walk = (nodes: AuthPermission[]) => {
            (nodes || []).forEach(node => {
                if (node.childPermissions?.length) {
                    walk(node.childPermissions);
                } else {
                    ids.push(node.id);
                }
            });
        };
        walk(list);
        return ids;
    };

    /**
     * 收集指定节点子树下的全部叶子节点 key（无子节点）
     * 点击节点标题切换勾选时，按叶子维度整体勾选 / 取消，
     * 父级（选中 / 半选）状态交由 antd 依据叶子联动推算，保证显示一致。
     */
    const collectSubtreeLeafKeys = (
        nodes: TreeDataNode[],
        targetKey: React.Key,
    ): React.Key[] => {
        const result: React.Key[] = [];
        const walk = (list: TreeDataNode[]): boolean => {
            for (const node of list) {
                if (node.key === targetKey) {
                    const collectLeaf = (n: TreeDataNode) => {
                        if (n.children?.length) {
                            n.children.forEach(collectLeaf);
                        } else {
                            result.push(n.key);
                        }
                    };
                    collectLeaf(node);
                    return true;
                }
                if (node.children?.length && walk(node.children)) {
                    return true;
                }
            }
            return false;
        };
        walk(nodes);
        return result;
    };

    /**
     * 基于"已选 key 集合"递归收集所有命中（选中 / 半选）的节点 key，用于提交前规范化：
     *  - 叶子节点：在已选集合中即计入；
     *  - 父级节点：只要自身在已选集合中，或其任意后代被计入即计入；
     *    对应 antd 的"选中"与"半选"两种状态。
     * 提交语义：把所有选中或半选的权限 id 一并上送，仅完全未勾选的节点不提交。
     * 无论 checkedKeys 只含叶子（回显路径）还是同时含父级（onCheck 路径），
     * 提交结果都一致。
     */
    const collectCheckedPermissionKeys = (
        nodes: TreeDataNode[],
        checkedSet: Set<React.Key>,
    ): React.Key[] => {
        const result: React.Key[] = [];
        // 返回该层子树中是否有任意节点命中（自身或后代处于选中 / 半选）
        const walk = (list: TreeDataNode[]): boolean => {
            let hit = false;
            (list || []).forEach(node => {
                if (node.children?.length) {
                    const childHit = walk(node.children);
                    // 父级命中条件：自身被选中，或有任意后代命中（即处于选中 / 半选）
                    if (childHit || checkedSet.has(node.key)) {
                        result.push(node.key);
                        hit = true;
                    }
                } else {
                    // 叶子直接按已选集合判定
                    if (checkedSet.has(node.key)) {
                        result.push(node.key);
                        hit = true;
                    }
                }
            });
            return hit;
        };
        walk(nodes);
        return result;
    };

    /**
     * 加载权限数据：
     * 1. getPermissions() 获取全部权限资源树，用于渲染；
     * 2. getPermissions({ roleId }) 获取当前角色已分配的权限，用于回显勾选。
     */
    const loadPermissions = async () => {
        if (!roleId) return;
        setLoading(true);
        try {
            const [allRes, roleRes] = await Promise.all([
                getPermissions(),
                getPermissions({ roleId }),
            ]);
            if (allRes.code === 200 && allRes.message === "success") {
                const allList = allRes.data || [];
                setTreeData(buildTreeData(allList));
                // 默认展开顶层节点，便于直接查看子权限
                setExpandedKeys(allList.map(item => item.id));
            } else {
                message.warning(t("查询权限资源失败") + allRes?.message);
            }
            if (roleRes.code === 200 && roleRes.message === "success") {
                const roleList = roleRes.data || [];
                // 仅回显叶子，父级状态由 antd 联动推算
                setCheckedKeys(collectLeafPermissionIds(roleList));
            }
        } catch (err) {
            if (err) {
                message.error(t("查询权限资源失败") + (err as any)?.message);
            }
        } finally {
            setLoading(false);
        }
    };

    /**
     * 勾选回调（checkStrictly={false}，父子联动）：
     * antd 返回的 checkedKeys 为完全选中的 key（含"子级全选"的父级）；
     * 半选父级无需在此单独收集 —— 提交时由 collectCheckedPermissionKeys
     * 依据已选叶子统一推导并纳入提交。
     */
    const onCheck: TreeProps["onCheck"] = checkedKeysValue => {
        setCheckedKeys(checkedKeysValue as React.Key[]);
    };

    /**
     * 点击节点标题切换勾选（实现"点击 label 也能选中 / 取消"）：
     * 收集该节点子树的叶子，若叶子已全部选中则一并取消，否则一并勾选，
     * 保证与点击复选框的行为一致。父级（选中 / 半选）状态由 antd 依据叶子联动推算。
     */
    const onSelect: TreeProps["onSelect"] = (_, info) => {
        const key = info.node.key as React.Key;
        const leafKeys = collectSubtreeLeafKeys(treeData, key);
        if (!leafKeys.length) return;
        const allLeafChecked = leafKeys.every(k => checkedKeys.includes(k));
        const nextChecked = allLeafChecked
            ? checkedKeys.filter(k => !leafKeys.includes(k))
            : Array.from(new Set([...checkedKeys, ...leafKeys]));
        setCheckedKeys(nextChecked);
    };

    /**
     * 提交权限分配：仅发送完全选中的权限（含"子级全选"的父级），
     * 半选的父级菜单不提交，避免把仅部分子级命中的父级 id 上送后端。
     */
    const handleOk = async () => {
        if (!roleId) return;
        setSaving(true);
        try {
            // 提交前基于 treeData + checkedKeys 规范化：收集命中（选中 / 半选）的权限
            // —— 选中的叶子 + 选中 / 半选的父级，仅完全未勾选的节点不提交。
            // 保证回显与交互两条链路提交一致。
            const permissionIds = collectCheckedPermissionKeys(
                treeData,
                new Set(checkedKeys),
            ).map(key => Number(key));
            const res = await assignPermissions({
                roleId,
                permissionIds,
            });
            if (res.code === 200 && res.message === "success") {
                message.success(t("分配权限成功"));
                setOpenModal(false);
            } else {
                message.warning(t("分配权限失败") + res?.message);
            }
        } catch (err) {
            if (err) {
                message.error(t("分配权限失败") + (err as any)?.message);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setOpenModal(false);
    };

    useEffect(() => {
        if (open && roleId) {
            loadPermissions();
        }
    }, [open, roleId]);

    return (
        <Modal
            title={t("分配权限") + (roleName ? ` - ${roleName}` : "")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
            confirmLoading={saving}
            destroyOnClose
            width={520}
        >
            <Spin spinning={loading}>
                <Tree
                    checkable
                    checkStrictly={false}
                    checkedKeys={checkedKeys}
                    selectedKeys={[]}
                    expandedKeys={expandedKeys}
                    onExpand={(keys) => setExpandedKeys(keys)}
                    onCheck={onCheck}
                    onSelect={onSelect}
                    treeData={treeData}
                    style={{ maxHeight: "60vh", overflow: "auto" }}
                />
            </Spin>
        </Modal>
    );
};
