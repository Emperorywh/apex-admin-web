/**
 * 全局命令面板：Spotlight 风格浮层，⌘K / Ctrl+K 呼出（开关在 Header）。
 * - 页面结果来自 menuRoutes 投影的叶子节点
 * - 动作：切换语言 / 退出登录
 * - ↑↓ 选择、Enter 执行、Esc 或点击遮罩关闭
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CornerDownLeft, Search } from 'lucide-react'
import { buildMenuRoutes, flattenMenuLeaves } from '@/router/projections'
import { logout } from '@/services/auth/auth.service'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { sessionExpired } from '@/store/slices/authSlice'
import { localeChanged } from '@/store/slices/settingsSlice'
import type { AppLanguage } from '@/i18n/i18n'
import styles from '@/layouts/BasicLayout/components/CommandPalette/CommandPalette.module.css'

interface CommandItem {
  key: string
  kind: 'page' | 'action'
  title: string
  hint?: string
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const locale = useAppSelector((state) => state.settings.locale)
  const { t: tCommon } = useTranslation('common')
  const { t: tMenu } = useTranslation('menu')
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const items = useMemo<CommandItem[]>(() => {
    const keyword = query.trim().toLowerCase()
    const leaves = flattenMenuLeaves(buildMenuRoutes())
    const pages: CommandItem[] = leaves
      .filter(
        (leaf) =>
          tMenu(leaf.title).toLowerCase().includes(keyword) ||
          leaf.path.toLowerCase().includes(keyword),
      )
      .map((leaf) => ({
        key: `page:${leaf.routeId}`,
        kind: 'page',
        title: tMenu(leaf.title),
        hint: leaf.path,
      }))
    const target: AppLanguage = locale === 'zh-CN' ? 'en-US' : 'zh-CN'
    const actions: CommandItem[] = [
      {
        key: 'action:lang',
        kind: 'action',
        title: `${tCommon('切换语言')} → ${target === 'en-US' ? 'English' : '中文'}`,
      },
      { key: 'action:logout', kind: 'action', title: tCommon('退出登录') },
    ]
    return [...pages, ...actions.filter((action) => action.title.toLowerCase().includes(keyword))]
  }, [locale, query, tCommon, tMenu])

  const run = (item: CommandItem | undefined) => {
    if (!item) return
    if (item.kind === 'page') {
      const routeId = item.key.slice('page:'.length)
      const leaves = flattenMenuLeaves(buildMenuRoutes())
      const target = leaves.find((leaf) => leaf.routeId === routeId)
      if (target) navigate(target.path)
    } else if (item.key === 'action:lang') {
      dispatch(localeChanged(locale === 'zh-CN' ? 'en-US' : 'zh-CN'))
    } else if (item.key === 'action:logout') {
      void logout().finally(() => {
        dispatch(sessionExpired())
      })
    }
    onClose()
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlight((prev) => (items.length === 0 ? 0 : (prev + 1) % items.length))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlight((prev) => (items.length === 0 ? 0 : (prev - 1 + items.length) % items.length))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        run(items[highlight])
      } else if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  useEffect(() => {
    setHighlight(0)
  }, [query])

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div className={styles.panel} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.searchRow}>
          <Search size={17} className={styles.searchIcon} strokeWidth={2.2} />
          <input
            ref={inputRef}
            value={query}
            placeholder={tCommon('搜索应用、数据、设备、文档或输入命令...')}
            aria-label={tCommon('全局搜索')}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className={styles.kbd}>esc</span>
        </div>
        <div className={styles.results}>
          {items.length === 0 ? (
            <div className={styles.empty}>{tCommon('没有匹配的结果')}</div>
          ) : (
            items.map((item, index) => (
              <button
                key={item.key}
                type="button"
                className={index === highlight ? `${styles.item} ${styles.itemActive}` : styles.item}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => run(item)}
              >
                <span className={styles.itemTitle}>{item.title}</span>
                {item.hint ? (
                  <span className={styles.itemHint}>{item.hint}</span>
                ) : (
                  <CornerDownLeft size={13} className={styles.itemHint} />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
