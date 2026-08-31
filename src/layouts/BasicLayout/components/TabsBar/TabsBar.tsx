/**
 * 页签栏：嵌入顶部工具条的浏览器式页签条。
 * - dnd-kit 排序（含键盘替代操作）；固定页签不可拖动、不可关闭
 * - 右键菜单：刷新当前 / 关闭其他 / 关闭左侧 / 关闭右侧 / 关闭全部（永不影响 affix）
 * - 溢出横向滚动（箭头仅溢出时显示），激活页签自动滚入可视区
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Dropdown, type MenuProps } from 'antd'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { IconTile } from '@/layouts/BasicLayout/components/IconTile/IconTile'
import { routeIconTone } from '@/layouts/BasicLayout/components/IconTile/iconTones'
import { findRouteIcon, findRouteMeta } from '@/router/projections'
import {
  allTabsClosed,
  leftTabsClosed,
  otherTabsClosed,
  rightTabsClosed,
  tabClosed,
  tabMoved,
  tabRefreshed,
  type TabEntry,
} from '@/store/slices/tabsSlice'
import styles from '@/layouts/BasicLayout/components/TabsBar/TabsBar.module.css'

const SCROLL_STEP_PX = 260

export function TabsBar() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  // 页签菜单文案在 common，路由标题在 menu；nsMode: 'fallback' 让 t 依次查找整个
  // ns 数组——react-i18next 默认只取数组第一个 ns 作为查找空间，并列声明并不生效
  const { t } = useTranslation(['common', 'menu'], { nsMode: 'fallback' })
  const tabs = useAppSelector((state) => state.tabs.tabs)
  const activeTabKey = useAppSelector((state) => state.tabs.activeTabKey)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 8)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
  }, [])

  useEffect(() => {
    updateArrows()
    window.addEventListener('resize', updateArrows)
    return () => window.removeEventListener('resize', updateArrows)
  }, [updateArrows, tabs.length])

  /* 激活页签自动进入可视区 */
  useEffect(() => {
    if (!activeTabKey || !scrollRef.current) return
    const activeEl = scrollRef.current.querySelector<HTMLElement>(`[data-tab-key="${CSS.escape(activeTabKey)}"]`)
    activeEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [activeTabKey])

  const scrollBy = (direction: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: direction * SCROLL_STEP_PX, behavior: 'smooth' })
  }

  const activate = useCallback(
    (tab: TabEntry) => {
      navigate(`${tab.location.pathname}${tab.location.search}${tab.location.hash}`)
    },
    [navigate],
  )

  const close = useCallback(
    (key: string) => {
      dispatch(tabClosed(key))
    },
    [dispatch],
  )

  const buildContextMenu = useCallback(
    (tab: TabEntry): MenuProps => ({
      items: [
        { key: 'refresh', label: t('刷新当前页签') },
        { type: 'divider' },
        { key: 'close', label: t('关闭当前页签'), disabled: !tab.closable },
        { key: 'others', label: t('关闭其他页签') },
        { key: 'left', label: t('关闭左侧页签') },
        { key: 'right', label: t('关闭右侧页签') },
        { key: 'all', label: t('关闭全部页签') },
      ],
      onClick: ({ key }) => {
        if (key === 'refresh') dispatch(tabRefreshed(tab.key))
        else if (key === 'close') dispatch(tabClosed(tab.key))
        else if (key === 'others') dispatch(otherTabsClosed(tab.key))
        else if (key === 'left') dispatch(leftTabsClosed(tab.key))
        else if (key === 'right') dispatch(rightTabsClosed(tab.key))
        else if (key === 'all') dispatch(allTabsClosed())
      },
    }),
    [dispatch, t],
  )

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const fromTab = tabs.find((tab) => tab.key === active.id)
      const toTab = tabs.find((tab) => tab.key === over.id)
      // 普通页签不能拖入固定区，固定页签不能拖出固定区
      if (!fromTab || !toTab || fromTab.affix || toTab.affix) return
      dispatch(tabMoved({ fromKey: String(active.id), toKey: String(over.id) }))
    },
    [dispatch, tabs],
  )

  const tabKeys = useMemo(() => tabs.map((tab) => tab.key), [tabs])

  return (
    <div className={styles.bar} role="tablist" aria-label={t('页面页签')}>
      {canScrollLeft && (
        <button
          type="button"
          className={styles.arrow}
          onClick={() => scrollBy(-1)}
          aria-label={t('向左滚动')}
        >
          <ChevronLeft size={15} />
        </button>
      )}
      <div ref={scrollRef} className={styles.scroll} onScroll={updateArrows}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={tabKeys} strategy={horizontalListSortingStrategy}>
            {tabs.map((tab) => (
              <SortableTab
                key={tab.key}
                tab={tab}
                active={tab.key === activeTabKey}
                contextMenu={buildContextMenu(tab)}
                onActivate={activate}
                onClose={close}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      {canScrollRight && (
        <button
          type="button"
          className={styles.arrow}
          onClick={() => scrollBy(1)}
          aria-label={t('向右滚动')}
        >
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  )
}

interface SortableTabProps {
  tab: TabEntry
  active: boolean
  contextMenu: MenuProps
  onActivate: (tab: TabEntry) => void
  onClose: (key: string) => void
}

function SortableTab({ tab, active, contextMenu, onActivate, onClose }: SortableTabProps) {
  const { t } = useTranslation(['common', 'menu'], { nsMode: 'fallback' })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.key,
    disabled: tab.affix,
  })
  const meta = findRouteMeta(tab.routeId)
  const Icon = findRouteIcon(tab.routeId)
  const tone = routeIconTone(tab.routeId)

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, 0, 0)` : undefined,
    transition: transition ?? undefined,
  }

  const className = [
    styles.tab,
    active ? styles.tabActive : '',
    isDragging ? styles.tabDragging : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Dropdown menu={contextMenu} trigger={['contextMenu']}>
      <div
        ref={setNodeRef}
        style={style}
        className={className}
        data-tab-key={tab.key}
        title={t(meta?.title ?? '')}
        onClick={() => onActivate(tab)}
        {...attributes}
        {...(tab.affix ? {} : listeners)}
        role="tab"
        aria-selected={active}
      >
        {Icon ? (
          <IconTile tone={tone} size={20} radius={5}>
            <Icon size={12} strokeWidth={2} />
          </IconTile>
        ) : null}
        <span className={styles.title}>{t(meta?.title ?? tab.key)}</span>
        {tab.closable ? (
          <button
            type="button"
            className={styles.close}
            aria-label={t('关闭页签')}
            onClick={(event) => {
              event.stopPropagation()
              onClose(tab.key)
            }}
          >
            <X size={14} />
          </button>
        ) : (
          <span className={styles.closePlaceholder} aria-hidden />
        )}
      </div>
    </Dropdown>
  )
}
