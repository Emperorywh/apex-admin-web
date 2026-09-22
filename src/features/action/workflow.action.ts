import { axisMotorData } from '../axis-motor/axisMotor.model'
import type { AxisMotor } from '../axis-motor/axisMotor.types'
import type { WorkflowNodeData } from './workflow.model'

/** E叉取货独立维护轴绑定和目标参数；空值表示尚未应用，不借用通用动作的目标位置。 */
export interface EForkPickupSettings {
	motorId: string
	liftHeight: number | null
	encoderValue: number | null
	enabled: boolean
}

/** 编号由动作类型确定，用户不能修改；未绑定的动作可留在当前编辑会话继续配置。 */
export const EFORK_PICKUP_CODE = 1005
export const EMPTY_PICKUP: EForkPickupSettings = {
	motorId: '',
	liftHeight: null,
	encoderValue: null,
	enabled: true,
}

/** 只提供当前已配置且具备顶升能力的轴，不将动作类型目录当成车体实际拥有的电机。 */
export function getPickupMotors(motors: AxisMotor[]): AxisMotor[] {
	return motors.filter((motor) =>
		axisMotorData.actions.some(
			(action) =>
				action.id === motor.actionType && action.categoryId === 'lift',
		),
	)
}

/** 两点标定将毫米换算为整数编码器计数，保证配置与模拟运动使用同一转换。 */
export function heightToEncoder(motor: AxisMotor, height: number): number {
	const p = motor.parameters
	return Math.round(
		p.lowerEncoder +
			((height - p.lowerPosition) / (p.upperPosition - p.lowerPosition)) *
				(p.upperEncoder - p.lowerEncoder),
	)
}

/** 编码器反算到毫米时保留两位小数，与顶升高度输入精度一致。 */
export function encoderToHeight(motor: AxisMotor, encoder: number): number {
	const p = motor.parameters
	return (
		Math.round(
			(p.lowerPosition +
				((encoder - p.lowerEncoder) /
					(p.upperEncoder - p.lowerEncoder)) *
					(p.upperPosition - p.lowerPosition)) *
				100,
		) / 100
	)
}

/** 参数校验也用于流程检查；绑定删除、类型改变或重新标定后均需要重新确认目标。 */
export function validatePickup(
	settings: EForkPickupSettings | undefined,
	motors: AxisMotor[],
): string[] {
	const motor = getPickupMotors(motors).find(
		(item) => item.id === settings?.motorId,
	)
	if (!motor) return ['请选择并应用当前车体的顶升轴电机']
	const { liftHeight, encoderValue } = settings!
	const p = motor.parameters
	if (liftHeight === null || encoderValue === null)
		return ['请填写并应用顶升高度和编码器值']
	if (
		!Number.isFinite(liftHeight) ||
		liftHeight <= p.lowerPosition ||
		liftHeight > p.upperPosition
	)
		return ['顶升高度必须高于下限且不超过上限']
	if (
		!Number.isInteger(encoderValue) ||
		encoderValue <= p.lowerEncoder ||
		encoderValue > p.upperEncoder
	)
		return ['编码器值必须是标定范围内且高于下限的整数']
	// 毫米输入和整数编码器之间允许半个高度分辨率的舍入误差。
	const tolerance = Math.max(
		1,
		Math.ceil(
			((p.upperEncoder - p.lowerEncoder) /
				(p.upperPosition - p.lowerPosition)) *
				0.005,
		),
	)
	if (Math.abs(heightToEncoder(motor, liftHeight) - encoderValue) > tolerance)
		return ['顶升高度与编码器值不匹配，请根据当前标定重新应用']
	return []
}

/** 独立测试只检查当前动作，不要求先接好完整流程；流程检查复用相同约束，避免两个入口规则不一致。 */
export function validateActionConfiguration(
	data: WorkflowNodeData,
	motors: AxisMotor[],
): string[] {
	const issues: string[] = []
	if (!data.label.trim()) issues.push('请输入节点名称')
	if (
		!Number.isInteger(data.timeout) ||
		data.timeout < 1 ||
		data.timeout > 86400
	)
		issues.push('超时时间必须是 1 到 86400 之间的整数')
	if (
		!Number.isInteger(data.retries) ||
		data.retries < 0 ||
		data.retries > 10
	)
		issues.push('重试次数必须是 0 到 10 之间的整数')
	if (data.actionId === 'efork-pick')
		issues.push(...validatePickup(data.pickup, motors))
	else if (!data.target.trim()) issues.push('请填写动作目标')
	return issues
}
