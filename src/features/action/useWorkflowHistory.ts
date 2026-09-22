import { useCallback, useReducer } from 'react'
import type { WorkflowDocument } from './workflow.model'

/** 历史仅保留最近 60 次业务变更；选择状态和拖动中间帧不会占用撤销步骤。 */
interface HistoryState { current: WorkflowDocument; past: WorkflowDocument[]; future: WorkflowDocument[] }
type HistoryAction = { type: 'change'; update: (document: WorkflowDocument) => WorkflowDocument; record: boolean } | { type: 'undo' | 'redo' | 'checkpoint' }

/** 撤销快照仅存在当前编辑会话，恢复内容后由页面重新判断是否需要离开提醒。 */
function reduceHistory(state: HistoryState, action: HistoryAction): HistoryState {
  if (action.type === 'checkpoint') return { ...state, past: [...state.past.slice(-59), state.current], future: [] }
  if (action.type === 'undo') {
    const previous = state.past.at(-1)
    return previous ? { current: previous, past: state.past.slice(0, -1), future: [state.current, ...state.future] } : state
  }
  if (action.type === 'redo') {
    const next = state.future[0]
    return next ? { current: next, past: [...state.past, state.current], future: state.future.slice(1) } : state
  }
  if (action.type === 'change') {
    const next = action.update(state.current)
    if (next === state.current) return state
    return { current: next, past: action.record ? [...state.past.slice(-59), state.current] : state.past, future: action.record ? [] : state.future }
  }
  return state
}

/** 所有编辑入口共享一个历史栈；record=false 用于拖拽帧和选择状态。 */
export function useWorkflowHistory(initial: WorkflowDocument) {
  const [state, dispatch] = useReducer(reduceHistory, { current: initial, past: [], future: [] })
  const change = useCallback((update: (document: WorkflowDocument) => WorkflowDocument, record = true) => dispatch({ type: 'change', update, record }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const checkpoint = useCallback(() => dispatch({ type: 'checkpoint' }), [])
  return { document: state.current, change, undo, redo, checkpoint, canUndo: state.past.length > 0, canRedo: state.future.length > 0 }
}
