/** 轴属性由表单编辑，所属轴编号通过动作类型查询，避免手动输入后失去对应关系。 */
export interface MotorAttributes {
  name: string
  actionType: string
  driverId: number
  encoderId: number
}

/** 控制目标位于标定边界内；伸缩动作可设置目标编码器，抬升动作可记录拉线读数。 */
export interface MotorParameters {
  positiveTarget: number
  negativeTarget: number
  targetEncoder?: number
  upperPosition: number
  lowerPosition: number
  upperEncoder: number
  lowerEncoder: number
  pullWireEncoder?: number
}

/** 本地电机记录；实时编码器值是演示数据，不代表实际设备反馈。 */
export interface AxisMotor extends MotorAttributes {
  id: string
  parameters: MotorParameters
  currentEncoder: number
}

/** 动作定义统一提供树分类、轴编号、位置单位、测试按钮文字及可选传感器能力。 */
export interface MotorAction {
  id: string
  categoryId: string
  label: string
  axisNumber: number
  positionLabel: string
  unit: string
  positiveLabel: string
  negativeLabel: string
  hasLimitSwitches: boolean
  hasPullWireEncoder: boolean
  hasTargetEncoder: boolean
}

/** JSON 是动作目录、可选硬件及初始电机记录的唯一维护入口。 */
export interface AxisMotorData {
  categories: { id: string; label: string }[]
  actions: MotorAction[]
  drivers: { value: number; label: string }[]
  encoders: { value: number; label: string }[]
  motors: AxisMotor[]
}
