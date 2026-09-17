/**
 * 页签栏：嵌入顶部工具条的浏览器式页签条。
 * - dnd-kit 排序（含键盘替代操作）；固定页签不可拖动、不可关闭
 * - 右键菜单：刷新当前 / 关闭其他 / 关闭左侧 / 关闭右侧 / 关闭全部（永不影响 affix）
 * - 关闭/刷新前统一脏检查（useTabActionGuard）：列出未保存修改与进行中的传输，
 *   确认后才执行；批量关闭按真实移除范围检查（T00.6，规格 8.1）
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
import { useTabActionGuard } from '@/hooks/useTabActionGuard'
import { findRouteMeta } from '@/router/projections'
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

  /* 统一动作确认（T00.6）：关闭/刷新销毁页面草稿与在途请求，必须先经脏检查；
     关闭类动作同时提示「传输将继续」；确认通过后才派发 reducer */
  const guardTabAction = useTabActionGuard()

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

  /** 计算批量关闭动作真正会被移除的页签 key（与 reducer 的保留语义严格对应） */
  const removedKeysOf = useCallback(
    (kind: 'others' | 'left' | 'right' | 'all', anchorKey: string): string[] => {
      const anchorIndex = tabs.findIndex((tab) => tab.key === anchorKey)
      const removable = (tab: TabEntry) => !tab.affix && tab.closable
      switch (kind) {
        case 'others':
          return tabs.filter((tab) => tab.key !== anchorKey && removable(tab)).map((tab) => tab.key)
        case 'left':
          return anchorIndex < 0
            ? []
            : tabs.slice(0, anchorIndex).filter(removable).map((tab) => tab.key)
        case 'right':
          return anchorIndex < 0
            ? []
            : tabs.slice(anchorIndex + 1).filter(removable).map((tab) => tab.key)
        case 'all':
          return tabs.filter(removable).map((tab) => tab.key)
      }
    },
    [tabs],
  )

  /** 单页签关闭（X 按钮）：经统一确认后关闭 */
  const close = useCallback(
    (key: string) => {
      guardTabAction({
        actionLabel: t('关闭页签'),
        affectedKeys: [key],
        transferPolicy: 'continue-after-close',
        action: () => dispatch(tabClosed(key)),
      })
    },
    [dispatch, guardTabAction, t],
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
        /* 刷新与关闭分别确认：刷新只影响本页签草稿（传输不受影响）；
           关闭类按真实移除范围检查脏页签，并提示在途传输将继续 */
        if (key === 'refresh') {
          guardTabAction({
            title: t('确认刷新当前页签？'),
            actionLabel: t('刷新页签'),
            affectedKeys: [tab.key],
            transferPolicy: 'none',
            action: () => dispatch(tabRefreshed(tab.key)),
          })
        } else if (key === 'close') {
          close(tab.key)
        } else if (key === 'others') {
          guardTabAction({
            actionLabel: t('关闭其他页签'),
            affectedKeys: removedKeysOf('others', tab.key),
            transferPolicy: 'continue-after-close',
            action: () => dispatch(otherTabsClosed(tab.key)),
          })
        } else if (key === 'left') {
          guardTabAction({
            actionLabel: t('关闭左侧页签'),
            affectedKeys: removedKeysOf('left', tab.key),
            transferPolicy: 'continue-after-close',
            action: () => dispatch(leftTabsClosed(tab.key)),
          })
        } else if (key === 'right') {
          guardTabAction({
            actionLabel: t('关闭右侧页签'),
            affectedKeys: removedKeysOf('right', tab.key),
            transferPolicy: 'continue-after-close',
            action: () => dispatch(rightTabsClosed(tab.key)),
          })
        } else if (key === 'all') {
          guardTabAction({
            actionLabel: t('关闭全部页签'),
            affectedKeys: removedKeysOf('all', tab.key),
            transferPolicy: 'continue-after-close',
            action: () => dispatch(allTabsClosed()),
          })
        }
      },
    }),
    [close, dispatch, guardTabAction, removedKeysOf, t],
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
        {/* 顶部使用紧凑文字标签，与底部彩色菜单图标形成层级。
            保留页签关闭、拖动排序及右键操作，固定标签不占关闭按钮空间。 */}
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
        ) : null}
      </div>
    </Dropdown>
  )
}
