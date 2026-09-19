/**
 * 分配权限弹窗（P32 角色管理页）：父子三态勾选（持久半选），真实
 * getPermissions/assignPermissions 接入。
 *
 * 基于权限资源树（菜单/按钮）勾选后调用 assignPermissions 完成角色权限分配。
 * 三态勾选模型完整等价迁移旧 PermissionModal（设计规格
 * docs 旧仓 SPEC_permission_modal_tri_state.md，决策 D1–D12）：
 * - 唯一数据源：授权集合 authorizedSet（S），父级与子级 id 混存；
 * - 显示态由 S 派生喂给 antd（checkStrictly 全手动，关闭自动联动）：
 *     父级全选 = 自身 + 所有后代都在 S → 实勾；
 *     父级半选 = 自身在 S 但后代未全在 S（含「空半选」）→ 半勾；
 *     叶子在 S → 实勾，不在 S → 空勾。
 * - 半选为「持久第三态」，与子级选中数解耦：子级全部取消后父级仍保持半选
 *   （业务根因：父级菜单需可被独立授权，半选父级 id 作为可分配单元上送后端，
 *   D1）；antd 派生半选做不到这一点，故必须 checkStrictly + 全手动（D12）；
 * - 点击循环（D5）：未选/半选 → 全选（子树+全部祖先入 S，向上联动 D4）；
 *   全选 → 未选（子树移出，祖先保留=粘性 D6，空半选由此产生）；
 * - 回显（D7）：把已分配权限树的全部节点 id（含父级）灌入 S，三态由 S 派生
 *   （「空半选」父级即 childPermissions=[] 但自身在 S，自然呈现无需特判）；
 * - 提交（D8/D11）：直接 [...S] 数值化上送——全选/半选/空半选/中间父级命中
 *   一律上送其在 S 中的 id；回显后提交与交互后提交天然一致（S 唯一数据源）；
 * - 全选按钮（D9）：全选=全部节点进 S；取消全选=清空 S（覆盖所有空半选）；
 * - 点标题与点 checkbox 行为完全一致（D10，onSelect/onCheck 同一 toggleNode）。
 *
 * 契约与生命周期要点：
 * - 双查回显（旧实现同源语义）：getPermissions() 取全部权限树渲染；
 *   getPermissions({roleId}) 取该角色已分配权限树回显——两查并行发起，
 *   独立 controller 防乱序（P31 RoleAssignModal 同款收敛），任一失败如实反
 *   馈不伪装成功；
 * - 保存后不刷新当前会话权限：权限时效=下次登录生效（旧 SPEC B15 结论），
 *   提交成功仅反馈并关闭，下次打开重新双查即「保存后重新读取」（专项验收）；
 * - key 统一 String(id)（G10 精度守卫，P31 同款），提交时 Number 化（权限 id
 *   为自增小整数，安全）；勾选显示（权限名称）与提交值（权限 id 集合）分离，
 *   不提交翻译标签；
 * - 关闭即销毁勾选草稿（destroyOnHidden，旧版 destroyOnClose 同语义，S 仅存
 *   于弹窗内存不持久化，旧 SPEC R6 同结论）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Modal, Spin, Tree } from 'antd'
import type { TreeDataNode, TreeProps } from 'antd'
import { useTranslation } from 'react-i18next'
import {
  assignPermissions,
  getPermissions,
} from '@/services/access-role/access-role.service'
import type { AuthPermissionNode } from '@/services/access-role/access-role.service.types'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'

interface PermissionAssignModalProps {
  open: boolean
  /** 目标角色主键（int64；缺失时不加载不提交） */
  roleId?: number | string | null
  /** 目标角色名称（弹窗标题展示用） */
  roleName?: string | null
  onClose: () => void
}

/** 将后端 AuthPermission 树映射为 antd Tree 的 treeData（key=id 字符串化，title=名称） */
function buildTreeData(list: AuthPermissionNode[]): TreeDataNode[] {
  return (list ?? []).map((item) => ({
    key: String(item.id ?? ''),
    title: item.name ?? '',
    children: item.childPermissions?.length
      ? buildTreeData(item.childPermissions)
      : undefined,
  }))
}

/**
 * 收集后端已分配权限树的【全部节点 id】（含父级，深度优先）。
 * 把全部命中 id 灌入 S，三态由 S 派生：
 *  - 父级 + 全部子级都在 → 全选；
 *  - 父级 + 部分子级在 → 半选；
 *  - 父级在、子级全空（childPermissions=[]）→ 空半选（独立授权语义，D7）。
 */
function collectAssignedIds(list: AuthPermissionNode[]): string[] {
  const ids: string[] = []
  const walk = (nodes: AuthPermissionNode[]) => {
    ;(nodes ?? []).forEach((node) => {
      ids.push(String(node.id ?? ''))
      if (node.childPermissions?.length) {
        walk(node.childPermissions)
      }
    })
  }
  walk(list)
  return ids
}

/**
 * 收集节点 targetKey 及其全部后代的 key（含 targetKey 自身）。
 * 用于 toggleNode 判定「该子树是否全选」、以及「加入 / 移除整棵子树」。
 */
function collectSubtreeKeys(
  nodes: TreeDataNode[],
  targetKey: React.Key,
): React.Key[] {
  const result: React.Key[] = []
  const walk = (list: TreeDataNode[]): boolean => {
    for (const node of list) {
      if (node.key === targetKey) {
        const collect = (n: TreeDataNode) => {
          result.push(n.key)
          ;(n.children ?? []).forEach(collect)
        }
        collect(node)
        return true
      }
      if (node.children?.length && walk(node.children)) return true
    }
    return false
  }
  walk(nodes)
  return result
}

/**
 * 收集节点 targetKey 的全部祖先 key（不含自身）。
 * 用于「加入节点时向上联动」（D4：勾任意节点 → 全部祖先进 S）。
 */
function collectAncestorKeys(
  nodes: TreeDataNode[],
  targetKey: React.Key,
): React.Key[] {
  const ancestors: React.Key[] = []
  const walk = (list: TreeDataNode[]): boolean => {
    for (const node of list) {
      if (node.key === targetKey) return true
      if (node.children?.length) {
        const found = walk(node.children)
        if (found) {
          ancestors.push(node.key) // 回溯时记录祖先
          return true
        }
      }
    }
    return false
  }
  walk(nodes)
  return ancestors
}

/**
 * 由授权集合 S 派生 antd Tree 的受控勾选值。
 * antd 在 checkStrictly 模式下不做父子联动，checked / halfChecked 完全由本函
 * 数决定（依赖不变量「后代 ∈ S ⟹ 祖先 ∈ S」——由 toggleNode 向上联动与回显
 * 按树结构收集共同保证，「自身不在 S 但后代命中」在正常交互/回显下不出现）。
 */
function deriveChecked(
  nodes: TreeDataNode[],
  authSet: ReadonlySet<React.Key>,
): { checked: React.Key[]; halfChecked: React.Key[] } {
  const checked: React.Key[] = []
  const halfChecked: React.Key[] = []
  // 单次深度遍历（自底向上）：walk 返回「该层列表内所有节点（含后代）是否全
  // 部在 S」，用于父级「全选 vs 半选」的严格判定，allInS 上行传递保持 O(n)
  const walk = (list: TreeDataNode[]): boolean => {
    let allInS = list.length > 0
    ;(list ?? []).forEach((node) => {
      const selfInS = authSet.has(node.key)
      if (node.children?.length) {
        const childrenAllInS = walk(node.children) // 后代是否全部在 S
        const nodeFullyChecked = selfInS && childrenAllInS
        if (nodeFullyChecked) {
          // 自身 + 所有后代都在 S → 全选（实勾）
          checked.push(node.key)
        } else if (selfInS) {
          // 自身在 S 但后代未全在 S → 半选（含空半选：后代全空）
          halfChecked.push(node.key)
        }
        allInS = allInS && nodeFullyChecked
      } else {
        // 叶子：在 S 即实勾（叶子无半选态）
        if (selfInS) {
          checked.push(node.key)
        }
        allInS = allInS && selfInS
      }
    })
    return allInS
  }
  walk(nodes)
  return { checked, halfChecked }
}

/** 收集整棵权限树下的全部叶子节点 key（无子节点），用于 isAllChecked 判定口径 */
function collectAllLeafKeys(nodes: TreeDataNode[]): React.Key[] {
  const result: React.Key[] = []
  const walk = (list: TreeDataNode[]) => {
    ;(list ?? []).forEach((node) => {
      if (node.children?.length) {
        walk(node.children)
      } else {
        result.push(node.key)
      }
    })
  }
  walk(nodes)
  return result
}

/** 收集整棵权限树的全部节点 key（含父级与叶子）——「全选」按钮用（D9） */
function collectAllNodeKeys(nodes: TreeDataNode[]): React.Key[] {
  const result: React.Key[] = []
  const walk = (list: TreeDataNode[]) => {
    ;(list ?? []).forEach((node) => {
      result.push(node.key)
      if (node.children?.length) walk(node.children)
    })
  }
  walk(nodes)
  return result
}

export function PermissionAssignModal({
  open,
  roleId,
  roleName,
  onClose,
}: PermissionAssignModalProps) {
  const { t } = useTranslation('access-role')
  const { message } = App.useApp()

  // 加载与提交互斥遮罩：加载权限树或提交分配期间阻止重复操作（旧版同语义）
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  // 全部权限资源树（用于渲染，children 完整，便于空半选父级展开重新勾选）
  const [treeData, setTreeData] = useState<TreeDataNode[]>([])
  // 默认展开的节点（顶层节点，旧版同语义）
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  // 授权集合 S：唯一数据源，父级与子级 id 混存；显示态与提交均由 S 派生
  const [authorizedSet, setAuthorizedSet] = useState<ReadonlySet<React.Key>>(
    new Set(),
  )
  // 双查防乱序：独立 controller——快速开关弹窗/换目标角色时中止上一轮在途双
  // 查，迟到的旧响应不再覆盖新一轮回显（P31 RoleAssignModal 同款收敛）
  const loadControllerRef = useRef<AbortController | null>(null)

  // 全部叶子 key（缓存，「全选」按钮 isAllChecked 判定口径）
  const allLeafKeys = useMemo(() => collectAllLeafKeys(treeData), [treeData])
  // 全部节点 key（缓存，「全选」按钮灌入 S 用）
  const allNodeKeys = useMemo(() => collectAllNodeKeys(treeData), [treeData])
  // 受控勾选值由 S 派生（S 变才重算），喂给 checkStrictly 模式的 antd Tree
  const { checked, halfChecked } = useMemo(
    () => deriveChecked(treeData, authorizedSet),
    [treeData, authorizedSet],
  )
  // 是否处于「全部选中」态：存在叶子且所有叶子均在 S（此时所有父级亦全选）
  const isAllChecked =
    allLeafKeys.length > 0 && allLeafKeys.every((key) => authorizedSet.has(key))

  /** 加载权限数据：全部权限树 + 该角色已分配权限树并行（任一失败如实反馈） */
  const loadPermissions = useCallback(async () => {
    if (!roleId) return
    // 中止上一轮在途查询（防乱序）；被中止方按取消静默，不打错误
    loadControllerRef.current?.abort()
    const controller = new AbortController()
    loadControllerRef.current = controller
    const { signal } = controller
    setLoading(true)
    try {
      const [allTree, roleTree] = await Promise.all([
        getPermissions(undefined, { signal }),
        getPermissions({ roleId: Number(roleId) }, { signal }),
      ])
      // 仅最新一轮允许落态（双保险：abort 后 resolve 本就不会到达）
      if (loadControllerRef.current !== controller) return
      setTreeData(buildTreeData(allTree))
      // 默认展开顶层节点，便于直接查看子权限（旧版同语义）
      setExpandedKeys((allTree ?? []).map((item) => String(item.id ?? '')))
      // 把已分配的全部节点 id（含父级）灌入 S，三态由 S 派生（D7 回显）
      setAuthorizedSet(new Set(collectAssignedIds(roleTree ?? [])))
    } catch (error) {
      if (!isCancelledError(error)) {
        message.error(t('查询权限资源失败：{{msg}}', { msg: apiErrorMessage(error) }))
      }
    } finally {
      if (loadControllerRef.current === controller) {
        setLoading(false)
      }
    }
  }, [roleId, message, t])

  // 每次打开（且有目标角色）都重新加载：分配成功或他人变更后集合自然刷新
  useEffect(() => {
    if (open && roleId) {
      void loadPermissions()
    }
  }, [open, roleId, loadPermissions])

  // 组件卸载时中止在途查询（弹窗 destroyOnHidden 销毁路径）
  useEffect(() => {
    return () => loadControllerRef.current?.abort()
  }, [])

  /**
   * 节点三态切换的核心算法（D5/D6）：
   * - 当前非全选（未选或半选）→ 切到全选：该节点 + 全部后代 + 全部祖先加入 S；
   * - 当前全选 → 切到未选：该节点 + 全部后代移出 S；祖先保留（粘性 D6，
   *   空半选由此产生）。
   * 叶子节点：subtree=[自身]，等价「未选→选中(+祖先) / 选中→未选(留祖先)」。
   */
  const toggleNode = useCallback(
    (key: React.Key) => {
      if (!treeData.length) return
      const subtree = collectSubtreeKeys(treeData, key)
      if (!subtree.length) return
      const fullyChecked = subtree.every((k) => authorizedSet.has(k))
      setAuthorizedSet((prev) => {
        const next = new Set(prev)
        if (!fullyChecked) {
          // 未选 / 半选 → 全选：子树 + 祖先 全部加入
          subtree.forEach((k) => next.add(k))
          collectAncestorKeys(treeData, key).forEach((k) => next.add(k))
        } else {
          // 全选 → 未选：子树移除，祖先保留（粘性 → 可能产生空半选祖先）
          subtree.forEach((k) => next.delete(k))
        }
        return next
      })
    },
    [treeData, authorizedSet],
  )

  // onCheck：忽略 antd 返回值，用 info.node.key 自管（checkStrictly 全手动 D12）
  const onCheck: TreeProps['onCheck'] = (_, info) => {
    toggleNode(info.node.key as React.Key)
  }

  // onSelect：与 onCheck 完全一致（D10 点 label 等同点 checkbox）
  const onSelect: TreeProps['onSelect'] = (_, info) => {
    toggleNode(info.node.key as React.Key)
  }

  /**
   * 全选 / 取消全选切换（D9）：
   * - 全选态 → 清空 S（全树回到未选，含所有空半选父级）；
   * - 非全选态 → S = 全部节点 key（所有父级达全选态）。
   */
  const handleToggleAll = useCallback(() => {
    if (!allNodeKeys.length) return
    setAuthorizedSet(isAllChecked ? new Set() : new Set(allNodeKeys))
  }, [allNodeKeys, isAllChecked])

  /**
   * 提交权限分配：S 即授权集合，直接展开为 id 数组上送。
   *  - 全选父级：父级 id + 全部子级 id 均在 S → 全上送（D8）；
   *  - 半选父级：父级 id + 实际选中子级 id 在 S → 全上送；
   *  - 空半选父级：仅父级 id 在 S → 上送父级 id（独立授权 D1）；
   *  - 中间父级命中亦在 S → 一并上送（D11）；未选节点不在 S → 不上送。
   * 回显后直接提交 ≡ 交互后提交（S 是唯一数据源，天然一致）。
   */
  const handleOk = async () => {
    if (!roleId || saving) return
    setSaving(true)
    try {
      await assignPermissions({
        roleId: Number(roleId),
        permissionIds: [...authorizedSet].map((key) => Number(key)),
      })
      message.success(t('分配权限成功'))
      onClose()
    } catch (error) {
      if (!isCancelledError(error)) {
        message.error(t('分配权限失败：{{msg}}', { msg: apiErrorMessage(error) }))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      // 标题携带目标角色名（旧版同形态：分配权限 - 角色名）
      title={roleName ? `${t('分配权限')} - ${roleName}` : t('分配权限')}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={saving}
      destroyOnHidden
      okText={t('确定')}
      cancelText={t('取消')}
      width={520}
    >
      {/* 加载或提交期间以遮罩覆盖树，阻止重复操作（旧版同语义） */}
      <Spin spinning={loading || saving}>
        <div style={{ marginBottom: 8 }}>
          <Button onClick={handleToggleAll} size="small" disabled={!allNodeKeys.length}>
            {isAllChecked ? t('取消全选') : t('全选')}
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
          style={{ maxHeight: '60vh', overflow: 'auto' }}
        />
      </Spin>
    </Modal>
  )
}
