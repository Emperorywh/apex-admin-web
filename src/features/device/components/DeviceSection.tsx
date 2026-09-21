import { useState } from 'react'
import type { ReactNode } from 'react'
import { App, Button, Empty, Flex, Form, Modal, Popconfirm, Space, Table, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { Plus } from 'lucide-react'
import type { DeviceRecord } from '../device.types'
import styles from '@/pages/device/DeviceManagement/DeviceManagement.module.css'

/** 每组设备独立维护列表与编辑草稿并使用统一全宽布局；字段及列由业务页面传入，保存不调用接口。 */
interface DeviceSectionProps<T extends DeviceRecord> {
  title: string
  deviceLabel: string
  initialRecords: T[]
  defaults: Omit<T, 'id'>
  columns: TableColumnsType<T>
  fields: ReactNode
  scrollWidth: number
  getName: (record: T) => string
}

/** 统一三组表格的新增、修改、删除流程；弹窗仅在打开时挂载，取消即丢弃草稿。 */
export function DeviceSection<T extends DeviceRecord>({ title, deviceLabel, initialRecords, defaults, columns, fields, scrollWidth, getName }: DeviceSectionProps<T>) {
  const { message } = App.useApp()
  const [records, setRecords] = useState<T[]>(() => structuredClone(initialRecords))
  const [editor, setEditor] = useState<{ record: T | null } | null>(null)

  /** 必填、长度及数字规则通过后才提交；稳定 ID 确保删除其他行不会影响编辑目标。 */
  const saveRecord = (values: T) => {
    const id = editor?.record?.id
    // 提交时统一裁掉文本首尾空白，输入过程中保留空格，支持“DI 1信号”等名称。
    const normalized = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])) as T
    const saved = { ...normalized, id: id ?? crypto.randomUUID() }
    setRecords((current) => id ? current.map((record) => record.id === id ? saved : record) : [...current, saved])
    setEditor(null)
    void message.success(`${deviceLabel}已${id ? '修改' : '新增'}`)
  }

  /** 删除只影响当前组，用户取消确认时保持数据不变。 */
  const deleteRecord = (record: T) => {
    setRecords((current) => current.filter((item) => item.id !== record.id))
    void message.success(`${getName(record)}已删除`)
  }

  const tableColumns: TableColumnsType<T> = [
    { title: '序号', key: 'index', width: 64, render: (_value, _record, index) => <Typography.Text type="secondary">{index + 1}</Typography.Text> },
    ...columns,
    {
      title: '操作', key: 'actions', width: 116, fixed: 'right',
      render: (_value, record) => (
        <Space size={12}>
          <Button className={styles.rowAction} type="link" size="small" aria-label={`修改${getName(record)}`} onClick={() => setEditor({ record })}>修改</Button>
          <Popconfirm title={`删除${deviceLabel}`} description={`确定删除“${getName(record)}”吗？`} okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => deleteRecord(record)}>
            <Button className={styles.rowAction} type="link" danger size="small" aria-label={`删除${getName(record)}`}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <section className={styles.section} aria-label={title}>
      <Flex className={styles.sectionHeader} align="center" justify="space-between" gap={12}>
        <Space size={10}>
          <Typography.Title level={2} className={styles.sectionTitle}>{title}</Typography.Title>
          <Typography.Text type="secondary" className={styles.count}>{records.length} 台</Typography.Text>
        </Space>
        <Button type="primary" icon={<Plus size={15} />} onClick={() => setEditor({ record: null })}>新增{deviceLabel}</Button>
      </Flex>
      <Table<T> className={styles.table} bordered size="small" rowKey="id" columns={tableColumns} dataSource={records} pagination={false} scroll={{ x: scrollWidth }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`暂无${deviceLabel}，点击右上角新增`} /> }} />
      {/* 条件挂载让每次新增或修改都使用独立初值，不残留上次取消的输入和校验提示。 */}
      {editor && <DeviceEditor<T> title={`${editor.record ? '修改' : '新增'}${deviceLabel}`} initialValues={editor.record ?? defaults} onSave={saveRecord} onCancel={() => setEditor(null)}>{fields}</DeviceEditor>}
    </section>
  )
}

/** 表单实例跟随弹窗组件创建与销毁，避免复用旧草稿或在严格模式清理时丢失默认值。 */
function DeviceEditor<T extends DeviceRecord>({ title, initialValues, onSave, onCancel, children }: {
  title: string
  initialValues: T | Omit<T, 'id'>
  onSave: (values: T) => void
  onCancel: () => void
  children: ReactNode
}) {
  const [form] = Form.useForm<T>()
  return <Modal title={title} open width={560} okText="保存" cancelText="取消" onCancel={onCancel} onOk={() => form.submit()}>
    <Form<T> form={form} layout="vertical" initialValues={initialValues} onFinish={onSave} className={styles.editor}>
      {children}
    </Form>
  </Modal>
}
