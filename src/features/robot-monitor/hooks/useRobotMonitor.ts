import { useCallback, useEffect, useReducer } from 'react'
import { usePageActive } from '@/hooks/usePageActive'
import {
  getRoutePosition,
  STATIONS,
  TOTAL_DISTANCE,
  type MonitorEventTone,
  type RobotMode,
  type RobotMonitorState,
} from '../monitor.model'

/** 演示运动速度为每秒 14 个地图单位，对应面板中的 0.7 米/秒。 */
const ROUTE_SPEED = 14
const MAP_UNITS_PER_METER = 20
const INITIAL_DISTANCE = TOTAL_DISTANCE * 0.38

/** 所有控制命令都在 reducer 内校验，避免快速连续点击绕过界面禁用状态。 */
type MonitorAction =
  | { type: 'tick'; seconds: number; time: string }
  | { type: 'pause' | 'resume' | 'emergencyStop' | 'resetEmergency' | 'returnToCharge' | 'restart'; time: string }
  | { type: 'relocate'; stationId: string; time: string }

/** 时间仅在派发动作前采样，使 reducer 的同一次动作可重复计算。 */
function eventTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

/** 初始场景已经开始配送，进入页面即可看到线路运动和遥测数据。 */
function initialState(): RobotMonitorState {
  return {
    mode: 'running',
    travelMode: 'running',
    distance: INITIAL_DISTANCE,
    battery: 78,
    elapsed: INITIAL_DISTANCE / ROUTE_SPEED,
    events: [{ id: 1, time: eventTime(), message: '导航任务已启动，正在前往下料点 P05', tone: 'success' }],
  }
}

/** 事件编号单调递增；截断旧事件防止长时间演示造成列表无限增长。 */
function withEvent(state: RobotMonitorState, time: string, message: string, tone: MonitorEventTone): RobotMonitorState {
  return {
    ...state,
    events: [{ id: (state.events[0]?.id ?? 0) + 1, time, message, tone }, ...state.events].slice(0, 30),
  }
}

/** 单一状态机负责运动、急停、重定位和返航；演示不向真实车辆发送任何命令。 */
function monitorReducer(state: RobotMonitorState, action: MonitorAction): RobotMonitorState {
  switch (action.type) {
    case 'tick': {
      // 隐藏页面不补算时间；即使浏览器短暂阻塞，单次最多推进一秒以避免车辆跳跃。
      const seconds = Math.min(1, Math.max(0, action.seconds))
      if (state.mode === 'charging') {
        const battery = Math.min(100, state.battery + seconds * 0.6)
        if (battery === state.battery) return state
        const chargedState = { ...state, battery }
        return battery === 100
          ? withEvent(chargedState, action.time, '电池充电完成，机器人已就绪', 'success')
          : chargedState
      }
      if (state.mode !== 'running' && state.mode !== 'returning') return state

      const direction = state.mode === 'returning' ? -1 : 1
      const distance = Math.max(0, Math.min(TOTAL_DISTANCE, state.distance + direction * ROUTE_SPEED * seconds))
      const actualSeconds = Math.abs(distance - state.distance) / ROUTE_SPEED
      const nextState = {
        ...state,
        distance,
        elapsed: state.elapsed + actualSeconds,
        battery: Math.max(0, state.battery - actualSeconds * 0.018),
      }

      // 仅跨入终点时写入完成事件，后续定时动作不会重复发出到站通知。
      if (state.mode === 'returning' && distance === 0) {
        return withEvent({ ...nextState, mode: 'charging' }, action.time, '已抵达充电桩 P01，开始自动充电', 'success')
      }
      if (state.mode === 'running' && distance === TOTAL_DISTANCE) {
        return withEvent({ ...nextState, mode: 'completed' }, action.time, '已抵达下料点 P05，本次配送任务完成', 'success')
      }
      if (nextState.battery === 0) {
        return withEvent({ ...nextState, mode: 'paused' }, action.time, '电量耗尽，机器人已停止运动', 'warning')
      }
      return nextState
    }
    case 'pause':
      if (state.mode !== 'running' && state.mode !== 'returning') return state
      return withEvent({ ...state, mode: 'paused' }, action.time, '任务已暂停，机器人保持当前位置', 'warning')
    case 'resume':
      if (state.mode !== 'paused' || state.battery <= 0) return state
      // 在路线端点恢复时直接进入相应终态，不制造一帧虚假的运动状态。
      if (state.travelMode === 'running' && state.distance === TOTAL_DISTANCE) {
        return withEvent({ ...state, mode: 'completed' }, action.time, '机器人已位于任务终点 P05', 'success')
      }
      if (state.travelMode === 'returning' && state.distance === 0) {
        return withEvent({ ...state, mode: 'charging' }, action.time, '机器人已位于充电桩 P01，开始自动充电', 'success')
      }
      return withEvent({ ...state, mode: state.travelMode }, action.time, state.travelMode === 'returning' ? '已继续返航充电任务' : '已继续配送任务', 'success')
    case 'emergencyStop':
      if (state.mode === 'emergency') return state
      return withEvent({ ...state, mode: 'emergency' }, action.time, '急停已触发，机器人立即停止', 'danger')
    case 'resetEmergency':
      if (state.mode !== 'emergency') return state
      return withEvent({ ...state, mode: 'paused' }, action.time, '急停已解除，等待手动继续任务', 'info')
    case 'returnToCharge':
      if (state.mode === 'emergency' || state.mode === 'charging' || state.mode === 'returning' || state.battery <= 0) return state
      if (state.distance === 0) {
        return withEvent({ ...state, mode: 'charging', travelMode: 'returning' }, action.time, '机器人已位于充电桩 P01，开始自动充电', 'success')
      }
      return withEvent({ ...state, mode: 'returning', travelMode: 'returning' }, action.time, '返航指令已确认，沿原路线返回充电桩 P01', 'info')
    case 'relocate': {
      if (state.mode !== 'paused' && state.mode !== 'completed' && state.mode !== 'charging') return state
      const station = STATIONS.find((item) => item.id === action.stationId)
      if (!station) return state
      return withEvent({ ...state, distance: station.distance, mode: 'paused' }, action.time, `已重定位至 ${station.label} ${station.id}，等待手动继续`, 'info')
    }
    case 'restart':
      if ((state.mode !== 'completed' && state.mode !== 'charging') || state.battery <= 0) return state
      return withEvent({ ...state, mode: 'running', travelMode: 'running', distance: 0, elapsed: 0 }, action.time, '新演示任务已启动：充电桩 P01 → 下料点 P05', 'success')
  }
}

/** 页面状态文案只由机器人模式派生，避免控制区和遥测区展示不同状态。 */
const STATUS_LABELS: Record<RobotMode, string> = {
  running: '执行任务中',
  paused: '任务已暂停',
  emergency: '急停保护中',
  returning: '返航充电中',
  charging: '自动充电中',
  completed: '任务已完成',
}

/** 提供单车监控演示；页面缓存隐藏、浏览器后台和组件卸载时均释放运动定时器。 */
export function useRobotMonitor() {
  const [state, dispatch] = useReducer(monitorReducer, undefined, initialState)
  const { isActive } = usePageActive()
  const isAnimating = state.mode === 'running' || state.mode === 'returning' || (state.mode === 'charging' && state.battery < 100)

  useEffect(() => {
    if (!isActive || !isAnimating) return
    let interval: ReturnType<typeof setInterval> | undefined
    let lastTick = performance.now()

    // 切换标签页时销毁定时器；返回前台后重新采样起点，不追赶隐藏期间的时间。
    const syncVisibility = () => {
      if (interval !== undefined) clearInterval(interval)
      interval = undefined
      if (document.visibilityState !== 'visible') return
      lastTick = performance.now()
      interval = setInterval(() => {
        const now = performance.now()
        dispatch({ type: 'tick', seconds: (now - lastTick) / 1000, time: eventTime() })
        lastTick = now
      }, 250)
    }

    syncVisibility()
    document.addEventListener('visibilitychange', syncVisibility)
    return () => {
      if (interval !== undefined) clearInterval(interval)
      document.removeEventListener('visibilitychange', syncVisibility)
    }
  }, [isActive, isAnimating])

  // 控制方法保持引用稳定，所有状态检查集中在 reducer，避免闭包捕获过期状态。
  const pause = useCallback(() => dispatch({ type: 'pause', time: eventTime() }), [])
  const resume = useCallback(() => dispatch({ type: 'resume', time: eventTime() }), [])
  const emergencyStop = useCallback(() => dispatch({ type: 'emergencyStop', time: eventTime() }), [])
  const resetEmergency = useCallback(() => dispatch({ type: 'resetEmergency', time: eventTime() }), [])
  const returnToCharge = useCallback(() => dispatch({ type: 'returnToCharge', time: eventTime() }), [])
  const relocate = useCallback((stationId: string) => dispatch({ type: 'relocate', stationId, time: eventTime() }), [])
  const restart = useCallback(() => dispatch({ type: 'restart', time: eventTime() }), [])

  // 返航时车头转向线路反方向，暂停后仍保持最后的行驶朝向。
  const routePosition = getRoutePosition(state.distance)
  const position = { ...routePosition, heading: routePosition.heading + (state.travelMode === 'returning' ? 180 : 0) }
  const moving = state.mode === 'running' || state.mode === 'returning'
  const remainingDistance = state.travelMode === 'returning' ? state.distance : TOTAL_DISTANCE - state.distance

  return {
    state,
    position,
    progress: (state.distance / TOTAL_DISTANCE) * 100,
    speed: moving ? ROUTE_SPEED / MAP_UNITS_PER_METER : 0,
    statusLabel: state.mode === 'charging' && state.battery === 100 ? '充电已完成' : STATUS_LABELS[state.mode],
    remainingSeconds: Math.ceil(remainingDistance / ROUTE_SPEED),
    pause,
    resume,
    emergencyStop,
    resetEmergency,
    returnToCharge,
    relocate,
    restart,
  }
}
