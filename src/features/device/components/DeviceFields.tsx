import { Col, Form, Input, InputNumber, Radio, Row, Select } from 'antd'
import styles from '@/pages/device/DeviceManagement/DeviceManagement.module.css'

/** 必填文本拒绝纯空格，长度与控件限制保持一致；首尾空白在保存时统一移除。 */
const requiredText = [{ required: true, whitespace: true, message: '请输入有效内容' }, { max: 40, message: '最多输入 40 个字符' }]

/** 告警为本地演示状态，使用布尔值保证表格与单选按钮的显示一致。 */
function AlarmField() {
  return <Form.Item name="alarm" label="设备状态" rules={[{ required: true, message: '请选择设备状态' }]}>
    <Radio.Group optionType="button" buttonStyle="solid" options={[{ value: false, label: '正常' }, { value: true, label: '告警' }]} />
  </Form.Item>
}

/** CAN 字段对应原型；执行器与编码器允许留空以支持电池记录，ID 仅要求非负整数。 */
export function CanDeviceFields() {
  return <Row gutter={16}>
    <Col span={24}><Form.Item name="model" label="电机类型" rules={requiredText}><Input maxLength={40} placeholder="例如：步科-XX / 中力电池-XXX" /></Form.Item></Col>
    <Col xs={24} sm={12}><Form.Item name="actuator" label="电机执行器"><Input maxLength={40} placeholder="电池可留空" /></Form.Item></Col>
    <Col xs={24} sm={12}><Form.Item name="encoder" label="电机编码器"><Input maxLength={40} placeholder="电池可留空" /></Form.Item></Col>
    <Col span={24}><Form.Item name="name" label="CAN 通讯设备名称" rules={requiredText}><Input maxLength={40} placeholder="例如：顶升电机" /></Form.Item></Col>
    <Col xs={24} sm={12}><Form.Item name="port" label="CAN 硬件接口" rules={requiredText}><Input maxLength={40} placeholder="例如：can1" /></Form.Item></Col>
    <Col xs={24} sm={12}><Form.Item name="canId" label="CAN 设备 ID" rules={[{ required: true, message: '请输入设备 ID' }, { type: 'integer', min: 0, max: Number.MAX_SAFE_INTEGER, message: '请输入有效的非负整数' }]}><InputNumber className={styles.numberInput} min={0} max={Number.MAX_SAFE_INTEGER} step={1} placeholder="例如：1" /></Form.Item></Col>
    <Col span={24}><AlarmField /></Col>
  </Row>
}

/** GPIO 类型、触发状态和有效电平分别编辑，不根据 NPN/PNP 自动推断业务状态。 */
export function GpioDeviceFields() {
  return <>
    <Form.Item name="type" label="GPIO 类型" rules={[{ required: true, message: '请选择 GPIO 类型' }]}><Select options={[{ value: 'NPN', label: 'NPN' }, { value: 'PNP', label: 'PNP' }]} /></Form.Item>
    <Form.Item name="name" label="GPIO 名称" rules={requiredText}><Input maxLength={40} placeholder="例如：DI 1信号" /></Form.Item>
    <Form.Item name="purpose" label="GPIO 功能" rules={requiredText}><Input maxLength={40} placeholder="例如：急停 / 充电继电器" /></Form.Item>
    <Form.Item name="triggered" label="GPIO 状态" rules={[{ required: true, message: '请选择 GPIO 状态' }]}><Radio.Group optionType="button" buttonStyle="solid" options={[{ value: true, label: '触发' }, { value: false, label: '未触发' }]} /></Form.Item>
    <Form.Item name="activeHigh" label="高低电平生效" rules={[{ required: true, message: '请选择有效电平' }]}><Radio.Group optionType="button" buttonStyle="solid" options={[{ value: true, label: '高电平' }, { value: false, label: '低电平' }]} /></Form.Item>
  </>
}

/** RS485 接口及设备名称可直接输入，预制数据不限制后续新增的灯光或语音设备。 */
export function SerialDeviceFields() {
  return <>
    <Form.Item name="port" label="RS485 硬件接口" rules={requiredText}><Input maxLength={40} placeholder="例如：RS485-1" /></Form.Item>
    <Form.Item name="name" label="名称" rules={requiredText}><Input maxLength={40} placeholder="例如：灯光 / 语音" /></Form.Item>
    <AlarmField />
  </>
}
