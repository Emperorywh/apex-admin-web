/**
 * 操作日志页（P28 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\SystemInvolve\OperationLog）：antd Table
 * （POST 服务端分页）+ 搜索表单（日志标题/目标名称/日志类型/模块/请求时间
 * 范围）+ 请求/响应参数 JsonViewer Popover 详情。本重写保持业务闭环等价并按
 * 样板升级基座：
 * - 列表迁移为 ApexTableReact request 模式（POST pageSysLogs 服务端分页、
 *   稳定行 ID=id、列偏好、内建取消/错误重试）；排序不启用（G09：旧页面无
 *   排序，接口未声明排序参数）；普通审计日志查询不轮询（DoD 7）、无手动
 *   刷新按钮（按钮纪律），新鲜度由查询提交保证；
 * - 列结构与旧版逐列核对（11 列全 center）：日志标题（钉左，省略+悬浮）/
 *   日志类型（ERROR 红「异常」、NORMAL 绿「正常」、未知枚举原值 Tag、缺失
 *   留白——旧版缺失显示字符串 "NULL"，按空值纪律收敛为留白，差异登记）/
 *   操作用户/请求 IP/目标名称/模块（14 枚举映射蓝 Tag，未知原值）/请求参数/
 *   响应参数（JSON 详情单元格）/异常详情/请求耗时(ms)/请求时间（钉右，
 *   displayDateTime 秒级展示转换，缺失留白；时间语义遵循部署时区 G15）；
 * - 日志详情（JsonPreviewCell）：旧版 JsonViewer 等价迁移（Popover 格式化
 *   JSON+标题复制），并按专项验收收敛——缺失留白、JSON 空值（'null'/'{}'）
 *   显示原文形态、非 JSON 原文保留原文呈现（旧版解析失败吞成「暂无数据」，
 *   按「保留服务器业务原文」改进，差异登记）；
 * - 筛选仅提供接口支持的五个条件（OpenAPI SysLogPageParamSysLog：title/
 *   logType/module/targetName/startRequestTime/endRequestTime）；时间序列化
 *   秒级字符串（旧实现 dayjs 同格式；边界与序列化证据随联验记录，G15）；
 *   筛选条件仅存组件状态、不自动写入 URL（专项验收：敏感筛选不自动写 URL）；
 * - 菜单码 system:operation-log:view 挂路由守卫（旧 §7 同语义；本页只读无
 *   写操作、无下载，故无按钮码）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Form, Input, Select, DatePicker, Tag } from 'antd'
import { Search as SearchIcon } from 'lucide-react'
import type { Dayjs } from 'dayjs'
import { useTranslation } from 'react-i18next'
import { ApexTableReact } from 'apex-table-react'
import type {
  ApexColumnDef,
  ApexTableInstance,
  ApexTableRef,
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState,
} from 'apex-table-react'
import { useApexLocale } from '@/hooks/useApexLocale'
import { useColumnPreferences } from '@/hooks/useColumnPreferences'
import { stringFieldRowId } from '@/utils/table/rowId'
import { toBackendPage } from '@/utils/table/tablePaging'
import { displayDateTime } from '@/utils/datetime/datetimeDisplay'
import { pageSysLogs } from '@/services/system/sys-log/sys-log.service'
import type { SysLogDto } from '@/services/system/sys-log/sys-log.service.types'
import JsonPreviewCell from '@/features/operation-log/JsonPreviewCell'
import {
  operationLogModuleLabelMap,
  operationLogModuleOptions,
} from '@/features/operation-log/moduleOptions'
import styles from './OperationLog.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

/** 筛选表单值形状（时间字段为 Dayjs，提交前序列化为秒级字符串） */
interface OperationLogSearchValues {
  title?: string
  targetName?: string
  logType?: string
  module?: string
  requestTime?: [Dayjs | null, Dayjs | null] | null
}

/** 已提交筛选条件（服务端协议形态；空条件裁剪，仅提交接口支持的参数） */
interface SubmittedFilter {
  title?: string
  targetName?: string
  logType?: string
  module?: string
  startRequestTime?: string
  endRequestTime?: string
}

/** 日志类型选项（旧实现同源：NORMAL 正常 / ERROR 异常） */
function buildLogTypeOptions(t: (key: string) => string) {
  return [
    { label: t('正常'), value: 'NORMAL' },
    { label: t('异常'), value: 'ERROR' },
  ]
}

/** 代码默认钉位（旧版 title fixed left / requestTime fixed right 等价迁移；
 *  用户保存的列偏好优先于代码默认，仅在无已保存偏好时生效） */
const defaultPinning: ColumnPinningState = { start: ['title'], end: ['requestTime'] }

export default function OperationLog() {
  const { t } = useTranslation('operationLog')
  const apexLocale = useApexLocale()

  const [form] = Form.useForm<OperationLogSearchValues>()

  /* ------------------------------- 列表与筛选状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<SysLogDto>>(null)

  // 已提交条件经 ref 供 request 回调读取最新值（避免闭包捕获旧条件）
  const filterRef = useRef<SubmittedFilter>({})

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('operation-log:main')
  const [prefSlices, setPrefSlices] = useState<ColumnPrefSlices>({})
  const prefSlicesRef = useRef<ColumnPrefSlices>({})

  useEffect(() => {
    if (!prefs || !tableInstanceRef.current) return
    try {
      const slices = prefs.load({
        columns: tableInstanceRef.current.getAllLeafColumns(),
        initialState: {},
      })
      const loaded: ColumnPrefSlices = {
        columnOrder: slices.columnOrder,
        columnVisibility: slices.columnVisibility,
        columnSizing: slices.columnSizing,
        columnPinning: slices.columnPinning,
      }
      setPrefSlices(loaded)
      prefSlicesRef.current = loaded
    } catch {
      // 偏好读取失败不阻塞表格：以默认布局运行
    }
  }, [prefs])

  /**
   * 列偏好持久化（P03 实证约束）：
   * - 受控切片必须同步更新，否则下一帧按旧值渲染回弹用户改动；
   * - save 是整体替换语义，必须传合并后的完整四切片（面板一次确认连发四类回调）。
   */
  const persistPrefs = useCallback(
    (patch: ColumnPrefSlices) => {
      const merged = { ...prefSlicesRef.current, ...patch }
      prefSlicesRef.current = merged
      setPrefSlices(merged)
      if (!prefs) return
      try {
        prefs.save(merged)
      } catch {
        // 保存失败静默：偏好是增强能力，不阻塞业务操作
      }
    },
    [prefs],
  )

  /* --------------------------------- 筛选提交 --------------------------------- */

  /**
   * 提交查询：文本条件 trim、空条件裁剪；时间序列化秒级字符串（旧实现
   * dayjs format 同格式，RangePicker showTime 分钟粒度、秒补 00；allowEmpty
   * 两端可独立为空）；回首页重新查询。筛选条件仅存组件状态、不写 URL。
   */
  const handleSearch = useCallback(
    (values: OperationLogSearchValues) => {
      const title = values.title?.trim() ?? ''
      const targetName = values.targetName?.trim() ?? ''
      const [startRequestTime, endRequestTime] = values.requestTime ?? [null, null]
      const next: SubmittedFilter = {
        ...(title ? { title } : {}),
        ...(targetName ? { targetName } : {}),
        ...(values.logType ? { logType: values.logType } : {}),
        ...(values.module ? { module: values.module } : {}),
        ...(startRequestTime
          ? { startRequestTime: startRequestTime.format('YYYY-MM-DD HH:mm:ss') }
          : {}),
        ...(endRequestTime
          ? { endRequestTime: endRequestTime.format('YYYY-MM-DD HH:mm:ss') }
          : {}),
      }
      filterRef.current = next
      tableInstanceRef.current?.resetPageIndex()
      tableApiRef.current?.reload()
    },
    [],
  )

  /** 清空筛选：仅重置表单字段（旧实现 form.resetFields 同语义，不自动触发查询） */
  const handleReset = useCallback(() => {
    form.resetFields()
  }, [form])

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<SysLogDto>[]>(() => {
    // 文本省略单元格：单行省略 + 悬浮完整值（旧实现 ellipsis showTitle 同语义；
    // 缺失留白——返回 null 不渲染占位）
    const ellipsisCell = (text: string | null | undefined) => {
      if (text === null || text === undefined || text === '') return null
      return (
        <span className={styles.ellipsisCell} title={text}>
          {text}
        </span>
      )
    }
    return [
      {
        // 日志标题：钉左（旧版 fixed left），省略+悬浮完整值
        accessorKey: 'title',
        header: t('日志标题'),
        enableSorting: false,
        size: 180,
        meta: { apex: { align: 'center' } },
        cell: (info) => ellipsisCell(info.getValue() as string | null | undefined),
      },
      {
        // 日志类型：ERROR 红「异常」/ NORMAL 绿「正常」/ 未知枚举原值 Tag；
        // 缺失留白（旧版显示 "NULL" 字符串，按空值纪律收敛为留白，差异登记）
        accessorKey: 'logType',
        header: t('日志类型'),
        enableSorting: false,
        size: 100,
        meta: { apex: { align: 'center' } },
        cell: (info) => {
          const value = info.getValue() as string | null | undefined
          if (value === null || value === undefined || value === '') return null
          if (value === 'ERROR') return <Tag color="red">{t('异常')}</Tag>
          if (value === 'NORMAL') return <Tag color="green">{t('正常')}</Tag>
          return <Tag>{value}</Tag>
        },
      },
      {
        // 操作用户：省略+悬浮
        accessorKey: 'username',
        header: t('操作用户'),
        enableSorting: false,
        size: 120,
        meta: { apex: { align: 'center' } },
        cell: (info) => ellipsisCell(info.getValue() as string | null | undefined),
      },
      {
        // 请求 IP：省略+悬浮
        accessorKey: 'requestIp',
        header: t('请求IP'),
        enableSorting: false,
        size: 140,
        meta: { apex: { align: 'center' } },
        cell: (info) => ellipsisCell(info.getValue() as string | null | undefined),
      },
      {
        // 目标名称：省略+悬浮
        accessorKey: 'targetName',
        header: t('目标名称'),
        enableSorting: false,
        size: 200,
        meta: { apex: { align: 'center' } },
        cell: (info) => ellipsisCell(info.getValue() as string | null | undefined),
      },
      {
        // 模块：已知 14 枚举映射翻译蓝 Tag（旧版同色）；未知枚举原值蓝 Tag
        // （不猜语义）；缺失留白（旧版 null 亦不渲染，行为一致）
        accessorKey: 'module',
        header: t('模块'),
        enableSorting: false,
        size: 120,
        meta: { apex: { align: 'center' } },
        cell: (info) => {
          const value = info.getValue() as string | null | undefined
          if (value === null || value === undefined || value === '') return null
          const labelKey = operationLogModuleLabelMap[value]
          return <Tag color="blue">{labelKey ? t(labelKey) : value}</Tag>
        },
      },
      {
        // 请求参数：JSON 详情单元格（缺失留白/空值原文/非 JSON 原文三分态）
        accessorKey: 'requestParam',
        header: t('请求参数'),
        enableSorting: false,
        size: 220,
        meta: { apex: { align: 'center' } },
        cell: (info) => (
          <JsonPreviewCell
            value={info.getValue() as string | null | undefined}
            title={t('请求参数')}
          />
        ),
      },
      {
        // 响应参数：同请求参数
        accessorKey: 'responseParam',
        header: t('响应参数'),
        enableSorting: false,
        size: 220,
        meta: { apex: { align: 'center' } },
        cell: (info) => (
          <JsonPreviewCell
            value={info.getValue() as string | null | undefined}
            title={t('响应参数')}
          />
        ),
      },
      {
        // 异常详情：省略+悬浮
        accessorKey: 'exceptionDetail',
        header: t('异常详情'),
        enableSorting: false,
        size: 220,
        meta: { apex: { align: 'center' } },
        cell: (info) => ellipsisCell(info.getValue() as string | null | undefined),
      },
      {
        // 请求耗时（毫秒）：数值原样；缺失留白
        accessorKey: 'requestDuration',
        header: t('请求耗时(ms)'),
        enableSorting: false,
        size: 120,
        meta: { apex: { align: 'center' } },
        cell: (info) => {
          const value = info.getValue() as number | null | undefined
          if (value === null || value === undefined) return null
          return value
        },
      },
      {
        // 请求时间：displayDateTime 秒级展示转换（缺失/不可解析留白）；钉右
        accessorKey: 'requestTime',
        header: t('请求时间'),
        enableSorting: false,
        size: 250,
        meta: { apex: { align: 'center' } },
        cell: (info) => displayDateTime(info.getValue() as string | null | undefined),
      },
    ]
  }, [t])

  /* ------------------------------------ 渲染 ------------------------------------ */

  return (
    <div className={styles.page}>
      {/* 筛选栏：首行四条件 + 次行时间范围与按钮组（旧实现两行栅格同布局；
          标签横排居左，AGENTS 第 3 节筛选栏参数）；不设手动刷新按钮，
          查询提交即刷新 */}
      <Form
        className={styles.searchForm}
        form={form}
        layout="horizontal"
        colon={false}
        labelCol={{ flex: '0 0 104px' }}
        wrapperCol={{ flex: '1 1 0%', style: { minWidth: 0 } }}
        onFinish={handleSearch}
        autoComplete="off"
      >
        <div className={styles.searchGrid}>
          <Form.Item label={t('日志标题')} name="title">
            <Input placeholder={t('请输入日志标题')} allowClear />
          </Form.Item>
          <Form.Item label={t('目标名称')} name="targetName">
            <Input placeholder={t('请输入目标名称')} allowClear />
          </Form.Item>
          <Form.Item label={t('日志类型')} name="logType">
            <Select
              placeholder={t('请选择日志类型')}
              options={buildLogTypeOptions(t)}
              allowClear
            />
          </Form.Item>
          <Form.Item label={t('模块')} name="module">
            <Select
              placeholder={t('请选择模块')}
              options={operationLogModuleOptions.map((item) => ({
                label: t(item.label),
                value: item.value,
              }))}
              allowClear
            />
          </Form.Item>
          <Form.Item
            label={t('请求时间')}
            name="requestTime"
            className={styles.timeRangeItem}
          >
            <DatePicker.RangePicker
              className={styles.rangePicker}
              showTime={{ format: 'HH:mm' }}
              allowEmpty={[true, true]}
              placeholder={[t('开始请求时间'), t('结束请求时间')]}
            />
          </Form.Item>
          <div className={styles.searchActions}>
            <Button type="primary" htmlType="submit" icon={<SearchIcon size={14} />}>
              {t('查询')}
            </Button>
            <Button onClick={handleReset}>{t('清空')}</Button>
          </div>
        </div>
      </Form>

      {/* 主列表：Apex request 模式（POST 服务端分页/取消/错误重试内建）；
          行 ID = id（int64 主键）；分页档位沿用旧版 [10,15,20,50,100,200] */}
      <div className={styles.tableWrap}>
        <ApexTableReact
          ref={tableApiRef}
          tableRef={tableInstanceRef}
          columns={columns}
          request={(params) => {
            const { pageIndex, pageSize, signal } = params
            const { pageNo, pageSize: size } = toBackendPage(pageIndex, pageSize)
            const filter = filterRef.current
            return pageSysLogs(
              {
                pageNo,
                pageSize: size,
                ...(filter.title ? { title: filter.title } : {}),
                ...(filter.targetName ? { targetName: filter.targetName } : {}),
                ...(filter.logType ? { logType: filter.logType } : {}),
                ...(filter.module ? { module: filter.module } : {}),
                ...(filter.startRequestTime
                  ? { startRequestTime: filter.startRequestTime }
                  : {}),
                ...(filter.endRequestTime
                  ? { endRequestTime: filter.endRequestTime }
                  : {}),
              },
              { signal },
            ).then((page) => ({
              // rowCount 取真实 total；未知总数不由前端补 0（DoD 5）
              data: page.records ?? [],
              rowCount: page.total ?? 0,
            }))
          }}
          getRowId={stringFieldRowId('id')}
          locale={apexLocale}
          pagination={{ pageSizeOptions: [10, 15, 20, 50, 100, 200] }}
          columnSettingsEnabled
          height="100%"
          state={{
            columnOrder: prefSlices.columnOrder,
            columnVisibility: prefSlices.columnVisibility,
            columnSizing: prefSlices.columnSizing,
            columnPinning: prefSlices.columnPinning ?? defaultPinning,
          }}
          onColumnOrderChange={(updater) =>
            persistPrefs({ columnOrder: resolveUpdater(updater, prefSlices.columnOrder ?? []) })
          }
          onColumnVisibilityChange={(updater) =>
            persistPrefs({
              columnVisibility: resolveUpdater(updater, prefSlices.columnVisibility ?? {}),
            })
          }
          onColumnSizingChange={(updater) =>
            persistPrefs({ columnSizing: resolveUpdater(updater, prefSlices.columnSizing ?? {}) })
          }
          onColumnPinningChange={(updater) =>
            persistPrefs({
              columnPinning: resolveUpdater(updater, prefSlices.columnPinning ?? defaultPinning),
            })
          }
        />
      </div>
    </div>
  )
}

/**
 * TanStack Updater 解析：回调可能收到值或函数（旧值 → 新值）。
 * 列偏好持久化只需要最终值，这里以当前受控切片为旧值统一折叠。
 */
function resolveUpdater<T>(updater: T | ((old: T) => T), old: T): T {
  return typeof updater === 'function' ? (updater as (old: T) => T)(old) : updater
}
