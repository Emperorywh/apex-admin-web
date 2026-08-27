/**
 * 面包屑：从 Data Router useMatches() 读取 handle.meta（SPEC §4.2），
 * 只在层级超过一级时出现，避免破坏仪表盘的整页设计。
 */

import { ChevronRight } from 'lucide-react'
import { useNavigate, type UIMatch } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ROUTE_IDS } from '@/constants/route.constants'
import type { RouteHandle } from '@/router/router.types'
import styles from '@/layouts/BasicLayout/components/Breadcrumb/Breadcrumb.module.css'

interface BreadcrumbProps {
  matches: UIMatch[]
}

interface Crumb {
  pathname: string
  title: string
}

export function Breadcrumb({ matches }: BreadcrumbProps) {
  const navigate = useNavigate()
  const { t } = useTranslation('menu')

  const crumbs = matches
    .filter((match) => {
      if (match.id === ROUTE_IDS.ROOT || match.id === ROUTE_IDS.ROOT_INDEX) return false
      const handle = match.handle as RouteHandle | undefined
      if (!handle?.meta) return false
      if (handle.meta.breadcrumb === false) return false
      return true
    })
    .map<Crumb>((match) => ({
      pathname: match.pathname,
      title: (match.handle as RouteHandle).meta.title,
    }))

  if (crumbs.length <= 1) return null

  return (
    <nav className={styles.breadcrumb} aria-label="面包屑">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1
        return (
          <span key={crumb.pathname} className={styles.item}>
            {isLast ? (
              <span className={styles.current}>{t(crumb.title)}</span>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => navigate(crumb.pathname)}
                >
                  {t(crumb.title)}
                </button>
                <ChevronRight size={12} className={styles.separator} />
              </>
            )}
          </span>
        )
      })}
    </nav>
  )
}
