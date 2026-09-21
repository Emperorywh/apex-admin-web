import { Button, Col, Divider, Flex, Form, Input, InputNumber, Row, Select, Typography } from 'antd'
import { Save } from 'lucide-react'
import { emptyLocation, getStorageStation, normalizeLocationName, storageLocationData } from '../storageLocation.model'
import type { StorageLocation, StorageLocationValues } from '../storageLocation.types'
import styles from '@/pages/storage-location/StorageLocationManagement/StorageLocationManagement.module.css'

/** 编辑器只维护未提交草稿；切换记录或保存后由父级 key 重建，避免表单串值。 */
interface StorageLocationEditorProps {
  record?: StorageLocation
  records: StorageLocation[]
  onSave: (values: StorageLocationValues) => void
  onDirty: () => void
  onReset: () => void
}

/** 基础信息与参数分区排列；站点变化清空关联点，所有字段校验通过后才允许保存。 */
export function StorageLocationEditor({ record, records, onSave, onDirty, onReset }: StorageLocationEditorProps) {
  const [form] = Form.useForm<StorageLocationValues>()
  const stationId = Form.useWatch('stationId', form)
  const station = getStorageStation(stationId)

  return <Form<StorageLocationValues> form={form} layout="vertical" initialValues={record ?? emptyLocation} onFinish={onSave} onValuesChange={onDirty} className={styles.form}>
    <Row gutter={[20, 0]}>
      <Col xs={24} md={8}>
        <Form.Item name="name" label="库位名称" rules={[
          { required: true, whitespace: true, message: '请输入库位名称' },
          { max: 40, message: '库位名称不能超过 40 个字符' },
          { validator: (_, value: string | undefined) => !value || !records.some((item) => item.id !== record?.id && normalizeLocationName(item.name) === normalizeLocationName(value)) ? Promise.resolve() : Promise.reject(new Error('该库位名称已存在，请更换名称')) },
        ]}>
          <Input placeholder="请输入库位名称" maxLength={40} allowClear />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item name="stationId" label="站点名称" rules={[{ required: true, message: '请选择站点' }]}>
          <Select placeholder="请选择站点" showSearch optionFilterProp="label" options={storageLocationData.stations.map((item) => ({ label: item.name, value: item.id }))} onChange={() => form.setFieldValue('pointId', undefined)} />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item name="pointId" label="关联点" dependencies={['stationId']} rules={[
          { required: true, message: '请选择关联点' },
          { validator: (_, value: string | undefined) => !value || getStorageStation(form.getFieldValue('stationId'))?.points.some((point) => point.id === value) ? Promise.resolve() : Promise.reject(new Error('请选择当前站点下的关联点')) },
        ]}>
          <Select placeholder={station ? '请选择关联点' : '请先选择站点'} disabled={!station} showSearch optionFilterProp="label" options={station?.points.map((point) => ({ label: point.name, value: point.id })) ?? []} />
        </Form.Item>
      </Col>
    </Row>
    <Divider className={styles.divider} />
    <Flex align="center" gap={10} wrap className={styles.parameterHeading}>
      <Typography.Text strong>库位参数设置</Typography.Text>
      <Typography.Text type="secondary" className={styles.hint}>配置存储空间与载荷限制</Typography.Text>
    </Flex>
    {/* 数值约束与单位直接展示在字段内；层号、尺寸为整数，承重允许一位小数。 */}
    <Row gutter={[20, 0]}>
      <Col xs={12} lg={6}><Form.Item name="layer" label="所在层" rules={[{ required: true, type: 'integer', min: 1, max: 100, message: '请输入 1–100 的整数' }]}><InputNumber className={styles.numberInput} min={1} max={100} precision={0} suffix="层" /></Form.Item></Col>
      <Col xs={12} lg={6}><Form.Item name="depth" label="库位深度" rules={[{ required: true, type: 'integer', min: 1, max: 10000, message: '请输入 1–10000 mm 的整数' }]}><InputNumber className={styles.numberInput} min={1} max={10000} precision={0} step={100} suffix="mm" /></Form.Item></Col>
      <Col xs={12} lg={6}><Form.Item name="height" label="库位高度" rules={[{ required: true, type: 'integer', min: 1, max: 10000, message: '请输入 1–10000 mm 的整数' }]}><InputNumber className={styles.numberInput} min={1} max={10000} precision={0} step={100} suffix="mm" /></Form.Item></Col>
      <Col xs={12} lg={6}><Form.Item name="maxLoad" label="最大承重" rules={[{ required: true, type: 'number', min: 0.1, max: 5000, message: '请输入 0.1–5000 kg' }]}><InputNumber className={styles.numberInput} min={0.1} max={5000} precision={1} step={50} suffix="kg" /></Form.Item></Col>
    </Row>
    <Form.Item name="remark" label="备注" rules={[{ max: 200, message: '备注不能超过 200 个字符' }]}><Input.TextArea placeholder="可填写存储要求或作业注意事项（选填）" rows={2} maxLength={200} showCount /></Form.Item>
    <Flex justify="end" gap={8} className={styles.formActions}>
      <Button onClick={onReset}>重置</Button>
      <Button type="primary" htmlType="submit" icon={<Save size={15} />}>保存参数</Button>
    </Flex>
  </Form>
}
