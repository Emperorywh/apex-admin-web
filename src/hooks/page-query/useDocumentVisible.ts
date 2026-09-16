/**
 * document 可见性：浏览器页签/窗口最小化时为 false。
 * 与 Activity 激活态（usePageActive）共同构成查询的完整可见性——
 * SPEC §9.2 要求“应用页签可见且 document 可见才轮询”。
 */

import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

function getSnapshot(): boolean {
  return document.visibilityState === 'visible'
}

/** 服务端渲染/非浏览器环境兜底：视为可见（不阻塞首帧） */
function getServerSnapshot(): boolean {
  return true
}

export function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
