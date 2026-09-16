/**
 * @description 分配角色权限弹窗（父子三态勾选 — 持久半选）
 * 基于权限资源树（getPermissions）展示可勾选的菜单 / 按钮权限，
 * 提交时调用 assignPermissions 完成角色权限分配。
 *
 * 数据约定：
 *  - getPermissions() 返回全部权限资源树，用于渲染；
 *  - getPermissions({ roleId }) 返回当前角色已分配的权限，用于回显勾选。
 *
 * 三态勾选模型（详见 docs/SPEC_permission_modal_tri_state.md）：
 *  - 唯一数据源：授权集合 authorizedSet（S），父级与子级 id 混存。
 *  - 显示态由 S 派生喂给 antd（checkStrictly 全手动，关闭自动联动）：
 *      父级全选 = 自身 + 所有后代都在 S → 实勾；
 *      父级半选 = 自身在 S 但后代未全在 S（含「空半选」）→ 半勾；
 *      叶子在 S → 实勾，不在 S → 空勾。
 *  - 半选为「持久第三态」，与子级选中数解耦：子级全部取消后父级仍保持半选
 *    （业务根因：父级菜单需可被独立授权，半选父级 id 作为可分配单元上送后端）。
 *  - 回显：把已分配权限树的全部节点 id（含父级）灌入 S，三态由 S 派生。
 *  - 提交：直接 [...S].map(Number)，回显后提交与交互后提交天然一致。
 */
import { useEffect, useMemo, useState } from "react";
import { Modal, Tree, Spin, Button, message } from "antd";
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
    // 全部权限资源树（用于渲染，children 完整，便于空半选父级展开重新勾选）
    const [treeData, setTreeData] = useState<TreeDataNode[]>([]);
    // 默认展开的节点（顶层节点）
    const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
    // 授权集合 S：唯一数据源，父级与子级 id 混存；显示态与提交均由 S 派生
    const [authorizedSet, setAuthorizedSet] = useState<Set<React.Key>>(
        new Set(),
    );

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
     * @description 收集后端已分配权限树的【全部节点 id】（含父级，深度优先）。
     *              替代原 collectLeafPermissionIds（仅收叶子）。
     *              新方案把全部命中 id 灌入 S，三态由 S 派生：
     *               - 父级 + 全部子级都在 → 全选
     *               - 父级 + 部分子级在 → 半选
     *               - 父级在、子级全空（childPermissions=[]）→ 空半选（独立授权语义）
     * @param list 后端 getPermissions({roleId}) 返回的已分配权限树
     * @returns 全部命中节点 id
     */
    const collectAssignedIds = (list: AuthPermission[]): number[] => {
        const ids: number[] = [];
        const walk = (nodes: AuthPermission[]) => {
            (nodes || []).forEach(node => {
                ids.push(node.id);
                if (node.childPermissions?.length) {
                    walk(node.childPermissions);
                }
            });
        };
        walk(list);
        return ids;
    };

    /**
     * @description 收集节点 targetKey 及其全部后代的 key（含 targetKey 自身）。
     *              用于 toggleNode 判定「该子树是否全选」、以及「加入 / 移除整棵子树」。
     * @param nodes     全量权限树
     * @param targetKey 目标节点 key
     * @returns 子树全部 key（含自身），找不到目标返回 []
     */
    const collectSubtreeKeys = (
        nodes: TreeDataNode[],
        targetKey: React.Key,
    ): React.Key[] => {
        const result: React.Key[] = [];
        const walk = (list: TreeDataNode[]): boolean => {
            for (const node of list) {
                if (node.key === targetKey) {
                    const collect = (n: TreeDataNode) => {
                        result.push(n.key);
                        (n.children || []).forEach(collect);
                    };
                    collect(node);
                    return true;
                }
                if (node.children?.length && walk(node.children)) return true;
            }
            return false;
        };
        walk(nodes);
        return result;
    };

    /**
     * @description 收集节点 targetKey 的全部祖先 key（不含自身）。
     *              用于「加入节点时向上联动」（D4：勾任意节点 → 全部祖先进 S）。
     * @param nodes     全量权限树
     * @param targetKey 目标节点 key
     * @returns 祖先 key 列表（从根到父），找不到返回 []
     */
    const collectAncestorKeys = (
        nodes: TreeDataNode[],
        targetKey: React.Key,
    ): React.Key[] => {
        const ancestors: React.Key[] = [];
        const walk = (list: TreeDataNode[]): boolean => {
            for (const node of list) {
                if (node.key === targetKey) return true;
                if (node.children?.length) {
                    const found = walk(node.children);
                    if (found) {
                        ancestors.push(node.key); // 回溯时记录祖先
                        return true;
                    }
                }
            }
            return false;
        };
        walk(nodes);
        return ancestors;
    };

    /**
     * @description 由授权集合 S 派生 antd Tree 的受控勾选值。
     *              antd 在 checkStrictly 模式下不做父子联动，checked / halfChecked 完全由本函数决定：
     *               - 父级「全选」（自身 + 所有后代都在 S）→ 进 checked（实勾）
     *               - 父级「半选」（自身在 S 但后代未全在 S，含空半选）→ 进 halfChecked（半勾）
     *               - 叶子在 S → 进 checked；不在 S 则不出现
     *              未选节点两个集合都不含，antd 自然渲染为空勾。
     *              依赖不变量「后代 ∈ S ⟹ 祖先 ∈ S」（由 toggleNode 向上联动 + 回显按树结构收集保证），
     *              故「自身不在 S 但后代命中」在正常交互 / 回显下不会出现，无需单列分支。
     * @param nodes   全量权限树（treeData）
     * @param authSet 授权集合 S
     * @returns { checked: 实勾 key 列表, halfChecked: 半勾父级 key 列表 }
     */
    const deriveChecked = (
        nodes: TreeDataNode[],
        authSet: Set<React.Key>,
    ): { checked: React.Key[]; halfChecked: React.Key[] } => {
        const checked: React.Key[] = [];
        const halfChecked: React.Key[] = [];
        // 单次深度遍历（自底向上）：walk 返回「该层列表内所有节点（含后代）是否全部在 S」，
        // 用于父级「全选 vs 半选」的严格判定：
        //   父全选 = 自身在 S 且全部后代都在 S；父半选 = 自身在 S 但后代未全在 S（含空半选）。
        // 用 allInS 上行传递避免逐节点重算，保持 O(n)。
        const walk = (list: TreeDataNode[]): boolean => {
            let allInS = list.length > 0;
            (list || []).forEach(node => {
                const selfInS = authSet.has(node.key);
                if (node.children?.length) {
                    const childrenAllInS = walk(node.children); // 后代是否全部在 S
                    const nodeFullyChecked = selfInS && childrenAllInS;
                    if (nodeFullyChecked) {
                        // 自身 + 所有后代都在 S → 全选（实勾）
                        checked.push(node.key);
                    } else if (selfInS) {
                        // 自身在 S 但后代未全在 S → 半选（含空半选：后代全空）
                        halfChecked.push(node.key);
                    }
                    // selfInS=false → 未选；依赖不变量「后代∈S ⟹ 祖先∈S」不会与后代命中并存
                    allInS = allInS && nodeFullyChecked;
                } else {
                    // 叶子：在 S 即实勾
                    if (selfInS) {
                        checked.push(node.key);
                    }
                    allInS = allInS && selfInS;
                }
            });
            return allInS;
        };
        walk(nodes);
        return { checked, halfChecked };
    };

    /**
     * 收集整棵权限树下的全部叶子节点 key（无子节点），
     * 用于「全选 / 取消全选」按钮的 isAllChecked 判定口径。
     */
    const collectAllLeafKeys = (nodes: TreeDataNode[]): React.Key[] => {
        const result: React.Key[] = [];
        const walk = (list: TreeDataNode[]) => {
            (list || []).forEach(node => {
                if (node.children?.length) {
                    walk(node.children);
                } else {
                    result.push(node.key);
                }
            });
        };
        walk(nodes);
        return result;
    };

    /**
     * @description 收集整棵权限树的全部节点 key（含父级与叶子）。
     *              「全选」时把全部 key 灌入 S，使每个父级都达全选态（D9）。
     */
    const collectAllNodeKeys = (nodes: TreeDataNode[]): React.Key[] => {
        const result: React.Key[] = [];
        const walk = (list: TreeDataNode[]) => {
            (list || []).forEach(node => {
                result.push(node.key);
                if (node.children?.length) walk(node.children);
            });
        };
        walk(nodes);
        return result;
    };

    // 全部叶子 key（缓存，避免每次渲染都递归遍历整棵权限树）
    const allLeafKeys = useMemo(
        () => collectAllLeafKeys(treeData),
        [treeData],
    );
    // 全部节点 key（缓存，「全选」按钮用）
    const allNodeKeys = useMemo(() => collectAllNodeKeys(treeData), [treeData]);

    // 受控勾选值由 S 派生（S 变才重算），喂给 checkStrictly 模式的 antd Tree
    const { checked, halfChecked } = useMemo(
        () => deriveChecked(treeData, authorizedSet),
        [treeData, authorizedSet],
    );

    // 是否处于「全部选中」态：存在叶子且所有叶子均在 S（此时所有父级亦全选）
    const isAllChecked =
        allLeafKeys.length > 0 &&
        allLeafKeys.every(key => authorizedSet.has(key));

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
                // 把已分配的全部节点 id（含父级）灌入 S，三态由 S 派生
                setAuthorizedSet(new Set(collectAssignedIds(roleList)));
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
     * @description 节点三态切换的核心算法（D5 / D6）。
     *              - 当前非全选（未选或半选）→ 切到全选：
     *                把该节点 + 全部后代 + 全部祖先加入 S（向上联动 D4）。
     *              - 当前全选 → 切到未选：
     *                把该节点 + 全部后代移出 S；祖先保留（粘性 D6，空半选由此产生）。
     *              叶子节点：subtree=[自身]，等价于「未选→选中(+祖先) / 选中→未选(留祖先)」。
     *              onCheck 与 onSelect 都调本函数（D10 行为等同）。
     * @param key 被点击节点的 key
     */
    const toggleNode = (key: React.Key) => {
        if (!treeData.length) return;
        const subtree = collectSubtreeKeys(treeData, key);
        if (!subtree.length) return;
        const fullyChecked = subtree.every(k => authorizedSet.has(k));
        setAuthorizedSet(prev => {
            const next = new Set(prev);
            if (!fullyChecked) {
                // 未选 / 半选 → 全选：子树 + 祖先 全部加入
                subtree.forEach(k => next.add(k));
                collectAncestorKeys(treeData, key).forEach(k => next.add(k));
            } else {
                // 全选 → 未选：子树移除，祖先保留（粘性 → 可能产生空半选祖先）
                subtree.forEach(k => next.delete(k));
            }
            return next;
        });
    };

    // onCheck：忽略 antd 返回值，用 info.node.key 自管（checkStrictly 全手动）
    const onCheck: TreeProps["onCheck"] = (_, info) => {
        toggleNode(info.node.key as React.Key);
    };

    // onSelect：与 onCheck 完全一致（D10 点 label 等同点 checkbox）
    const onSelect: TreeProps["onSelect"] = (_, info) => {
        toggleNode(info.node.key as React.Key);
    };

    /**
     * 全选 / 取消全选切换（D9）：
     *  - 全选态 → 清空 S（全树回到未选，含所有空半选父级）
     *  - 非全选态 → S = 全部节点 key（所有父级达全选）
     */
    const handleToggleAll = () => {
        if (!allNodeKeys.length) return;
        setAuthorizedSet(isAllChecked ? new Set() : new Set(allNodeKeys));
    };

    /**
     * 提交权限分配：S 即授权集合，直接展开为 id 数组上送。
     *  - 全选父级：父级 id + 全部子级 id 均在 S → 全上送（D8）
     *  - 半选父级：父级 id + 实际选中子级 id 在 S → 全上送
     *  - 空半选父级：仅父级 id 在 S → 上送父级 id（独立授权 D1）
     *  - 中间父级命中亦在 S → 一并上送（D11）
     *  - 未选节点不在 S → 不上送
     * 回显后直接提交 ≡ 交互后提交（S 是唯一数据源，天然一致）。
     */
    const handleOk = async () => {
        if (!roleId) return;
        setSaving(true);
        try {
            const permissionIds = [...authorizedSet].map(key => Number(key));
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
                <div style={{ marginBottom: 8 }}>
                    <Button
                        onClick={handleToggleAll}
                        size="small"
                        disabled={!allNodeKeys.length}
                    >
                        {isAllChecked ? t("取消全选") : t("全选")}
                    </Button>
                </div>
                <Tree
                    checkable
                    checkStrictly
                    checkedKeys={{ checked, halfChecked }}
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
