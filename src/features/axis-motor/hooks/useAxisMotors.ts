import { useCallback, useEffect, useRef, useState } from 'react'
import { axisMotorData, createMotor, getMotorAction } from '../axisMotor.model'
import type { AxisMotor, MotorAttributes, MotorParameters } from '../axisMotor.types'

/** 只读写当前电机数组格式，浏览器数据不会覆盖仓库中维护的初始 JSON。 */
const storageKey = 'apex-axis-motors'

/** 页面将读写异常展示给用户，避免本地存储不可用时仍提示保存成功。 */
interface MotorState {
  motors: AxisMotor[]
  storageWarning: string | null
  /** 无效缓存只用于触发清理，不把不符合当前模型的内容带入电机状态。 */
  pendingCacheReset: boolean
}

/** 从持久化数据验证对象边界，防止 null、数组或异常值绕过字段校验。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 属性只能引用 JSON 中实际存在的动作、驱动器和编码器。 */
function validAttributes(value: unknown): value is MotorAttributes {
  if (!isRecord(value)) return false
  return typeof value.name === 'string' && value.name.trim().length > 0 && value.name.trim().length <= 40
    && typeof value.actionType === 'string'
    && axisMotorData.actions.some((action) => action.id === value.actionType)
    && axisMotorData.drivers.some((driver) => driver.value === value.driverId)
    && axisMotorData.encoders.some((encoder) => encoder.value === value.encoderId)
}

/** 位置按毫米或角度保存有限非负值，与表单允许的最大行程保持一致。 */
function isPosition(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000000
}

/** 编码器统一使用非负 32 位有符号整数范围，避免加载表单无法编辑的计数值。 */
function isEncoder(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2147483647
}

/** 控制目标必须落在严格递增的标定边界内；只接收当前动作实际使用的可选编码器字段。 */
function validParameters(value: unknown, actionType: string): value is MotorParameters {
  if (!isRecord(value)) return false
  const { positiveTarget, negativeTarget, targetEncoder, upperPosition, lowerPosition, upperEncoder, lowerEncoder, pullWireEncoder } = value
  if (!isPosition(upperPosition) || !isPosition(lowerPosition) || !isPosition(positiveTarget) || !isPosition(negativeTarget)) return false
  if (!isEncoder(upperEncoder) || !isEncoder(lowerEncoder)) return false
  if (upperPosition <= lowerPosition || upperEncoder <= lowerEncoder) return false
  if (positiveTarget <= negativeTarget || positiveTarget > upperPosition || negativeTarget < lowerPosition) return false
  const action = getMotorAction(actionType)
  if (action.hasPullWireEncoder ? !isEncoder(pullWireEncoder) : pullWireEncoder !== undefined) return false
  // 按两点标定换算目标；整数编码器必须能区分正、反向位置，避免小于分辨率的空行程。
  const negativeEncoder = Math.round(lowerEncoder + (negativeTarget - lowerPosition) / (upperPosition - lowerPosition) * (upperEncoder - lowerEncoder))
  const positiveEncoder = Math.round(lowerEncoder + (positiveTarget - lowerPosition) / (upperPosition - lowerPosition) * (upperEncoder - lowerEncoder))
  return action.hasTargetEncoder
    ? isEncoder(targetEncoder) && targetEncoder > negativeEncoder && targetEncoder <= upperEncoder
    : targetEncoder === undefined && positiveEncoder > negativeEncoder
}

/** 已保存电机必须符合当前模型；拒绝重复 ID，保证后续按 ID 修改时只命中一条记录。 */
function validMotors(value: unknown): value is AxisMotor[] {
  if (!Array.isArray(value)) return false
  const ids = new Set<string>()
  return value.every((motor: unknown) => {
    if (!isRecord(motor) || !validAttributes(motor)) return false
    if (typeof motor.id !== 'string' || !motor.id.trim() || ids.has(motor.id)) return false
    if (!validParameters(motor.parameters, motor.actionType)) return false
    if (!isEncoder(motor.currentEncoder) || motor.currentEncoder < motor.parameters.lowerEncoder || motor.currentEncoder > motor.parameters.upperEncoder) return false
    ids.add(motor.id)
    return true
  })
}

/** 初始化只读取缓存；格式错误回退到 JSON 并标记清理，读取权限错误单独提示。 */
function loadMotors(): MotorState {
  const defaults = structuredClone(axisMotorData.motors)
  let saved: string | null
  try {
    saved = localStorage.getItem(storageKey)
  } catch {
    return { motors: defaults, storageWarning: '无法读取本地轴电机数据，已加载 JSON 初始数据。请检查浏览器存储权限。', pendingCacheReset: false }
  }
  if (saved === null) return { motors: defaults, storageWarning: null, pendingCacheReset: false }

  // JSON 语法损坏和字段校验失败统一视为无效缓存，不添加旧格式转换或字段补齐逻辑。
  try {
    const parsed: unknown = JSON.parse(saved)
    if (validMotors(parsed)) return { motors: parsed, storageWarning: null, pendingCacheReset: false }
  } catch {
    // 可读取但无法解析的内容由挂载后的 Effect 清理，避免将语法错误误报为存储权限异常。
  }
  return { motors: defaults, storageWarning: null, pendingCacheReset: true }
}

/** 管理本地电机及持久化结果；通过引用串行提交，避免同一事件内连续保存覆盖前次更新。 */
export function useAxisMotors() {
  const [state, setState] = useState<MotorState>(loadMotors)
  const motorsRef = useRef(state.motors)

  // 挂载后只清理当前页面的无效缓存，避免每次刷新重复加载同一份坏数据；同步操作无需清理资源。
  useEffect(() => {
    if (!state.pendingCacheReset) return
    let storageWarning: string | null = null
    try {
      localStorage.removeItem(storageKey)
    } catch {
      storageWarning = '无法清理无效的轴电机缓存，已加载 JSON 初始数据。请检查浏览器存储权限后重试。'
    }
    setState((current) => ({ ...current, pendingCacheReset: false, storageWarning }))
  }, [state.pendingCacheReset])

  /** 存储成功之后才更新页面；失败时保留已保存状态并向调用方返回 false。 */
  const commit = useCallback((motors: AxisMotor[]): boolean => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(motors))
      motorsRef.current = motors
      setState({ motors, storageWarning: null, pendingCacheReset: false })
      return true
    } catch {
      setState((current) => ({ ...current, storageWarning: '保存失败：浏览器本地存储不可用或空间不足，请检查后重试。' }))
      return false
    }
  }, [])

  /** 更换动作时重置标定和演示实时值，防止毫米、角度等不同量纲的数据混用。 */
  const saveAttributes = useCallback((id: string, values: MotorAttributes): boolean => {
    const current = motorsRef.current.find((motor) => motor.id === id)
    if (!current || !validAttributes(values)) return false
    const attributes = { name: values.name.trim(), actionType: values.actionType, driverId: values.driverId, encoderId: values.encoderId }
    const next = current.actionType === values.actionType
      ? { ...current, ...attributes }
      : { ...createMotor(attributes), id }
    return commit(motorsRef.current.map((motor) => motor.id === id ? next : motor))
  }, [commit])

  /** 只保存当前动作允许的参数字段，状态中的对象不引用表单的可变值。 */
  const saveParameters = useCallback((id: string, values: MotorParameters): boolean => {
    const current = motorsRef.current.find((motor) => motor.id === id)
    if (!current || !validParameters(values, current.actionType)) return false
    const parameters: MotorParameters = {
      positiveTarget: values.positiveTarget,
      negativeTarget: values.negativeTarget,
      upperPosition: values.upperPosition,
      lowerPosition: values.lowerPosition,
      upperEncoder: values.upperEncoder,
      lowerEncoder: values.lowerEncoder,
      ...(getMotorAction(current.actionType).hasPullWireEncoder ? { pullWireEncoder: values.pullWireEncoder } : {}),
      ...(getMotorAction(current.actionType).hasTargetEncoder ? { targetEncoder: values.targetEncoder } : {}),
    }
    // 模拟读数随新标定范围收敛到有效边界，保存后立即测试不会发生越界跳变。
    const currentEncoder = Math.max(parameters.lowerEncoder, Math.min(parameters.upperEncoder, current.currentEncoder))
    return commit(motorsRef.current.map((motor) => motor.id === id ? { ...motor, parameters, currentEncoder } : motor))
  }, [commit])

  /** 新增记录与属性编辑使用相同校验；只有持久化成功后才把新记录交给页面定位。 */
  const addMotor = useCallback((values: MotorAttributes): AxisMotor | null => {
    if (!validAttributes(values)) return null
    const motor = createMotor(values)
    return commit([...motorsRef.current, motor]) ? motor : null
  }, [commit])

  return { motors: state.motors, storageWarning: state.storageWarning, saveAttributes, saveParameters, addMotor }
}
