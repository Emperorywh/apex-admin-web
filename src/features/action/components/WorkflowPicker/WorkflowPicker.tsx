import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Button, Empty, Input, type InputRef } from 'antd'
import { ChevronDown, FolderOpen, Layers3, Search, Workflow, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ACTION_PRESETS, type ActionPreset } from '../../workflow.model'
import { WorkflowIcon } from '../WorkflowIcon/WorkflowIcon'
import styles from './WorkflowPicker.module.css'

/** 弹层坐标相对于画布容器；选择结果由编辑器添加到当前端口或空白位置。 */
interface WorkflowPickerProps {
  position: { x: number; y: number }
  onClose: () => void
  onSelect: (preset: ActionPreset) => void
}

/** 按需打开的节点选择器保留完整画布空间，动作库与逻辑节点通过分段切换。 */
export function WorkflowPicker({ position, onClose, onSelect }: WorkflowPickerProps) {
  const { t } = useTranslation('action')
  const dialogId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<InputRef>(null)
  const [section, setSection] = useState<'action' | 'logic'>('action')
  const [query, setQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())

  // 打开时聚焦搜索框；关闭后仅恢复仍处于弹层内的焦点，避免抢走用户点击目标的焦点。
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    const frame = requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }))
    return () => {
      cancelAnimationFrame(frame)
      if (panel?.contains(document.activeElement)) previousFocus?.focus({ preventScroll: true })
    }
  }, [])

  // 全局捕获关闭行为，不干扰弹层内部按钮；卸载时移除事件以免画布积累监听器。
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) onClose()
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('pointerdown', closeOutside, true)
    document.addEventListener('keydown', closeOnEscape, true)
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true)
      document.removeEventListener('keydown', closeOnEscape, true)
    }
  }, [onClose])

  // 同时匹配当前语言和预制中文名称，搜索期间展开所有命中组以避免结果被折叠隐藏。
  const groups = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    const matched = ACTION_PRESETS.filter((preset) => {
      const belongsToSection = section === 'action' ? preset.kind === 'action' : preset.kind !== 'action'
      const searchable = `${preset.label} ${preset.group} ${t(preset.label)} ${t(preset.group)}`.toLocaleLowerCase()
      return belongsToSection && (!needle || searchable.includes(needle))
    })
    const grouped = new Map<string, ActionPreset[]>()
    for (const preset of matched) {
      const group = grouped.get(preset.group) ?? []
      group.push(preset)
      grouped.set(preset.group, group)
    }
    return [...grouped.entries()]
  }, [query, section, t])

  // 只维护用户主动折叠的组，清除搜索后恢复搜索前的展开状态。
  const toggleGroup = (group: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  return <div
    ref={panelRef}
    role="dialog"
    aria-labelledby={`${dialogId}-title`}
    className={`${styles.picker} nodrag nopan nowheel`}
    style={{ '--picker-x': `${position.x}px`, '--picker-y': `${position.y}px` } as CSSProperties}
    onPointerDown={(event) => event.stopPropagation()}
    onWheel={(event) => event.stopPropagation()}
  >
    <div className={styles.heading}>
      <strong id={`${dialogId}-title`}><Layers3 size={16} />{t('添加节点')}</strong>
      <Button type="text" size="small" icon={<X size={16} />} aria-label={t('关闭节点选择')} onClick={onClose} />
    </div>
    <div className={styles.search}>
      <Input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} prefix={<Search size={15} />} placeholder={t('搜索节点名称或动作库')} aria-label={t('搜索节点名称或动作库')} allowClear />
    </div>
    <div className={styles.tabs} role="tablist" aria-label={t('节点分类')}>
      <button id={`${dialogId}-action`} type="button" role="tab" aria-selected={section === 'action'} aria-controls={`${dialogId}-content`} className={section === 'action' ? styles.activeTab : ''} onClick={() => setSection('action')}><FolderOpen size={14} />{t('动作库')}</button>
      <button id={`${dialogId}-logic`} type="button" role="tab" aria-selected={section === 'logic'} aria-controls={`${dialogId}-content`} className={section === 'logic' ? styles.activeTab : ''} onClick={() => setSection('logic')}><Workflow size={14} />{t('逻辑节点')}</button>
    </div>
    <div id={`${dialogId}-content`} className={styles.content} role="tabpanel" aria-labelledby={`${dialogId}-${section}`}>
      {groups.length === 0 && <Empty className={styles.empty} image={Empty.PRESENTED_IMAGE_SIMPLE} description={<><strong>{t('未找到匹配的节点')}</strong><span>{t('尝试其他关键词')}</span></>} />}
      {groups.map(([group, presets], index) => {
        const expanded = Boolean(query.trim()) || !collapsedGroups.has(group)
        return <section key={group} className={styles.group}>
          <button type="button" className={styles.groupHeading} aria-expanded={expanded} aria-controls={`${dialogId}-group-${index}`} onClick={() => toggleGroup(group)}>
            <ChevronDown size={13} className={expanded ? '' : styles.collapsedChevron} />
            <span>{t(group)}</span>
            <small>{presets.length}</small>
          </button>
          {expanded && <div id={`${dialogId}-group-${index}`} className={styles.items}>
            {presets.map((preset) => <button key={preset.id} type="button" className={styles.item} onClick={() => onSelect(preset)}>
              <WorkflowIcon kind={preset.kind} actionId={preset.id} />
              <span className={styles.itemText}><strong>{t(preset.label)}</strong><span>{t(preset.description)}</span></span>
            </button>)}
          </div>}
        </section>
      })}
    </div>
    <div className={styles.footer}><span>{t('选择节点以添加到画布')}</span><kbd>Esc</kbd></div>
  </div>
}
