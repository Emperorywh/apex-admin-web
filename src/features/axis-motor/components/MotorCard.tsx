import { useEffect, useRef, useState } from 'react'
import { App, Badge, Button, Card, Col, Divider, Flex, Form, InputNumber, Row, Space, Tag, Typography } from 'antd'
import { MotorAttributesFields } from '@/features/axis-motor/components/MotorAttributesFields'
import { getMotorAction } from '@/features/axis-motor/axisMotor.model'
import type { AxisMotor, MotorAttributes, MotorParameters } from '@/features/axis-motor/axisMotor.types'
import { usePageActive } from '@/hooks/usePageActive'
import styles from '@/pages/axis-motor/AxisMotorManagement/AxisMotorManagement.module.css'

/** 单台电机独立保存属性与参数；测试只改变本卡片的模拟读数，不发送硬件指令。 */
interface MotorCardProps {
  motor: AxisMotor
  /** 筛选只隐藏卡片以保留编辑草稿；隐藏期间必须暂停模拟测试。 */
  visible: boolean
  onSaveAttributes: (id: string, values: MotorAttributes) => boolean
  onSaveParameters: (id: string, values: MotorParameters) => boolean
  onAdd: (actionType: string) => void
}

/** 参数区按动作类型使用高度、长度或角度；上、下标定点必须保持严格递增。 */
export function MotorCard({ motor, visible, onSaveAttributes, onSaveParameters, onAdd }: MotorCardProps) {
  const { message } = App.useApp()
  const { isActive } = usePageActive()
  const [attributesForm] = Form.useForm<MotorAttributes>()
  const [parametersForm] = Form.useForm<MotorParameters>()
  const [attributesDirty, setAttributesDirty] = useState(false)
  const [parametersDirty, setParametersDirty] = useState(false)
  const [direction, setDirection] = useState<-1 | 0 | 1>(0)
  const [encoder, setEncoder] = useState(motor.currentEncoder)
  const encoderRef = useRef(encoder)
  const syncedAttributes = useRef<MotorAttributes>(motor)
  const syncedParameters = useRef(motor.parameters)
  const action = getMotorAction(motor.actionType)
  const { upperEncoder, lowerEncoder, upperPosition, lowerPosition, positiveTarget, negativeTarget, targetEncoder } = motor.parameters
  // 位置目标按两点标定换算为编码器读数；伸缩动作使用显式配置的编码器目标。
  const toEncoder = (position: number) => Math.round(lowerEncoder + (position - lowerPosition) / (upperPosition - lowerPosition) * (upperEncoder - lowerEncoder))
  const positiveEncoder = action.hasTargetEncoder ? targetEncoder! : toEncoder(positiveTarget)
  const negativeEncoder = toEncoder(negativeTarget)
  const atUpperLimit = encoder >= upperEncoder
  const atLowerLimit = encoder <= lowerEncoder

  // 只在已保存源真正改变时回填；Activity 恢复会重建 Effect，需保留未提交的草稿。
  useEffect(() => {
    const previous = syncedAttributes.current
    if (previous.name === motor.name && previous.actionType === motor.actionType && previous.driverId === motor.driverId && previous.encoderId === motor.encoderId) return
    syncedAttributes.current = { name: motor.name, actionType: motor.actionType, driverId: motor.driverId, encoderId: motor.encoderId }
    attributesForm.setFieldsValue({ name: motor.name, actionType: motor.actionType, driverId: motor.driverId, encoderId: motor.encoderId })
    setAttributesDirty(false)
  }, [attributesForm, motor.name, motor.actionType, motor.driverId, motor.encoderId])

  useEffect(() => {
    if (syncedParameters.current === motor.parameters) return
    syncedParameters.current = motor.parameters
    parametersForm.resetFields()
    parametersForm.setFieldsValue(motor.parameters)
    setParametersDirty(false)
    setDirection(0)
    encoderRef.current = motor.currentEncoder
    setEncoder(motor.currentEncoder)
  }, [parametersForm, motor.parameters, motor.currentEncoder])

  // 每 100ms 推进一次模拟编码器；到达已保存目标自动停止。离开页面或卸载时清理计时器。
  useEffect(() => {
    if (!direction || !isActive || !visible) return
    const step = Math.max(1, Math.ceil((upperEncoder - lowerEncoder) / 40))
    const timer = window.setInterval(() => {
      const target = direction === 1 ? positiveEncoder : negativeEncoder
      const next = direction === 1 ? Math.min(target, encoderRef.current + step) : Math.max(target, encoderRef.current - step)
      encoderRef.current = next
      setEncoder(next)
      if (next === target) setDirection(0)
    }, 100)
    return () => {
      window.clearInterval(timer)
      setDirection(0)
    }
  }, [direction, isActive, visible, lowerEncoder, upperEncoder, positiveEncoder, negativeEncoder])

  /** 仅使用已保存配置测试；编辑期间禁用启动，停止按钮始终可用。 */
  const startTest = (nextDirection: -1 | 1) => {
    if (attributesDirty || parametersDirty || direction !== 0 || !isActive || !visible) return
    setDirection(nextDirection)
  }

  const saveAttributes = (values: MotorAttributes) => {
    if (onSaveAttributes(motor.id, values)) {
      attributesForm.setFieldsValue({ ...values, name: values.name.trim() })
      setAttributesDirty(false)
      void message.success('轴属性已保存到本地')
    } else {
      void message.error('轴属性保存失败，请检查输入和本地存储状态')
    }
  }

  const saveParameters = (values: MotorParameters) => {
    if (onSaveParameters(motor.id, values)) {
      setParametersDirty(false)
      void message.success('电机参数已保存到本地')
    } else {
      void message.error('参数保存失败，请检查输入和本地存储状态')
    }
  }

  return (
    <Card
      size="small"
      className={styles.motorCard}
      aria-label={`${motor.name}配置`}
      title={<Space size={8}><Typography.Text strong>{motor.name}</Typography.Text><Tag color="cyan">轴 {action.axisNumber}</Tag></Space>}
      extra={<Badge status={direction ? 'processing' : 'default'} text={direction ? `${direction === 1 ? action.positiveLabel : action.negativeLabel}中` : '已停止'} />}
    >
      <Form<MotorAttributes>
        form={attributesForm}
        name={`attributes-${motor.id}`}
        layout="vertical"
        size="small"
        requiredMark={false}
        initialValues={motor}
        disabled={direction !== 0}
        onValuesChange={() => setAttributesDirty(true)}
        onFinish={saveAttributes}
        className={styles.compactForm}
      >
        <MotorAttributesFields form={attributesForm} />
        <Flex justify="space-between" align="center" gap={8} wrap>
          <Typography.Text type="secondary" className={styles.hint}>{attributesDirty ? '属性有未保存的修改' : '轴编号根据动作类型自动匹配'}</Typography.Text>
          <Button htmlType="submit" size="small">保存轴属性</Button>
        </Flex>
      </Form>

      <Divider className={styles.sectionDivider} />

      <Form<MotorParameters>
        form={parametersForm}
        name={`parameters-${motor.id}`}
        layout="vertical"
        size="small"
        requiredMark={false}
        initialValues={motor.parameters}
        disabled={direction !== 0}
        onValuesChange={() => setParametersDirty(true)}
        onFinish={saveParameters}
        className={styles.compactForm}
      >
        <Typography.Title level={5} className={styles.sectionTitle}>轴电机控制参数</Typography.Title>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="positiveTarget" label={`${action.positiveLabel}目标`} dependencies={['negativeTarget', 'upperPosition', 'lowerPosition', 'upperEncoder', 'lowerEncoder']} rules={[
              { required: true, message: '请输入正向目标' },
              ({ getFieldValue }) => ({ validator: (_, value) => value == null || (value > getFieldValue('negativeTarget') && value <= getFieldValue('upperPosition') && value >= getFieldValue('lowerPosition')) ? Promise.resolve() : Promise.reject(new Error('目标需在标定范围内且大于反向目标')) }),
              ({ getFieldValue }) => ({ validator: (_, value) => {
                // 编码器只能记录整数，两个不同的位置目标仍需能区分为至少一个计数。
                if (value == null || action.hasTargetEncoder) return Promise.resolve()
                const lower = getFieldValue('lowerEncoder')
                const scale = (getFieldValue('upperEncoder') - lower) / (getFieldValue('upperPosition') - getFieldValue('lowerPosition'))
                const positive = Math.round(lower + (value - getFieldValue('lowerPosition')) * scale)
                const negative = Math.round(lower + (getFieldValue('negativeTarget') - getFieldValue('lowerPosition')) * scale)
                return positive > negative ? Promise.resolve() : Promise.reject(new Error('目标间距小于编码器分辨率'))
              } }),
            ]}>
              <InputNumber min={0} max={1000000} precision={2} suffix={action.unit} className={styles.numberInput} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="negativeTarget" label={`${action.negativeLabel}目标`} dependencies={['upperPosition', 'lowerPosition']} rules={[
              { required: true, message: '请输入反向目标' },
              ({ getFieldValue }) => ({ validator: (_, value) => value == null || (value >= getFieldValue('lowerPosition') && value <= getFieldValue('upperPosition')) ? Promise.resolve() : Promise.reject(new Error('目标需在标定范围内')) }),
            ]}>
              <InputNumber min={0} max={1000000} precision={2} suffix={action.unit} className={styles.numberInput} />
            </Form.Item>
          </Col>
          {action.hasPullWireEncoder && <Col span={12}>
            <Form.Item name="pullWireEncoder" label="拉线编码器值" preserve={false} rules={[{ required: true, message: '请输入拉线编码器值' }]}>
              <InputNumber min={0} max={2147483647} precision={0} className={styles.numberInput} />
            </Form.Item>
          </Col>}
          {action.hasTargetEncoder && <Col span={12}>
            <Form.Item name="targetEncoder" label="编码器值" preserve={false} dependencies={['lowerEncoder', 'upperEncoder', 'negativeTarget', 'lowerPosition', 'upperPosition']} rules={[
              { required: true, message: '请输入编码器值' },
              ({ getFieldValue }) => ({ validator: (_, value) => value == null || (value >= getFieldValue('lowerEncoder') && value <= getFieldValue('upperEncoder')) ? Promise.resolve() : Promise.reject(new Error('编码器值需在标定范围内')) }),
              ({ getFieldValue }) => ({ validator: (_, value) => {
                // 伸缩的正向编码器设定也必须高于回缩位置换算值，避免两个方向同时不可启动。
                const lower = getFieldValue('lowerEncoder')
                const reverseTarget = Math.round(lower + (getFieldValue('negativeTarget') - getFieldValue('lowerPosition')) / (getFieldValue('upperPosition') - getFieldValue('lowerPosition')) * (getFieldValue('upperEncoder') - lower))
                return value == null || value > reverseTarget ? Promise.resolve() : Promise.reject(new Error('编码器值必须大于回缩目标对应的读数'))
              } }),
            ]}>
              <InputNumber min={0} max={2147483647} precision={0} className={styles.numberInput} />
            </Form.Item>
          </Col>}
        </Row>

        <Typography.Title level={5} className={styles.sectionTitle}>轴电机标定参数</Typography.Title>
        {/* 位置边界和对应编码器标定值按上、下限成行展示，避免与控制目标混淆。 */}
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="upperPosition" label={`${action.positionLabel}上限`} dependencies={['lowerPosition']} rules={[
              { required: true, message: '请输入位置上限' },
              ({ getFieldValue }) => ({ validator: (_, value) => value == null || value > getFieldValue('lowerPosition') ? Promise.resolve() : Promise.reject(new Error('上限必须大于下限')) }),
            ]}>
              <InputNumber min={0} max={1000000} precision={2} suffix={action.unit} className={styles.numberInput} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="upperEncoder" label="上限编码器标定值" dependencies={['lowerEncoder']} rules={[
              { required: true, message: '请输入上限标定值' },
              ({ getFieldValue }) => ({ validator: (_, value) => value == null || value > getFieldValue('lowerEncoder') ? Promise.resolve() : Promise.reject(new Error('上限标定值必须大于下限')) }),
            ]}>
              <InputNumber min={0} max={2147483647} precision={0} className={styles.numberInput} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="lowerPosition" label={`${action.positionLabel}下限`} rules={[{ required: true, message: '请输入位置下限' }]}>
              <InputNumber min={0} max={1000000} precision={2} suffix={action.unit} className={styles.numberInput} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="lowerEncoder" label="下限编码器标定值" rules={[{ required: true, message: '请输入下限标定值' }]}>
              <InputNumber min={0} max={2147483647} precision={0} className={styles.numberInput} />
            </Form.Item>
          </Col>
        </Row>

        <Flex className={styles.telemetry} gap={8} align="center" justify="space-between" wrap>
          <Space size={8}>
            <Typography.Text type="secondary">编码器实时值</Typography.Text>
            <Typography.Text className={styles.encoderValue}>{encoder.toLocaleString()}</Typography.Text>
            <Tag>模拟</Tag>
          </Space>
          {action.hasLimitSwitches && <Space size={12} wrap>
            <Badge status={atUpperLimit ? 'warning' : 'default'} text={`上限位 IO · ${atUpperLimit ? '已触发' : '未触发'}`} />
            <Badge status={atLowerLimit ? 'warning' : 'default'} text={`下限位 IO · ${atLowerLimit ? '已触发' : '未触发'}`} />
          </Space>}
        </Flex>

        <Flex className={styles.testActions} gap={8} wrap>
          <Button type="primary" htmlType="submit" size="small">参数保存</Button>
          <Button size="small" disabled={direction !== 0 || attributesDirty || parametersDirty || encoder >= positiveEncoder} onClick={() => startTest(1)}>{action.positiveLabel}测试</Button>
          <Button size="small" disabled={direction !== 0 || attributesDirty || parametersDirty || encoder <= negativeEncoder} onClick={() => startTest(-1)}>{action.negativeLabel}测试</Button>
          <Button size="small" danger disabled={false} onClick={() => setDirection(0)}>停止</Button>
        </Flex>
        {parametersDirty && <Typography.Text type="warning" className={styles.hint}>参数有未保存的修改，保存后可测试</Typography.Text>}
      </Form>

      <Divider className={styles.footerDivider} />
      <Button type="dashed" size="small" block onClick={() => onAdd(motor.actionType)}>新增轴电机</Button>
    </Card>
  )
}
