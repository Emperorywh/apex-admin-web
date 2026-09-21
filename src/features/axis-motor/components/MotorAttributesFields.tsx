import { Col, Form, Input, Row, Select } from 'antd'
import type { FormInstance } from 'antd'
import { axisMotorData, getMotorAction } from '../axisMotor.model'
import type { MotorAttributes } from '../axisMotor.types'

/** 属性字段共用父级表单实例，使卡片编辑与新增弹窗保持相同的字段约束。 */
interface MotorAttributesFieldsProps {
  form: FormInstance<MotorAttributes>
}

/** 轴编号仅由动作类型派生，不写入表单；硬件选项统一读取本地 JSON 中的目录。 */
export function MotorAttributesFields({ form }: MotorAttributesFieldsProps) {
  const actionType = Form.useWatch<MotorAttributes['actionType']>('actionType', form)
  const action = actionType ? getMotorAction(actionType) : undefined

  return (
    // 宽表单使用两列；共享容器查询在卡片或弹窗过窄时将字段改为单列水平排列。
    <Row gutter={16}>
      <Col xs={24} sm={12}>
        <Form.Item
          name="name"
          label="轴动作名称"
          rules={[
            { required: true, whitespace: true, message: '请输入轴动作名称' },
            { max: 40, message: '轴动作名称最多 40 个字符' },
          ]}
        >
          <Input placeholder="请输入轴动作名称" maxLength={40} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="actionType" label="动作类型" tooltip="更换动作类型并保存后，控制与标定参数将按新动作重新初始化。" rules={[{ required: true, message: '请选择动作类型' }]}>
          <Select
            placeholder="请选择动作类型"
            options={axisMotorData.actions.map((item) => ({ value: item.id, label: item.label }))}
          />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item label="轴所属编号" tooltip="根据所选动作类型自动关联，无需手动输入。">
          <Input aria-label="轴所属编号" value={action?.axisNumber ?? ''} readOnly placeholder="选择动作后自动显示" />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="driverId" label="轴驱动器" rules={[{ required: true, message: '请选择轴驱动器' }]}>
          <Select placeholder="请选择轴驱动器" options={axisMotorData.drivers} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="encoderId" label="轴编码器" rules={[{ required: true, message: '请选择轴编码器' }]}>
          <Select placeholder="请选择轴编码器" options={axisMotorData.encoders} />
        </Form.Item>
      </Col>
    </Row>
  )
}
