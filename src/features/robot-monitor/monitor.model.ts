/** 监控地图使用逻辑坐标；每 20 个地图单位对应 1 米，避免画布缩放影响运动计算。 */
export interface MonitorStation {
	id: string
	label: string
	x: number
	y: number
	/** 从充电桩沿任务线路累计的距离，单位为地图单位。 */
	distance: number
}

/** 单机任务沿固定折线运行；返航也使用同一条线路，确保定位和任务进度一致。 */
export const STATIONS: readonly MonitorStation[] = [
	{ id: 'P01', label: '充电桩', x: 190, y: 510, distance: 0 },
	{ id: 'P02', label: '缓冲区', x: 470, y: 510, distance: 280 },
	{ id: 'P03', label: '取料点', x: 470, y: 330, distance: 460 },
	{ id: 'P04', label: '中转点', x: 790, y: 330, distance: 780 },
	{ id: 'P05', label: '下料点', x: 790, y: 180, distance: 930 },
]

/** 线路总长为 46.5 米；地图和状态面板共享同一个距离来源。 */
export const TOTAL_DISTANCE = 930

/** 朝向采用屏幕坐标的角度制：向右为 0°，向上为 -90°。 */
export interface RobotPosition {
	x: number
	y: number
	heading: number
}

/** 将累计距离投影到线路；越界距离钳制到端点，非法数值回到起点。 */
export function getRoutePosition(distance: number): RobotPosition {
	const boundedDistance = Number.isNaN(distance)
		? 0
		: Math.min(TOTAL_DISTANCE, Math.max(0, distance))

	for (let index = 1; index < STATIONS.length; index += 1) {
		const from = STATIONS[index - 1]
		const to = STATIONS[index]

		// 端点归属刚完成的线段，静止时保持确定的朝向，避免角点处来回旋转。
		if (boundedDistance <= to.distance) {
			const ratio =
				(boundedDistance - from.distance) /
				(to.distance - from.distance)
			return {
				x: from.x + (to.x - from.x) * ratio,
				y: from.y + (to.y - from.y) * ratio,
				heading:
					(Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI,
			}
		}
	}

	// 完整线路始终覆盖合法距离；保留末端坐标作为数值边界的确定返回值。
	const finalStation = STATIONS[STATIONS.length - 1]
	return { x: finalStation.x, y: finalStation.y, heading: -90 }
}

/** 状态只描述当前演示流程，急停恢复后必须由操作者再次点击继续。 */
export type RobotMode =
	'running' | 'paused' | 'emergency' | 'returning' | 'charging' | 'completed'

/** 事件颜色与含义独立于界面组件，便于地图和事件面板保持一致。 */
export type MonitorEventTone = 'info' | 'success' | 'warning' | 'danger'

/** 本地演示事件按时间倒序呈现，最多保留最近 30 条。 */
export interface MonitorEvent {
	id: number
	time: string
	message: string
	tone: MonitorEventTone
}

/** travelMode 在暂停和急停期间保留运动方向，恢复时不会错误切回配送路线。 */
export interface RobotMonitorState {
	mode: RobotMode
	travelMode: 'running' | 'returning'
	distance: number
	battery: number
	elapsed: number
	events: MonitorEvent[]
}
