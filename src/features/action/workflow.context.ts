import { createContext } from 'react'

/** 操作通过上下文传递，节点数据保持可序列化，避免保存时混入函数或视图状态。 */
export const WorkflowNodeActions = createContext<{
	onAdd: (id: string, handle: string) => void
	onDuplicate: (id: string) => void
	onDelete: (id: string) => void
}>({ onAdd: () => {}, onDuplicate: () => {}, onDelete: () => {} })
