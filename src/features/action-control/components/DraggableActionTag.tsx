/**
 * 组内动作可拖拽 Tag（P24；旧 DraggableTag 等价迁移）。
 *
 * - 只读消费组内动作的两个稳定字段：id（排序标识）/ actionDescription（展示
 *   文本；缺失留白不臆造）；
 * - 拖拽能力由 @dnd-kit/sortable 提供（TabsBar 页签拖拽同依赖），dnd-kit
 *   listeners 挂在 Tag 本体（旧实现同形态）；transform 只在拖拽中生效，
 *   松手后由 React 重渲染复位——本组件不持有顺序状态，顺序唯一权威是
 *   服务端数据（重排成功后的 reload 结果）。
 */

import { Tag } from 'antd'
import { useSortable } from '@dnd-kit/sortable'
import type { CSSProperties } from 'react'
import type { AgvActionGroupItemDto } from '@/services/action/agv-action-group-manage.service.types'

/** 拖拽通用样式：抓手光标；拖拽中禁用过渡防抖动（旧实现同款） */
const commonStyle: CSSProperties = {
  cursor: 'move',
  transition: 'unset',
}

interface DraggableActionTagProps {
  tag: AgvActionGroupItemDto
}

export function DraggableActionTag({ tag }: DraggableActionTagProps) {
  const { listeners, transform, transition, isDragging, setNodeRef } = useSortable({
    id: tag.id as number,
  })

  const style = transform
    ? {
        ...commonStyle,
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        transition: isDragging ? 'unset' : transition,
      }
    : commonStyle

  return (
    <Tag style={style} ref={setNodeRef} {...listeners}>
      {tag.actionDescription ?? ''}
    </Tag>
  )
}
