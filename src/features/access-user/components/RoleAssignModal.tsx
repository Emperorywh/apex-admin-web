/**
 * 分配角色弹窗（P31 用户管理页）：真实 getRoles/assignRoles 接入。
 *
 * 交互与契约要点（旧实现 RoleAssignModal 等价迁移）：
 * - 双查回显（旧实现同源语义）：getRoles() 取全部角色渲染候选；getRoles({userId})
 *   取该用户已分配角色回显勾选——两查并行发起，任一失败如实反馈不伪装；
 * - 角色为扁平结构，每角色一个根节点；checkStrictly 严格勾选（父子不联动，
 *   角色无层级故半选恒空）；点击节点标题同样切换勾选（旧版 onSelect 增强等价）；
 * - 提交 assignRoles({userId, roleIds})：整组提交=整体替换语义（未勾选即移除，
 *   后端语义为准）；提交防重复（confirmLoading + saving 门）；成功后由页面
 *   刷新列表并关闭弹窗；
 * - 每次打开重新加载（open && userId 触发，旧版 useEffect 同语义）：分配成功
 *   或他人变更后再次打开集合自然刷新；
 * - 关闭即销毁勾选草稿（destroyOnHidden，旧版 destroyOnClose 同语义）。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { App, Modal, Spin, Tree } from 'antd'
import type { TreeDataNode } from 'antd'
import { useTranslation } from 'react-i18next'
import {
  assignAuthUserRoles,
  getAuthRoles,
} from '@/services/access-user/access-user.service'
import type { AuthRoleDto } from '@/services/access-user/access-user.service.types'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'

/** 勾选态（checkStrictly 模式下 checkedKeys 为 { checked, halfChecked } 形状） */
interface CheckedState {
  checked: React.Key[]
  halfChecked: React.Key[]
}

interface RoleAssignModalProps {
  open: boolean
  /** 目标用户主键（int64；缺失时不加载不提交） */
  userId?: number | string | null
  /** 目标用户名（弹窗标题展示用） */
  username?: string | null
  onClose: () => void
  /** 提交成功后回调（页面刷新列表并关闭弹窗） */
  onSucceeded: () => void
}

/** 角色列表映射为 Tree 数据源（扁平结构：每角色一个根节点，title=角色名） */
function buildTreeData(list: AuthRoleDto[]): TreeDataNode[] {
  return (list ?? []).map((item) => ({
    key: String(item.id ?? ''),
    title: item.name ?? '',
  }))
}

export function RoleAssignModal({
  open,
  userId,
  username,
  onClose,
  onSucceeded,
}: RoleAssignModalProps) {
  const { t } = useTranslation('access-user')
  const { message } = App.useApp()

  // 加载与提交互斥遮罩：加载角色或提交分配期间阻止重复操作（旧版同语义）
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  // 全部角色（渲染候选）与已勾选角色（回显 + 用户操作）
  const [treeData, setTreeData] = useState<TreeDataNode[]>([])
  const [checkedKeys, setCheckedKeys] = useState<CheckedState>({ checked: [], halfChecked: [] })
  // 双查防乱序：独立 controller——快速开关弹窗/换目标用户时中止上一轮在途双查，
  // 迟到的旧响应不再覆盖新一轮回显（P29 useLicenseInfo 同款收敛）
  const loadControllerRef = useRef<AbortController | null>(null)

  /** 加载角色数据：全部角色 + 已分配角色并行；失败如实反馈（不伪装成功） */
  const loadRoles = useCallback(async () => {
    if (!userId) return
    // 中止上一轮在途查询（防乱序）；被中止方按取消静默，不打错误
    loadControllerRef.current?.abort()
    const controller = new AbortController()
    loadControllerRef.current = controller
    const { signal } = controller
    setLoading(true)
    try {
      const [allRoles, userRoles] = await Promise.all([
        getAuthRoles(undefined, { signal }),
        getAuthRoles({ userId: Number(userId) }, { signal }),
      ])
      // 仅最新一轮允许落态（双保险：abort 后 resolve 本就不会到达）
      if (loadControllerRef.current !== controller) return
      setTreeData(buildTreeData(allRoles))
      setCheckedKeys({
        checked: (userRoles ?? []).map((item) => String(item.id ?? '')),
        halfChecked: [],
      })
    } catch (error) {
      if (!isCancelledError(error)) {
        message.error(t('查询角色列表失败：{{msg}}', { msg: apiErrorMessage(error) }))
      }
    } finally {
      if (loadControllerRef.current === controller) {
        setLoading(false)
      }
    }
  }, [userId, message, t])

  // 每次打开（且有目标用户）都重新加载：分配成功或他人变更后集合自然刷新
  useEffect(() => {
    if (open && userId) {
      void loadRoles()
    }
  }, [open, userId, loadRoles])

  // 组件卸载时中止在途查询（弹窗 destroyOnHidden 销毁路径）
  useEffect(() => {
    return () => loadControllerRef.current?.abort()
  }, [])

  /** 勾选回调：checkStrictly 下 checkedKeys 为对象形状，整体接管 */
  const handleCheck = useCallback((checked: CheckedState['checked'] | CheckedState) => {
    const next = Array.isArray(checked)
      ? { checked, halfChecked: [] }
      : { checked: checked.checked, halfChecked: [] }
    setCheckedKeys(next)
  }, [])

  /** 点击节点标题切换勾选（旧版 onSelect 增强等价：点击 label 也能选中/取消） */
  const handleSelect = useCallback((_: React.Key[], info: { node: { key: React.Key } }) => {
    setCheckedKeys((prev) => {
      const key = info.node.key
      const isChecked = prev.checked.includes(key)
      const nextChecked = isChecked
        ? prev.checked.filter((item) => item !== key)
        : Array.from(new Set([...prev.checked, key]))
      // 角色为扁平结构（每个角色即叶子），半选恒为空
      return { checked: nextChecked, halfChecked: [] }
    })
  }, [])

  /** 提交角色分配：整组勾选提交（roleIds 数值化——角色 id 为自增小整数安全） */
  const handleOk = async () => {
    if (!userId || saving) return
    setSaving(true)
    try {
      await assignAuthUserRoles({
        userId: Number(userId),
        roleIds: checkedKeys.checked.map((key) => Number(key)),
      })
      message.success(t('分配角色成功'))
      onSucceeded()
    } catch (error) {
      if (!isCancelledError(error)) {
        message.error(t('分配角色失败：{{msg}}', { msg: apiErrorMessage(error) }))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      // 标题携带目标用户名（旧版同形态：分配角色 - 用户名）
      title={username ? `${t('分配角色')} - ${username}` : t('分配角色')}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      destroyOnHidden
      confirmLoading={saving}
      okText={t('确定')}
      cancelText={t('取消')}
      width={520}
    >
      {/* 加载或提交期间以遮罩覆盖树，阻止重复操作（旧版同语义） */}
      <Spin spinning={loading || saving}>
        <Tree
          checkable
          checkStrictly
          checkedKeys={checkedKeys}
          selectedKeys={[]}
          treeData={treeData}
          onCheck={handleCheck}
          onSelect={handleSelect}
          style={{ maxHeight: '60vh', overflow: 'auto' }}
        />
      </Spin>
    </Modal>
  )
}
