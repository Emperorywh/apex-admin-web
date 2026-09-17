/**
 * 页签动作统一确认 hook（T00.6，规格 8.1 / D12）：
 * 关闭、刷新、批量关闭、退出登录等「会销毁草稿」的动作全部经过本入口，
 * 统一列出受影响的脏页签与进行中的传输，确认后才执行——不允许任何旁路。
 *
 * 三类传输提示策略（规格 10.2/10.3）：
 * - none：动作不影响传输（如刷新页签——传输独立生命周期，不随页签重建终止）
 * - continue-after-close：关闭页签，传输继续，完成后以一次性消息提示结果
 * - terminate：退出登录/会话失效，本机终止传输（服务端处理不保证已撤销）
 */

import { useCallback, type ReactNode } from 'react'
import { App } from 'antd'
import { useTranslation } from 'react-i18next'
import { findActiveTransfersIn } from '@/services/transfer/transferManager'
import { useAppSelector } from '@/hooks/useAppSelector'
import { findRouteMeta } from '@/router/projections'
import type { TabEntry } from '@/store/slices/tabsSlice'

export interface TabActionGuardInput {
  /** 确认框标题；缺省按动作描述生成（确认继续{actionLabel}？） */
  title?: string
  /** 动作描述（已翻译），如「关闭页签」「刷新页签」「退出登录」 */
  actionLabel: string
  /** 受影响页签 key；动作波及的所有页签（刷新=当前页签，登出=全部） */
  affectedKeys: readonly string[]
  /** 传输提示策略，见文件头说明 */
  transferPolicy: 'none' | 'continue-after-close' | 'terminate'
  /** 追加到确认框的额外内容（如退出登录的既有提示文案） */
  extraContent?: ReactNode
  /** 确认后执行的动作 */
  action: () => void
}

/** 取页签展示标题（menu 命名空间的路由标题） */
function tabTitle(tab: TabEntry): string {
  return findRouteMeta(tab.routeId)?.title ?? tab.key
}

export function useTabActionGuard(): (input: TabActionGuardInput) => void {
  const tabs = useAppSelector((state) => state.tabs.tabs)
  const { modal } = App.useApp()
  const { t } = useTranslation('common')

  return useCallback(
    (input: TabActionGuardInput) => {
      const affected = new Set(input.affectedKeys)
      // 受影响且存在未保存修改的页签：确认框必须逐一列出对象（规格 7「确认对话框列明对象和影响」）
      const dirtyTabs = tabs.filter((tab) => affected.has(tab.key) && tab.dirty)
      // 进行中的传输：仅按策略提示，不是阻断条件（关闭页签传输继续；登出则终止）
      const activeTransfers =
        input.transferPolicy === 'none' ? [] : findActiveTransfersIn(affected)

      if (dirtyTabs.length === 0 && activeTransfers.length === 0) {
        input.action()
        return
      }

      modal.confirm({
        title: input.title ?? t('确认继续{{action}}？', { action: input.actionLabel }),
        okText: t('继续'),
        cancelText: t('取消'),
        content: (
          <div>
            {dirtyTabs.length > 0 && (
              <>
                <p>{t('以下页签存在未保存的修改，继续操作后将丢失：')}</p>
                <ul>
                  {dirtyTabs.map((tab) => (
                    <li key={tab.key}>
                      {t(tabTitle(tab))}
                      {tab.dirtyLabel ? `（${tab.dirtyLabel}）` : ''}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {input.transferPolicy === 'continue-after-close' && activeTransfers.length > 0 && (
              <p>{t('这些页签仍有正在进行的传输：关闭后传输会继续，完成后将以消息提示结果。')}</p>
            )}
            {input.transferPolicy === 'terminate' && activeTransfers.length > 0 && (
              <p>{t('进行中的传输将被本机终止，不保证服务端已停止处理。')}</p>
            )}
            {input.extraContent}
          </div>
        ),
        onOk: () => {
          input.action()
        },
      })
    },
    [tabs, modal, t],
  )
}
