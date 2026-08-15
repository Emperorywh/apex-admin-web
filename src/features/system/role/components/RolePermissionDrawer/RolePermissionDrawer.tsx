/**
 * 角色分配权限 Drawer（规格 §14.2/§14.3/§14.1）：
 * 分配权限走独立接口 PUT /roles/:id/permissions（body { permCodes }），与编辑角色契约分离。
 * 权限树来自 GET /permissions/tree（页面懒加载后传入）；勾选初始值由 Role.permCodes 推导
 * （规格 §14.1：接口不重复返回 checked），只勾选叶子节点，父节点呈现半选/全选聚合态；
 * 提交仅收集选中叶子对应的 permCodes，不含父节点 key。Drawer 关闭即销毁内容
 * （destroyOnHidden + 页面按目标角色 id 重建），下次打开以新角色 permCodes 重新初始化。
 */
import { useMemo, useState } from 'react'
import type { Key } from 'react'
import { Alert, Button, Drawer, Tree, theme } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ROLE_I18N_NAMESPACE } from '@/constants/system/role/role.constants'
import { collectPermissionLeafCodes } from '@/utils/permissionTree'
import type { PermissionNode, Role } from '@/types/system/role/role.types'

export interface RolePermissionDrawerProps {
  open: boolean
  /** 分配目标角色；open 为 true 时必须非空 */
  role: Role | null
  /** 权限树（页面经 GET /permissions/tree 懒加载） */
  tree: PermissionNode[]
  /** 权限树加载中 */
  treeLoading: boolean
  /** 提交中：由页面持有，控制提交按钮 loading */
  submitting: boolean
  /** 提交：抛出错误时由本抽屉以 Alert 呈现 */
  onSubmit: (permCodes: string[]) => Promise<void>
  onClose: () => void
}

/** 权限树 → antd treeData：title 经 i18n 解析（后端返回中文文案即 key），并收集全部节点 key */
function buildTreeData(
  nodes: readonly PermissionNode[],
  t: TFunction,
  allKeys: Key[],
): DataNode[] {
  return nodes.map((node) => {
    allKeys.push(node.key)
    return {
      key: node.key,
      title: t(node.title),
      ...(node.children !== undefined
        ? { children: buildTreeData(node.children, t, allKeys) }
        : {}),
    }
  })
}

export function RolePermissionDrawer({ open, role, tree, treeLoading, submitting, onSubmit, onClose }: RolePermissionDrawerProps) {
  const { t } = useTranslation(ROLE_I18N_NAMESPACE)
  const { token } = theme.useToken()
  const leafCodes = useMemo(() => collectPermissionLeafCodes(tree), [tree])
  const leafKeySet = useMemo(() => new Set<string>(leafCodes), [leafCodes])
  // 勾选展示值由 Role.permCodes 推导（规格 §14.1）：仅叶子 key 进入勾选集合，父节点由 Tree
  // 聚合为全选/半选；permCodes 中不在树内的权限码（如 '*'）不参与展示。
  // 权限树可能晚于挂载到达（页面懒加载），故推导保持响应式；用户操作后以显式勾选态接管。
  const derivedCheckedKeys = useMemo<Key[]>(
    () => (role?.permCodes ?? []).filter((permCode) => leafKeySet.has(permCode)),
    [role, leafKeySet],
  )
  const [userCheckedKeys, setUserCheckedKeys] = useState<Key[] | null>(null)
  const checkedKeys = userCheckedKeys ?? derivedCheckedKeys
  const [errorText, setErrorText] = useState<string | null>(null)
  // 受控展开全部节点：树数据晚于挂载到达（懒加载）时仍保持全展开；
  // keys 与 treeData 必须同一 useMemo 产出，保证重渲染（如勾选变化）时展开集合不丢失
  const { treeData, allNodeKeys } = useMemo(() => {
    const keys: Key[] = []
    return { treeData: buildTreeData(tree, t, keys), allNodeKeys: keys }
  }, [tree, t])

  const handleSubmit = async (): Promise<void> => {
    setErrorText(null)
    if (role === null) {
      return
    }
    try {
      // 提交载荷仅选中叶子对应的 permCodes（规格 §14.3：后端验证所有权限码存在）
      await onSubmit(leafCodes.filter((permCode) => checkedKeys.includes(permCode)))
    } catch {
      // 提交请求由页面以 silent 发出；失败提示由本抽屉承担
      setErrorText(t('权限分配失败，请稍后重试'))
    }
  }

  return (
    <Drawer
      title={t('分配权限')}
      placement="right"
      width={420}
      open={open}
      onClose={onClose}
      destroyOnHidden
    >
      {role !== null && (
        <p style={{ color: token.colorTextSecondary, marginTop: 0 }}>
          {t('目标角色')}：{role.name}（{role.code}）
        </p>
      )}
      {errorText !== null && (
        <Alert type="error" showIcon message={errorText} style={{ marginBottom: token.marginSM }} />
      )}
      {treeLoading ? (
        <p style={{ color: token.colorTextSecondary }}>{t('加载中')}</p>
      ) : (
        <Tree
          checkable
          selectable={false}
          expandedKeys={allNodeKeys}
          onCheck={(checked) => setUserCheckedKeys(checked as Key[])}
          checkedKeys={checkedKeys}
          treeData={treeData}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginSM, marginTop: token.marginLG }}>
        <Button onClick={onClose}>{t('取消')}</Button>
        <Button type="primary" loading={submitting} onClick={() => void handleSubmit()} disabled={treeLoading}>
          {t('保存')}
        </Button>
      </div>
    </Drawer>
  )
}
