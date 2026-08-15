/**
 * demo 登出确认框（规格 §13.2）：演示会话登出时确认是否同时清除 CRUD 快照，默认保留。
 * - Header 在 demo 会话登出时动态 import 本模块（off 构建经静态条件剔除）；
 * - antd 上下文正确的 modal 实例由调用方经 App.useApp() 取得后传入；
 * - 快照清除动作由调用方执行（onConfirm 回调携带用户选择），本模块只负责选择 UI。
 */
import { Checkbox } from 'antd'
import type { UiFeedbackInstances } from '@/services/feedback/uiFeedback'
import { appI18n, COMMON_NAMESPACE } from '@/i18n/i18n'

/** 确认框文案 key（zh 即 key；en-US 资源见 locales/en-US/common.ts） */
const TEXT_KEYS = {
  title: '退出登录确认',
  hint: '演示会话数据（用户管理增删改快照）默认保留，可继续演示。',
  clearOption: '同时清除演示数据快照',
  ok: '退出登录',
  cancel: '取消',
} as const

function translate(key: string): string {
  return appI18n.t(key, { ns: COMMON_NAMESPACE })
}

export interface DemoLogoutConfirmOptions {
  /** App.useApp() 提供的 modal 实例（保持主题/文案上下文一致，不使用 antd 静态方法） */
  modal: UiFeedbackInstances['modal']
  /** 用户确认后执行登出；返回的 Promise 完成前确认按钮保持 loading */
  onConfirm: (clearSnapshot: boolean) => Promise<void>
}

export function confirmDemoLogout({ modal, onConfirm }: DemoLogoutConfirmOptions): void {
  // 默认保留快照（规格 §13.2），勾选后才清除
  let clearSnapshot = false
  modal.confirm({
    title: translate(TEXT_KEYS.title),
    content: (
      <div>
        <p style={{ margin: '0 0 8px' }}>{translate(TEXT_KEYS.hint)}</p>
        <Checkbox onChange={(event) => (clearSnapshot = event.target.checked)}>
          {translate(TEXT_KEYS.clearOption)}
        </Checkbox>
      </div>
    ),
    okText: translate(TEXT_KEYS.ok),
    cancelText: translate(TEXT_KEYS.cancel),
    onOk: () => onConfirm(clearSnapshot),
  })
}
