import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { App, Badge, Button, Col, DatePicker, Dropdown, Empty, Flex, Form, Input, Row, Select, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { ArrowRight, Ellipsis, Plus, RotateCcw, Search } from 'lucide-react'
import { ROUTE_PATHS } from '@/router/definitions'
import { initialCombinations, robotTypeOptions, sceneOptions } from '@/features/action/action.model'
import type { ActionCombination } from '@/features/action/action.model'
import styles from './ActionOrchestration.module.css'

/** 查询表单草稿与已提交条件独立；仅点击查询或回车时更新结果，日期范围包含起止整天。 */
interface ActionQuery {
  keyword?: string
  scene?: string
  robotType?: string
  enabled?: boolean
  updatedRange?: [Dayjs, Dayjs] | null
}

/** 全屏编辑会卸载列表，访问期快照保留启停及已删除条目；刷新才重新建立预制列表。 */
let visitRecords = structuredClone(initialCombinations)

/** 列表展示当前预制组合，不读取或合并编辑器的浏览器草稿。 */
export default function ActionOrchestration() {
  // 状态、表头和枚举标签随当前语言重新计算，不翻译用户维护的名称及目标。
  const { t } = useTranslation('action')
  /** 状态颜色配合文字展示，停用组合保留配置以便重新启用。 */
  const renderStatus = (enabled: boolean) => <Badge status={enabled ? 'success' : 'default'} text={enabled ? t('已启用') : t('已停用')} />

  const { message, modal } = App.useApp()
  const [form] = Form.useForm<ActionQuery>()
  const [records, setRecords] = useState(() => visitRecords)
  const [query, setQuery] = useState<ActionQuery>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const navigate = useNavigate()
  // 列表快照仅保留访问期的启停与删除操作，不接收或保存编辑页中的流程。
  useEffect(() => { visitRecords = records }, [records])

  /** 新增进入工作流编辑页；编辑通过查询参数携带预制记录标识，不读取浏览器草稿。 */
  const openEditor = (id?: string) => {
    void navigate({ pathname: ROUTE_PATHS['action-orchestration-edit'], search: id ? `?${new URLSearchParams({ id })}` : '' })
  }

  /** 多项条件取交集；显式比较布尔值，使“已停用”不会被误当作未筛选。 */
  const keyword = query.keyword?.trim().toLowerCase() ?? ''
  const filtered = records.filter((record) =>
    `${record.code} ${record.name}`.toLowerCase().includes(keyword)
    && (!query.scene || record.scene === query.scene)
    && (!query.robotType || record.robotType === query.robotType)
    && (query.enabled === undefined || record.enabled === query.enabled)
    && (!query.updatedRange || (dayjs(record.updatedAt).valueOf() >= query.updatedRange[0].startOf('day').valueOf() && dayjs(record.updatedAt).valueOf() <= query.updatedRange[1].endOf('day').valueOf())),
  )
  // 删除或停用操作可能缩短筛选结果，渲染时将当前页限制在有效范围，避免出现空白尾页。
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  const hasQuery = Boolean(keyword || query.scene || query.robotType || query.enabled !== undefined || query.updatedRange)

  /** 重置同时清除输入和已提交条件，并返回第一页。 */
  const resetQuery = () => { form.resetFields(); setQuery({}); setPage(1) }

  /** 启停与删除均确认具体组合；操作只维护模板状态，不触发机器人运行。 */
  const changeStatus = (record: ActionCombination) => modal.confirm({
    title: record.enabled ? t('停用动作组合') : t('启用动作组合'), content: record.enabled ? t('确定停用“{{name}}”吗？', { name: record.name }) : t('确定启用“{{name}}”吗？', { name: record.name }), okText: record.enabled ? t('停用') : t('启用'), cancelText: t('取消'),
    onOk: () => {
      setRecords((current) => current.map((item) => item.id === record.id ? { ...item, enabled: !item.enabled, updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') } : item))
      setPage(1)
      void message.success(record.enabled ? t('动作组合已停用') : t('动作组合已启用'))
    },
  })
  const deleteCombination = (record: ActionCombination) => modal.confirm({
    title: t('删除动作组合'), content: t('确定删除“{{name}}”（{{code}}）吗？删除后无法撤销。', { name: record.name, code: record.code }), okText: t('删除'), cancelText: t('取消'), okButtonProps: { danger: true },
    onOk: () => {
      // 删除只修改当前访问的列表状态，不操作浏览器存储。
      setRecords((current) => current.filter((item) => item.id !== record.id))
      setPage(currentPage)
      void message.success(t('动作组合已删除'))
    },
  })

  /** 组合名称仅展示文本；编辑按钮常驻操作列，启停和删除保留在更多菜单中。 */
  const columns: TableColumnsType<ActionCombination> = [
    { title: t('序号'), key: 'index', width: 58, render: (_value, _record, index) => <Typography.Text type="secondary">{String((currentPage - 1) * pageSize + index + 1).padStart(2, '0')}</Typography.Text> },
    { title: t('动作组合'), dataIndex: 'name', width: 215, render: (_value, record) => <Flex vertical gap={4}><Typography.Text>{record.name}</Typography.Text><Typography.Text type="secondary" className={styles.code}>{record.code}</Typography.Text></Flex> },
    { title: t('业务场景'), dataIndex: 'scene', width: 104, render: (scene: string) => <Tag className={styles.sceneTag}>{t(scene)}</Tag> },
    { title: t('AGV 类型'), dataIndex: 'robotType', width: 150, render: (value: string) => t(value) },
    // 分支工作流的节点列表仅用于摘要，具体执行路径由编辑器内的连线决定。
    { title: t('动作摘要'), key: 'steps', width: 286, render: (_value, record) => <Flex vertical gap={5}><Flex align="center" gap={5} className={styles.sequence}>{record.steps.slice(0, 3).map((step, index) => <span className={styles.sequenceItem} key={index}>{index > 0 && <ArrowRight size={11} aria-hidden="true" />}<span>{t(step.action)}</span></span>)}{record.steps.length > 3 && <Typography.Text type="secondary">…</Typography.Text>}</Flex><Typography.Text type="secondary" className={styles.hint}>{t('共 {{count}} 个执行步骤', { count: record.steps.length })}</Typography.Text></Flex> },
    { title: t('状态'), dataIndex: 'enabled', width: 94, render: renderStatus },
    { title: t('更新时间'), dataIndex: 'updatedAt', width: 164, sorter: (a, b) => a.updatedAt.localeCompare(b.updatedAt), render: (value: string) => <span className={styles.timestamp}>{value}</span> },
    {
      // 加宽固定操作列，确保中英文编辑按钮与更多菜单均能完整展示。
      title: t('操作'), key: 'actions', width: 140, fixed: 'right',
      render: (_value, record) => <Flex align="center" gap={4}>
        <Button size="small" type="link" onClick={() => openEditor(record.id)}>{t('编辑组合')}</Button>
        <Dropdown trigger={['click']} menu={{ items: [{ key: 'status', label: record.enabled ? t('停用组合') : t('启用组合') }, { type: 'divider' }, { key: 'delete', label: t('删除组合'), danger: true }], onClick: ({ key }) => { if (key === 'status') changeStatus(record); if (key === 'delete') deleteCombination(record) } }}>
          <Button size="small" type="text" icon={<Ellipsis size={17} />} aria-label={t('{{name}}的更多操作', { name: record.name })} />
        </Dropdown>
      </Flex>,
    },
  ]

  return <Flex vertical gap={18} className={styles.page}>
    {/* 桌面每行四个查询项，平板两列、手机单列；标签右对齐靠近控件，新增入口紧随重置。 */}
    <section className={styles.queryPanel} aria-label={t('条件查询')}>
      <Form<ActionQuery> name="action-query" form={form} layout="horizontal" labelAlign="right" className={styles.queryForm} onFinish={(values) => { setQuery(values); setPage(1) }}>
        <Row gutter={[24, 0]}>
          <Col xs={24} md={12} xl={6}><Form.Item label={t('组合名称 / 编码')} name="keyword"><Input allowClear placeholder={t('请输入组合名称或编码')} prefix={<Search size={14} />} /></Form.Item></Col>
          <Col xs={24} md={12} xl={6}><Form.Item label={t('业务场景')} name="scene"><Select allowClear placeholder={t('全部场景')} options={sceneOptions.map((option) => ({ ...option, label: t(option.label) }))} /></Form.Item></Col>
          <Col xs={24} md={12} xl={6}><Form.Item label={t('AGV 类型')} name="robotType"><Select allowClear placeholder={t('全部类型')} options={robotTypeOptions.map((option) => ({ ...option, label: t(option.label) }))} /></Form.Item></Col>
          <Col xs={24} md={12} xl={6}><Form.Item label={t('启用状态')} name="enabled"><Select allowClear placeholder={t('全部状态')} options={[{ label: t('已启用'), value: true }, { label: t('已停用'), value: false }]} /></Form.Item></Col>
          <Col xs={24} md={12} xl={6}><Form.Item label={t('更新时间')} name="updatedRange"><DatePicker.RangePicker className={styles.dateRange} placeholder={[t('开始日期'), t('结束日期')]} /></Form.Item></Col>
          <Col xs={24} md={12} xl={18}><Flex justify="end" wrap gap={8} className={styles.queryActions}><Button type="primary" htmlType="submit" icon={<Search size={14} />}>{t('查询')}</Button><Button icon={<RotateCcw size={14} />} onClick={resetQuery}>{t('重置')}</Button><Button type="primary" icon={<Plus size={16} />} onClick={() => openEditor()}>{t('新增动作组合')}</Button></Flex></Col>
        </Row>
      </Form>
    </section>
    <section aria-label={t('动作组合列表')} className={styles.list}>
      <Table<ActionCombination> rowKey="id" bordered size="small" className={styles.table} columns={columns} dataSource={filtered} scroll={{ x: 1311 }} pagination={{ current: currentPage, pageSize, showSizeChanger: true, pageSizeOptions: [5, 10, 20, 50], showTotal: (total) => t('共 {{count}} 条', { count: total }), onChange: (nextPage, nextSize) => { setPage(nextSize === pageSize ? nextPage : 1); setPageSize(nextSize) } }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={hasQuery ? t('没有符合条件的动作组合') : t('暂无动作组合')}><Button onClick={hasQuery ? resetQuery : () => openEditor()}>{hasQuery ? t('重置查询条件') : t('新增动作组合')}</Button></Empty> }} />
    </section>
    <Typography.Text type="secondary" className={styles.dataNote}>{t('编辑内容离开页面后不保留，列表启停与删除仅本次访问有效')}</Typography.Text>
  </Flex>
}
