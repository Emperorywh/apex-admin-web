/**
 * 角色权限分配 Drawer（纯前端模式）：
 * 目标角色当前权限码由页面经内存分配表（role → permissionCodes 全量替换语义）以 props
 * 注入，按模块分组的权限目录（permission.constants.ts 的 PERMISSIONS 全集）以复选框
 * 呈现，支持分组全选；提交后由页面更新分配表。原 GET/PUT /roles/:id 的网络环节已移除。
 * Drawer 关闭即销毁内容（destroyOnHidden + 页面按目标角色 id 重建），下次打开重新初始化。
 */
import { useState } from 'react'
import { Button, Checkbox, Drawer, Tag, theme } from 'antd'
import { useTranslation } from 'react-i18next'
import { ROLE_I18N_NAMESPACE } from '@/constants/system/role/role.constants'
import { PERMISSIONS } from '@/constants/permission.constants'
import type { Role } from '@/types/system/role/role.types'

/**
 * 权限目录分组（模块 → 权限码）：码值引用 PERMISSIONS 常量，页面不出现权限魔法字符串。
 * 后端动作粒度为 read/write 两级，同一写码被多个语义 key 复用（如 SYSTEM_USER_CREATE/
 * UPDATE/DELETE 同值），分组内以 Set 去重后每码一项。
 */
const PERMISSION_GROUPS: ReadonlyArray<{ labelKey: string; codes: readonly string[] }> = [
  {
    labelKey: '用户权限',
    codes: [PERMISSIONS.SYSTEM_USER_LIST, PERMISSIONS.SYSTEM_USER_CREATE],
  },
  {
    labelKey: '角色权限',
    codes: [PERMISSIONS.SYSTEM_ROLE_LIST, PERMISSIONS.SYSTEM_ROLE_CREATE],
  },
  {
    labelKey: '授权操作',
    codes: [PERMISSIONS.SYSTEM_USER_ASSIGN_ROLE, PERMISSIONS.SYSTEM_ROLE_ASSIGN_PERMISSION],
  },
  {
    labelKey: '菜单权限',
    codes: [PERMISSIONS.SYSTEM_MENU_LIST, PERMISSIONS.SYSTEM_MENU_CREATE],
  },
]

/** 权限码 → 文案 key（与分组同一去重口径：同一码值只保留一份文案） */
const PERMISSION_LABEL_KEYS: Record<string, string> = {
  [PERMISSIONS.SYSTEM_USER_LIST]: '查看用户',
  [PERMISSIONS.SYSTEM_USER_CREATE]: '维护用户',
  [PERMISSIONS.SYSTEM_ROLE_LIST]: '查看角色',
  [PERMISSIONS.SYSTEM_ROLE_CREATE]: '维护角色',
  [PERMISSIONS.SYSTEM_USER_ASSIGN_ROLE]: '分配角色与权限',
  [PERMISSIONS.SYSTEM_MENU_LIST]: '查看菜单',
  [PERMISSIONS.SYSTEM_MENU_CREATE]: '维护菜单',
}

export interface RolePermissionDrawerProps {
  open: boolean
  /** 分配目标角色；open 为 true 时必须非空 */
  role: Role | null
  /** 目标角色当前已分配权限码全集（初始勾选） */
  assignedCodes: string[]
  /** 目标角色成员数（演示口径：与 user 演示分配数据一致） */
  memberCount: number
  /** 提交中：由页面持有，控制提交按钮 loading */
  submitting: boolean
  /** 提交：参数为选中的权限码列表（分配契约按编码全量替换） */
  onSubmit: (permissionCodes: string[]) => Promise<void>
  onClose: () => void
}

export function RolePermissionDrawer({
  open,
  role,
  assignedCodes,
  memberCount,
  submitting,
  onSubmit,
  onClose,
}: RolePermissionDrawerProps) {
  const { t } = useTranslation(ROLE_I18N_NAMESPACE)
  const { token } = theme.useToken()
  // 勾选值为权限码（提交契约）；随 Drawer 重建以目标角色当前权限初始化
  const [checked, setChecked] = useState<string[]>(assignedCodes)

  /** 将一组权限码的勾选态整体替换（分组全选/取消与单组勾选共用） */
  const replaceGroup = (codes: readonly string[], values: readonly string[]): void => {
    setChecked((prev) => [...prev.filter((code) => !codes.includes(code)), ...values])
  }

  const handleSubmit = async (): Promise<void> => {
    await onSubmit(checked)
  }

  return (
    <Drawer title={t('分配权限')} placement="right" width={420} open={open} onClose={onClose} destroyOnHidden>
      {role !== null && (
        <p style={{ color: token.colorTextSecondary, marginTop: 0 }}>
          {t('目标角色')}：{role.displayName}（{role.code}）
        </p>
      )}
      <p style={{ color: token.colorTextSecondary }}>
        {t('成员数')}：{memberCount}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginLG }}>
        {PERMISSION_GROUPS.map((group) => {
          const codes = [...new Set(group.codes)]
          const checkedInGroup = codes.filter((code) => checked.includes(code))
          const allChecked = checkedInGroup.length === codes.length
          return (
            <div key={group.labelKey}>
              <Checkbox
                checked={allChecked}
                indeterminate={checkedInGroup.length > 0 && !allChecked}
                onChange={(event) => replaceGroup(codes, event.target.checked ? codes : [])}
              >
                {t(group.labelKey)}
              </Checkbox>
              <Checkbox.Group
                value={checkedInGroup}
                onChange={(values) => replaceGroup(codes, values as string[])}
                style={{ display: 'flex', flexDirection: 'column', gap: token.marginXS, paddingLeft: token.marginLG }}
              >
                {codes.map((code) => (
                  <Checkbox key={code} value={code}>
                    {t(PERMISSION_LABEL_KEYS[code] ?? code)}
                    <Tag style={{ marginLeft: token.marginXS }} color="default">
                      {code}
                    </Tag>
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginSM, marginTop: token.marginLG }}>
        <Button onClick={onClose}>{t('取消')}</Button>
        <Button type="primary" loading={submitting} onClick={() => void handleSubmit()}>
          {t('保存')}
        </Button>
      </div>
    </Drawer>
  )
}
