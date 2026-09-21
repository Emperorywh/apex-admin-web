import { useRef, useState } from 'react'
import { App, Badge, Button, Card, Empty, Flex, Input, Select, Space, Table, Tag, Tree, Typography } from 'antd'
import type { TableColumnsType, TreeDataNode } from 'antd'
import { ListTree, Plus } from 'lucide-react'
import { StorageLocationEditor } from '@/features/storage-location/components/StorageLocationEditor'
import { getStorageStation, storageLocationData } from '@/features/storage-location/storageLocation.model'
import type { StorageLocation, StorageLocationValues } from '@/features/storage-location/storageLocation.types'
import styles from './StorageLocationManagement.module.css'

/** 每页展示六条参数摘要，序号和保存后的页码定位使用相同容量。 */
const PAGE_SIZE = 6

/** 库位工作区：目录定位编辑对象，总览始终显示已保存记录，草稿不直接修改列表。 */
export default function StorageLocationManagement() {
  const { message, modal } = App.useApp()
  const [records, setRecords] = useState<StorageLocation[]>(() => structuredClone(storageLocationData.locations))
  const [selectedKey, setSelectedKey] = useState(storageLocationData.locations[0]?.id ?? 'new')
  const [editorRevision, setEditorRevision] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [stationFilter, setStationFilter] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const editorRef = useRef<HTMLDivElement>(null)
  const activeRecord = records.find((record) => record.id === selectedKey)
  const query = keyword.trim().toLocaleLowerCase()
  const visibleRecords = records.filter((record) => {
    const station = getStorageStation(record.stationId)
    const point = station?.points.find((item) => item.id === record.pointId)
    return (!stationFilter || stationFilter === record.stationId) && `${record.name} ${station?.name ?? ''} ${point?.name ?? ''}`.toLocaleLowerCase().includes(query)
  })

  /** 放弃草稿前提示；取消确认时保持当前记录、输入和目录选中态。 */
  const confirmDiscard = (action: () => void) => {
    if (!dirty) { action(); return }
    modal.confirm({ title: '放弃未保存的修改？', content: '当前库位参数尚未保存，继续操作将丢弃这些修改。', okText: '放弃修改', cancelText: '继续编辑', onOk: action })
  }

  /** 新增节点和总览使用独立键；切换时重建表单，滚回编辑区方便从表格直接修改。 */
  const selectLocation = (key: string) => {
    if (key === selectedKey) {
      editorRef.current?.scrollIntoView({ block: 'start' })
      return
    }
    confirmDiscard(() => {
      setSelectedKey(key)
      setDirty(false)
      editorRef.current?.scrollIntoView({ block: 'start' })
    })
  }

  /** 保存只更新页面内存；清空筛选并定位记录所在页，使新增或改名后的结果立即可见。 */
  const saveLocation = (values: StorageLocationValues) => {
    const saved: StorageLocation = { ...values, name: values.name.trim(), remark: values.remark?.trim() ?? '', id: activeRecord?.id ?? crypto.randomUUID() }
    setRecords((current) => activeRecord ? current.map((record) => record.id === saved.id ? saved : record) : [saved, ...current])
    setSelectedKey(saved.id)
    setEditorRevision((current) => current + 1)
    setDirty(false)
    setKeyword('')
    setStationFilter(undefined)
    setPage(activeRecord ? Math.floor(records.findIndex((record) => record.id === saved.id) / PAGE_SIZE) + 1 : 1)
    void message.success(activeRecord ? '库位参数已保存' : '库位已新增')
  }

  /** 删除必须二次确认；删除当前记录时同时销毁草稿，其他记录的草稿保持不变。 */
  const deleteLocation = (record: StorageLocation) => {
    modal.confirm({
      title: '删除库位',
      content: `确定删除“${record.name}”吗？${selectedKey === record.id && dirty ? '该库位未保存的修改也将丢弃。' : ''}删除后无法撤销。`,
      okText: '删除', cancelText: '取消', okButtonProps: { danger: true },
      onOk: () => {
        setRecords((current) => current.filter((item) => item.id !== record.id))
        if (selectedKey === record.id) { setSelectedKey('overview'); setDirty(false) }
        setPage(1)
        void message.success('库位已删除')
      },
    })
  }

  const treeData: TreeDataNode[] = [{
    key: 'new', title: '新增库位参数设置',
    children: records.map((record) => ({ key: record.id, title: <span title={record.name}>{record.name}</span>, isLeaf: true })),
  }, { key: 'overview', title: '库位管理总览', icon: <ListTree size={15} /> }]

  /** 参数摘要保留明确单位；操作固定在右侧，窄屏横向滚动时仍可修改和删除。 */
  const columns: TableColumnsType<StorageLocation> = [
    { title: '序号', key: 'index', width: 60, render: (_value, _record, index) => <Typography.Text type="secondary">{(page - 1) * PAGE_SIZE + index + 1}</Typography.Text> },
    { title: '库位名称', dataIndex: 'name', width: 170, render: (name: string) => <Typography.Text strong>{name}</Typography.Text> },
    { title: '站点 / 关联点', key: 'station', width: 180, render: (_value, record) => <Flex vertical gap={3}><span>{getStorageStation(record.stationId)?.name}</span><Typography.Text type="secondary" className={styles.hint}>{getStorageStation(record.stationId)?.points.find((point) => point.id === record.pointId)?.name}</Typography.Text></Flex> },
    { title: '库位参数信息', key: 'parameters', width: 265, render: (_value, record) => <Flex vertical gap={4}><Space size={8}><Tag className={styles.layerTag}>第 {record.layer} 层</Tag><span>最大承重 {record.maxLoad} kg</span></Space><Typography.Text type="secondary" className={styles.hint}>深度 {record.depth} mm · 高度 {record.height} mm</Typography.Text></Flex> },
    { title: '操作', key: 'actions', width: 112, fixed: 'right', render: (_value, record) => <Space size={14}><Button type="link" size="small" className={styles.rowAction} aria-label={`修改${record.name}`} onClick={() => selectLocation(record.id)}>修改</Button><Button type="link" danger size="small" className={styles.rowAction} aria-label={`删除${record.name}`} onClick={() => deleteLocation(record)}>删除</Button></Space> },
  ]

  return <Flex vertical gap={12} className={styles.page}>
    <Flex gap={16} align="start" className={styles.workspace}>
      <Card size="small" title="库位目录" extra={<Typography.Text type="secondary">{records.length} 个</Typography.Text>} className={styles.navigation}>
        <Tree.DirectoryTree aria-label="库位目录" blockNode defaultExpandAll expandAction={false} selectedKeys={[selectedKey]} treeData={treeData} onSelect={(keys) => { if (keys[0]) selectLocation(String(keys[0])) }} />
        <div className={styles.navigationNote}>选择库位维护参数，或进入总览查看全部配置。</div>
      </Card>
      <Flex vertical gap={20} className={styles.content}>
        <div ref={editorRef} className={styles.editorAnchor}>
          {selectedKey !== 'overview' && <Card size="small" className={styles.editorPanel} title={<Space size={10}><span>{activeRecord ? '库位参数配置' : '新增库位参数设置'}</span>{dirty && <Badge status="warning" text="未保存" />}</Space>} extra={<Tag color="blue">{activeRecord ? '修改库位' : '新增库位'}</Tag>}>
            <StorageLocationEditor key={`${selectedKey}:${editorRevision}`} record={activeRecord} records={records} onDirty={() => setDirty(true)} onSave={saveLocation} onReset={() => confirmDiscard(() => { setEditorRevision((current) => current + 1); setDirty(false) })} />
          </Card>}
        </div>
        <section aria-label="库位管理总览" className={styles.overview}>
          <Flex justify="space-between" align="center" gap={12} className={styles.sectionHeading}>
            <Space size={10}><Typography.Title level={2} className={styles.sectionTitle}>库位管理总览</Typography.Title><Typography.Text type="secondary" className={styles.hint}>共 {records.length} 个库位</Typography.Text></Space>
            <Button type="primary" icon={<Plus size={15} />} onClick={() => selectLocation('new')}>新增库位</Button>
          </Flex>
          <Flex gap={10} wrap className={styles.filters}>
            <Input.Search aria-label="搜索库位" placeholder="搜索库位名称 / 站点 / 关联点" allowClear className={styles.search} value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1) }} />
            <Select aria-label="筛选站点" placeholder="全部站点" allowClear className={styles.stationFilter} value={stationFilter} options={storageLocationData.stations.map((station) => ({ label: station.name, value: station.id }))} onChange={(value) => { setStationFilter(value); setPage(1) }} />
            {(keyword || stationFilter) && <Button onClick={() => { setKeyword(''); setStationFilter(undefined); setPage(1) }}>重置筛选</Button>}
          </Flex>
          <Table<StorageLocation> className={styles.table} bordered size="small" rowKey="id" columns={columns} dataSource={visibleRecords} scroll={{ x: 787 }} rowClassName={(record) => record.id === selectedKey ? styles.selectedRow : ''} pagination={{ current: page, pageSize: PAGE_SIZE, showSizeChanger: false, hideOnSinglePage: true, onChange: setPage, showTotal: (total) => `共 ${total} 条` }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={records.length ? '没有找到匹配的库位，请调整筛选条件' : '暂无库位，点击「新增库位」开始配置'} /> }} />
        </section>
      </Flex>
    </Flex>
    <Typography.Text type="secondary" className={styles.dataNote}>本地模拟数据 · 修改仅在当前页面保留，刷新后恢复预制数据</Typography.Text>
  </Flex>
}
