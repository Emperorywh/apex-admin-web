/**
 * 退出确认宿主（声明式）：挂在 SessionHost，替代命令式 modal.confirm。
 * useSyncExternalStore 订阅退出确认总线，pending 时渲染受控 Modal；
 * 裁决后由 React 卸载，杜绝僵尸弹窗实例（T013 教训的同一修复模式）。
 */

import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from 'antd'
import {
  peekLogoutConfirm,
  respondLogoutConfirm,
  subscribeLogoutConfirm,
} from '@/features/auth/logoutConfirmBus'

/** 总线快照：pending 对象身份作为外部 store 快照（裁决即置空触发重渲染） */
function subscribe(listener: () => void): () => void {
  return subscribeLogoutConfirm(listener)
}

export function LogoutConfirmHost() {
  const { t } = useTranslation('common')
  const snapshot = useSyncExternalStore(subscribe, peekLogoutConfirm, peekLogoutConfirm)

  /* Modal 常驻挂载、仅切换 open：与 PasswordModal 同一已验证模式。
     首挂载即 open 的 appear 动画在 rc-motion 下可能停在 prepare 相位。 */
  return (
    <Modal
      title={t('确认退出登录？')}
      open={snapshot !== null}
      okText={t('退出')}
      cancelText={t('取消')}
      okButtonProps={{ danger: true }}
      onOk={() => respondLogoutConfirm(true)}
      onCancel={() => respondLogoutConfirm(false)}
      /* 确认中不允许点遮罩/ESC 关闭：退出意向必须显式裁决 */
      maskClosable={false}
      keyboard={false}
      destroyOnHidden
    >
      {snapshot?.request.content ?? t('退出后需要重新输入账号密码。')}
    </Modal>
  )
}
