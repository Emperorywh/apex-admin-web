/**
 * 面包屑（规格 §11.2）：层级与标题通过 useMatches() 读取 handle.meta（不维护副本，
 * 规格 §4.2）；无页面组件的目录节点（hasPage=false）与不在导航树内的层级渲染为纯
 * 文本不可点击，挂载页面组件的中间层级以 react-router Link 提供 SPA 导航；
 * 末位为当前页，恒不可点击。可见性由 Header 按 settings.breadcrumbEnabled 控制。
 */
import { Breadcrumb as AntdBreadcrumb } from 'antd'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useMatches } from 'react-router'
import { MENU_NAMESPACE } from '@/i18n/i18n'
import { deriveBreadcrumbCrumbs } from '@/layouts/BasicLayout/navTree'
import type { NavTreeNode } from '@/layouts/BasicLayout/navModel'

export interface BreadcrumbProps {
  /** 已过滤导航树：层级可点击性按树内 hasPage 判定（规格 §11.2） */
  items: readonly NavTreeNode[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  const { t } = useTranslation()
  const matches = useMatches()
  const crumbs = useMemo(() => deriveBreadcrumbCrumbs(items, matches), [items, matches])

  const breadcrumbItems = useMemo(
    () =>
      crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1
        const clickable = crumb.hasPage && !isLast
        return {
          key: crumb.pathname,
          title: clickable ? (
            <Link to={crumb.pathname}>{t(crumb.title, { ns: MENU_NAMESPACE })}</Link>
          ) : (
            <span>{t(crumb.title, { ns: MENU_NAMESPACE })}</span>
          ),
        }
      }),
    [crumbs, t],
  )

  if (breadcrumbItems.length === 0) {
    return null
  }
  return <AntdBreadcrumb items={breadcrumbItems} />
}
