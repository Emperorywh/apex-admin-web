import data from './data/axis-motors.json'
import type {
	AxisMotor,
	AxisMotorData,
	MotorAction,
	MotorAttributes,
} from './axisMotor.types'

/** 直接检查 JSON 与当前模型契约，目录和初始记录均不再维护第二份副本。 */
export const axisMotorData: AxisMotorData = data

/** 每个合法动作都有明确的轴编号；未知动作直接报错，不使用会误配设备的默认动作。 */
export function getMotorAction(actionType: string): MotorAction {
	const action = axisMotorData.actions.find((item) => item.id === actionType)
	if (!action) throw new Error(`未找到轴动作：${actionType}`)
	return action
}

/** 新电机以合法的演示范围初始化；切换动作也复用此规则，防止沿用不同单位的参数。 */
export function createMotor(attributes: MotorAttributes): AxisMotor {
	const action = getMotorAction(attributes.actionType)
	const upperPosition = action.unit === '°' ? 180 : 1000

	return {
		...attributes,
		name: attributes.name.trim(),
		id: crypto.randomUUID(),
		parameters: {
			positiveTarget: upperPosition,
			negativeTarget: 0,
			upperPosition,
			lowerPosition: 0,
			upperEncoder: 4096,
			lowerEncoder: 0,
			...(action.hasPullWireEncoder ? { pullWireEncoder: 0 } : {}),
			// 伸缩正向编码器目标默认取上界，保证与反向目标之间存在可测试行程。
			...(action.hasTargetEncoder ? { targetEncoder: 4096 } : {}),
		},
		currentEncoder: 0,
	}
}
