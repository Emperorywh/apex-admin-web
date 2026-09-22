/** 本地设备的稳定标识用于编辑和删除；表格序号随当前列表重新计算。 */
export interface DeviceRecord {
	id: string
}

/** 电机和电池共用 CAN 配置；电池没有执行器、编码器时保存为空字符串。 */
export interface CanDevice extends DeviceRecord {
	model: string
	actuator: string
	encoder: string
	name: string
	port: string
	canId: number
	alarm: boolean
}

/** GPIO 的触发状态与有效电平独立，避免将“低电平生效”误认为未触发。 */
export interface GpioDevice extends DeviceRecord {
	type: string
	name: string
	purpose: string
	triggered: boolean
	activeHigh: boolean
}

/** RS485 灯光、语音设备独立维护接口和模拟告警状态。 */
export interface SerialDevice extends DeviceRecord {
	port: string
	name: string
	alarm: boolean
}

/** JSON 只提供首次挂载的预制记录；页面修改保留在当前页面状态中。 */
export interface DeviceData {
	can: CanDevice[]
	gpio: GpioDevice[]
	serial: SerialDevice[]
}
