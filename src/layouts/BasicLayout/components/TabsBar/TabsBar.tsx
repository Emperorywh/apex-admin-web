/**
 * 页签栏（规格 §9.3/§11.3）：页签渲染、激活导航与全部页签交互。
 * - 右键菜单四项（刷新当前/关闭其他/关闭右侧/关闭全部），批量关闭永不影响 affix；
 *   ContextMenu 键 / Shift+F10 提供键盘等价触发（§11.3）；
 * - dnd-kit 拖拽排序：普通页签之间可拖，affix 禁拖且固定区边界由 computeTabsReorder
 *   最终校验；KeyboardSensor（Space 抬起/落下、方向键移动、Esc 取消）提供键盘拖拽，
 *   无法拖拽时右键菜单可完成关闭（§9.3）；
 * - 关闭当前页后继顺序：右侧最近 → 左侧最近 → /dashboard（§17.14）；
 * - 溢出横向滚动 + 左右箭头，激活页签自动进入可视区；
 * - 可访问性：role=tablist/tab、aria-selected、含页签名可访问名称的关闭按钮、
 *   焦点在页签关闭后移到新激活页签、页面切换后进入主容器（§11.3）。
 * 页签数据与缓存编排归 PageCacheHost/tabsModel；本组件只消费 store 并派发动作。
 */
import { Dropdown, type MenuProps } from 'antd'
import { ChevronLeft, ChevronRight, Pin, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEventHandler,
  type RefObject,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router'
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
import { ROUTE_FALLBACK_PATH } from '@/constants/route.constants'
import { COMMON_NAMESPACE, MENU_NAMESPACE } from '@/i18n/i18n'
import { abortRequestScope } from '@/services/request/requestScope'
import { cacheEntriesRemoved, cacheRevisionBumped } from '@/store/slices/pageCache.slice'
import { tabsRemoved, tabsReordered, type TabItem } from '@/store/slices/tabs.slice'
import type { RootState } from '@/store/store'
import {
  PAGE_CONTAINER_ID,
  computeTabsReorder,
  resolveCloseSuccessor,
  selectCloseAllKeys,
  selectCloseOthersKeys,
  selectCloseRightKeys,
  tabLocationTarget,
} from '@/layouts/BasicLayout/tabsModel'
import styles from './TabsBar.module.css'

/** 溢出箭头单次滚动距离，单位 px */
const TAB_SCROLL_STEP_PX = 240

/** 指针拖拽激活距离，单位 px：小于该位移视为点击，避免误触发拖拽 */
const TAB_DRAG_ACTIVATION_DISTANCE_PX = 4

/** 右键菜单动作 key（规格 §9.3：刷新当前、关闭其他、关闭右侧、关闭全部） */
const TAB_MENU_ACTIONS = {
  REFRESH: 'refresh',
  CLOSE_OTHERS: 'close-others',
  CLOSE_RIGHT: 'close-right',
  CLOSE_ALL: 'close-all',
} as const

export interface TabsBarProps {
  /** 页面主容器：页面切换后焦点进入该容器（规格 §11.3），由 BasicLayout 持有 */
  pageContainerRef: RefObject<HTMLElement | null>
}

export function TabsBar({ pageContainerRef }: TabsBarProps) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const items = useSelector((state: RootState) => state.tabs.items)
  const activeKey = useSelector((state: RootState) => state.tabs.activeKey)

  const [menuOpenKey, setMenuOpenKey] = useState<string | null>(null)
  const [arrowState, setArrowState] = useState({ left: false, right: false })
  const listRef = useRef<HTMLDivElement | null>(null)
  const tabNodes = useRef(new Map<string, HTMLElement>())
  const pendingFocusKeyRef = useRef<string | null>(null)

  const registerTabNode = useCallback((key: string, node: HTMLElement | null) => {
    if (node === null) {
      tabNodes.current.delete(key)
    } else {
      tabNodes.current.set(key, node)
    }
  }, [])

  // 焦点迁移（规格 §11.3）：页签关闭后移到新激活页签；页面切换后进入主容器
  const lastActiveKeyRef = useRef<string | null>(activeKey)
  useEffect(() => {
    const previous = lastActiveKeyRef.current
    lastActiveKeyRef.current = activeKey
    if (previous === activeKey || activeKey === null) {
      return
    }
    if (pendingFocusKeyRef.current === activeKey) {
      pendingFocusKeyRef.current = null
      tabNodes.current.get(activeKey)?.focus()
      return
    }
    pageContainerRef.current?.focus()
  }, [activeKey, pageContainerRef])

  // 溢出箭头可见性 + 激活页签自动进入可视区（规格 §9.3）
  const syncOverflow = useCallback(() => {
    const element = listRef.current
    if (element === null) {
      return
    }
    setArrowState({
      left: element.scrollLeft > 0,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
    })
  }, [])

  useEffect(() => {
    if (activeKey === null) {
      return
    }
    const node = tabNodes.current.get(activeKey)
    // jsdom 未实现 scrollIntoView，能力守卫保证测试环境安全
    node?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    syncOverflow()
  }, [activeKey, items, syncOverflow])

  const scrollByStep = useCallback((direction: 1 | -1) => {
    const element = listRef.current
    if (element !== null && typeof element.scrollBy === 'function') {
      element.scrollBy({ left: direction * TAB_SCROLL_STEP_PX })
    }
  }, [])

  const activateTab = useCallback(
    (tab: TabItem) => {
      if (tab.key !== activeKey) {
        navigate(tabLocationTarget(tab.location))
      }
    },
    [activeKey, navigate],
  )

  /**
   * 批量关闭原语：移除页签与缓存；激活页签被移除时按「右→左→/dashboard」
   * 决定后继（规格 §9.3/§17.14），并把焦点留给新激活页签（§11.3）。
   */
  const removeAndActivate = useCallback(
    (keys: readonly string[]) => {
      if (keys.length === 0) {
        return
      }
      const removing = new Set(keys)
      dispatch(tabsRemoved({ keys: [...removing] }))
      dispatch(cacheEntriesRemoved({ keys: [...removing] }))
      if (activeKey !== null && removing.has(activeKey)) {
        const successor = resolveCloseSuccessor(items, activeKey, removing)
        if (successor !== null) {
          pendingFocusKeyRef.current = successor.key
          navigate(tabLocationTarget(successor.location))
        } else {
          navigate(ROUTE_FALLBACK_PATH)
        }
      }
    },
    [activeKey, dispatch, items, navigate],
  )

  const closeTab = useCallback((tab: TabItem) => removeAndActivate([tab.key]), [removeAndActivate])

  // 刷新当前（规格 §9.3）：revision 递增 + 取消该 scope，Activity 以新 React key 重建；
  // 右键非激活页签时先导航到该页签再刷新，保持「刷新当前」语义
  const refreshTab = useCallback(
    (tab: TabItem) => {
      dispatch(cacheRevisionBumped({ key: tab.key }))
      abortRequestScope(tab.key)
      if (tab.key !== activeKey) {
        navigate(tabLocationTarget(tab.location))
      }
    },
    [activeKey, dispatch, navigate],
  )

  const handleMenuAction = useCallback(
    (action: string, tab: TabItem) => {
      setMenuOpenKey(null)
      if (action === TAB_MENU_ACTIONS.REFRESH) {
        refreshTab(tab)
        return
      }
      if (action === TAB_MENU_ACTIONS.CLOSE_OTHERS) {
        removeAndActivate(selectCloseOthersKeys(items, tab.key))
        return
      }
      if (action === TAB_MENU_ACTIONS.CLOSE_RIGHT) {
        removeAndActivate(selectCloseRightKeys(items, tab.key))
        return
      }
      removeAndActivate(selectCloseAllKeys(items))
    },
    [items, refreshTab, removeAndActivate],
  )

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (over === null || active.id === over.id) {
        return
      }
      const next = computeTabsReorder(items, String(active.id), String(over.id))
      if (next !== null) {
        dispatch(tabsReordered({ items: next }))
      }
    },
    [dispatch, items],
  )

  // 键盘拖拽（规格 §9.3/§11.3）：Space 抬起/落下、方向键移动、Esc 取消；
  // Enter 保留给页签激活，不作为拖拽起始键
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: TAB_DRAG_ACTIVATION_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], end: ['Space'], cancel: ['Escape'] },
    }),
  )

  const translate = useCallback((key: string) => t(key, { ns: MENU_NAMESPACE }), [t])

  const closeLabelOf = useCallback(
    (title: string) => `${t('关闭', { ns: COMMON_NAMESPACE })} ${title}`,
    [t],
  )

  const focusNeighbor = useCallback(
    (fromKey: string, direction: 1 | -1) => {
      const index = items.findIndex((tab) => tab.key === fromKey)
      if (index < 0) {
        return
      }
      const next = (index + direction + items.length) % items.length
      tabNodes.current.get(items[next].key)?.focus()
    },
    [items],
  )

  const menuItems = useMemo<MenuProps['items']>(
    () => [
      { key: TAB_MENU_ACTIONS.REFRESH, label: t('刷新当前') },
      { key: TAB_MENU_ACTIONS.CLOSE_OTHERS, label: t('关闭其他') },
      { key: TAB_MENU_ACTIONS.CLOSE_RIGHT, label: t('关闭右侧') },
      { key: TAB_MENU_ACTIONS.CLOSE_ALL, label: t('关闭全部') },
    ],
    [t],
  )

  const sortableKeys = useMemo(() => items.map((tab) => tab.key), [items])

  return (
    <div className={styles.tabsBar} data-region="tabs-bar">
      <button
        type="button"
        className={styles.scrollButton}
        data-side="left"
        data-visible={arrowState.left}
        aria-label={t('向左滚动', { ns: COMMON_NAMESPACE })}
        onClick={() => scrollByStep(-1)}
      >
        <ChevronLeft size={14} aria-hidden />
      </button>
      <div
        ref={listRef}
        className={styles.list}
        role="tablist"
        aria-label={t('页签', { ns: COMMON_NAMESPACE })}
        onScroll={syncOverflow}
      >
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableKeys} strategy={horizontalListSortingStrategy}>
            {items.map((tab) => (
              <SortableTab
                key={tab.key}
                tab={tab}
                active={tab.key === activeKey}
                menuOpen={menuOpenKey === tab.key}
                translate={translate}
                closeLabelOf={closeLabelOf}
                menuItems={menuItems}
                onOpenMenuChange={setMenuOpenKey}
                onActivate={activateTab}
                onClose={closeTab}
                onMenuAction={handleMenuAction}
                registerNode={registerTabNode}
                focusNeighbor={focusNeighbor}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <button
        type="button"
        className={styles.scrollButton}
        data-side="right"
        data-visible={arrowState.right}
        aria-label={t('向右滚动', { ns: COMMON_NAMESPACE })}
        onClick={() => scrollByStep(1)}
      >
        <ChevronRight size={14} aria-hidden />
      </button>
    </div>
  )
}

interface SortableTabProps {
  tab: TabItem
  active: boolean
  menuOpen: boolean
  translate: (key: string) => string
  closeLabelOf: (title: string) => string
  menuItems: MenuProps['items']
  onOpenMenuChange: (key: string | null) => void
  onActivate: (tab: TabItem) => void
  onClose: (tab: TabItem) => void
  onMenuAction: (action: string, tab: TabItem) => void
  registerNode: (key: string, node: HTMLElement | null) => void
  focusNeighbor: (fromKey: string, direction: 1 | -1) => void
}

/**
 * 单个页签节点：外层是 dnd-kit 拖拽节点并承载 role=tab 焦点语义；
 * 内层经 antd Dropdown 承载右键菜单（触发元素由 Dropdown 独占 ref，
 * 与 sortable 节点 ref 分离，避免 cloneElement 合并冲突）。
 */
function SortableTab(props: SortableTabProps) {
  const { tab, active } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.key,
    // 固定页签禁拖：不可拖出固定区（规格 §9.3）
    disabled: tab.affix,
  })
  // SyntheticListenerMap 的成员是宽泛 Function：拆出后按 React 事件签名收敛使用
  const dndPointerDown = listeners?.onPointerDown as PointerEventHandler<HTMLDivElement> | undefined
  const dndKeyDown = listeners?.onKeyDown as ((event: KeyboardEvent<HTMLElement>) => void) | undefined

  const setTabRef = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node)
      props.registerNode(tab.key, node)
    },
    [props, setNodeRef, tab.key],
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // dnd-kit 键盘传感器先处理拖拽中的按键（Space/方向键/Esc）
    dndKeyDown?.(event)
    if (isDragging) {
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      props.onActivate(tab)
      return
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      // 焦点在页签间游走（roving tabindex 的键盘等价）
      event.preventDefault()
      props.focusNeighbor(tab.key, event.key === 'ArrowRight' ? 1 : -1)
      return
    }
    // 右键菜单的键盘等价触发（规格 §11.3）：ContextMenu 键或 Shift+F10
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault()
      props.onOpenMenuChange(tab.key)
    }
  }

  const dragStyle =
    transform === null
      ? undefined
      : { transform: `translate3d(${Math.round(transform.x)}px, 0, 0)`, transition: transition ?? undefined }

  return (
    <div
      ref={setTabRef}
      style={dragStyle}
      className={styles.tab}
      data-tab-key={tab.key}
      data-affix={tab.affix}
      data-active={active}
      data-dragging={isDragging}
      {...attributes}
      onPointerDown={dndPointerDown}
      onKeyDown={handleKeyDown}
      onClick={() => props.onActivate(tab)}
      role="tab"
      aria-selected={active}
      aria-controls={PAGE_CONTAINER_ID}
      tabIndex={active ? 0 : -1}
    >
      <Dropdown
        open={props.menuOpen}
        trigger={['contextMenu']}
        onOpenChange={(open) => props.onOpenMenuChange(open ? tab.key : null)}
        menu={{ items: props.menuItems, onClick: ({ key }) => props.onMenuAction(key, tab) }}
      >
        <div className={styles.tabBody}>
          {tab.affix ? <Pin size={12} aria-hidden className={styles.affixIcon} /> : null}
          <span className={styles.tabTitle}>{props.translate(tab.title)}</span>
          {tab.affix ? null : (
            <button
              type="button"
              className={styles.closeButton}
              aria-label={props.closeLabelOf(props.translate(tab.title))}
              onClick={(event) => {
                event.stopPropagation()
                props.onClose(tab)
              }}
            >
              <X size={12} aria-hidden />
            </button>
          )}
        </div>
      </Dropdown>
    </div>
  )
}
