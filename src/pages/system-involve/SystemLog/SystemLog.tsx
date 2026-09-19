/**
 * 系统日志页（P26 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\SystemInvolve\SystemLog）：antd Table（服务端
 * 分页）+ 筛选表单（日志名称/日志类型/开始时间/结束时间）+ 行多选下载 zip
 * + FakeProgressModal 伪进度弹窗。本重写保持业务闭环等价并按样板升级基座：
 * - 列表迁移为 ApexTableReact request 模式（服务端分页、稳定行 ID、列偏好、
 *   内建取消/错误重试）；排序不启用（G09：旧页面无排序，接口未声明排序参数）；
 * - 列结构与旧版逐列核对（仅两列）：日志名称（省略+悬浮完整值，旧版 ellipsis
 *   showTitle 同语义）/ 最后修改时间（秒级 displayDateTime 展示转换，缺失留白；
 *   空值一律留白不写「—」占位）；旧版无操作列，本页同样不设（无钉右列）；
 * - 行多选下载 zip：选择键 = 日志文件名（行 ID 同源）；跨页翻页保留选择；
 *   提交新查询条件时清空选择（A09：不跨条件误选——旧版保留 keys，条件切换后
 *   会把不可见文件名带入下载请求，属误选风险，按纪律收敛）；
 * - 下载：移除旧 FakeProgressModal 伪进度（任务卡明确，P25 同款纪律），改经
 *   传输管理器登记（切页继续、关页提示、真实接收字节进度，A15/A16/规格 10）；
 *   JSON/HTML 响应不保存为伪文件（DoD 9：错误文件识别）；文件名 content-
 *   disposition 优先、default.zip 兜底（旧实现同语义）；对象 URL 用后即释放；
 * - 筛选仅提供接口支持的四个条件（OpenAPI SystemLogPageParam：logName/logType/
 *   startTime/endTime），不发明服务端没有的筛选；日志类型选项经
 *   useStaticOptions 动态加载（失败清空：仅文本提示，无重试按钮——按钮纪律）。
 *   契约变更（联验实证）：新后端类型集合为模块名（vehicleState/auth/device/
 *   dispatcher/driver/imap/system），旧默认值 NORMAL 已不在集合且查询为空、
 *   缺 logType 亦空查——默认类型改为「集合就位后取第一项」，起始查询延迟到
 *   默认值就位（保持旧版打开页面即见数据的交互语义，不写死臆造值）；
 * - 下载鉴权与会话失效由请求层统一收敛（1000000 → 登录页）；下载按钮挂按钮码
 *   system:log:download，无权限隐藏（旧 §7 同语义；菜单码 system:log:view 挂
 *   路由守卫）；
 * - 普通日志列表不轮询（DoD 7）；无手动刷新按钮（按钮纪律），新鲜度由查询
 *   提交保证。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, DatePicker, Form, Input, Select, Space } from 'antd'
import { Download, Search as SearchIcon } from 'lucide-react'
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
  RowSelectionState,
} from 'apex-table-react'
import { useApexLocale } from '@/hooks/useApexLocale'
import { useColumnPreferences } from '@/hooks/useColumnPreferences'
import { usePermission } from '@/hooks/usePermission'
import { useStaticOptions } from '@/hooks/useStaticOptions'
import { useRequestScope } from '@/components/RequestScopeProvider/RequestScopeContext'
import { useTransfers } from '@/hooks/useTransfers'
import { stringFieldRowId } from '@/utils/table/rowId'
import { toBackendPage } from '@/utils/table/tablePaging'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { displayDateTime } from '@/utils/datetime/datetimeDisplay'
import { beginTransfer } from '@/services/transfer/transferManager'
import {
  downloadSystemLog,
  getSystemLogTypes,
  pageSystemLogs,
} from '@/services/system/system-log/system-log.service'
import type { SystemLogDto } from '@/services/system/system-log/system-log.service.types'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './SystemLog.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

/** 筛选表单值形状（时间字段为 Dayjs，提交前序列化为秒级字符串） */
interface SystemLogSearchValues {
  logName?: string
  logType?: string
  startTime?: Dayjs | null
  endTime?: Dayjs | null
}

/** 已提交筛选条件（服务端协议形态；空条件裁剪，仅提交接口支持的参数） */
interface SubmittedFilter {
  logName?: string
  logType?: string
  startTime?: string
  endTime?: string
}

export default function SystemLog() {
  const { t } = useTranslation('systemLog')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（与旧实现 §7 一致）：下载日志，无权限隐藏
  const { hasPerm } = usePermission()
  const canDownload = hasPerm(PERM_BUTTON.SYSTEM_LOG_DOWNLOAD)

  // 页签 scope：传输登记按本页签 key 归属（切页继续、关页提示）
  const scope = useRequestScope()

  const [form] = Form.useForm<SystemLogSearchValues>()

  /* ------------------------------- 列表与筛选状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<SystemLogDto>>(null)

  // 已提交条件经 ref 供 request 回调读取最新值（避免闭包捕获旧条件）。
  // 旧版默认 logType='NORMAL' 在新后端无数据（类型集合已改为模块名
  // vehicleState/auth/device/dispatcher/driver/imap/system，联验实证），默认值
  // 改为「类型集合就位后取第一项」（不臆造、不写死），见下方默认值 effect。
  const filterRef = useRef<SubmittedFilter>({})

  /** 行选择（TanStack 受控，键 = 日志文件名；翻页保留，条件提交时清空） */
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const selectedNames = useMemo(
    () => Object.keys(rowSelection).filter((key) => rowSelection[key]),
    [rowSelection],
  )

  /* --------------------------- 日志类型选项（动态下发） --------------------------- */

  // 类型下拉数据源：失败清空（按钮纪律：仅文本提示、无重试按钮；失败时用户
  // 无法选择类型，查询被必填校验拦截，列表空态 + 文本如实呈现）
  const logTypesState = useStaticOptions<string>((signal) => getSystemLogTypes({ signal }))
  const logTypeOptions = useMemo(
    // 选项 label=value=类型原值（旧实现同形态；协议原值不翻译）
    () => (logTypesState.options ?? []).map((type) => ({ label: type, value: type })),
    [logTypesState.options],
  )
  // 类型集合镜像（render 期同步，供 request 回调与默认值 effect 读取最新值，
  // 与 useStaticOptions 内部 fetcherRef 同一模式）
  const logTypesRef = useRef<string[] | null>(null)
  logTypesRef.current = logTypesState.options

  /**
   * 默认日志类型就位（旧版「打开页面即带类型首查见数据」交互语义的等价实现）：
   * 类型集合加载成功且用户尚未选择时，默认取集合第一项（值来自接口，不写死）；
   * 就位后触发起始查询。集合为空/加载失败不就位，列表保持空态等待。
   */
  const defaultTypeAppliedRef = useRef(false)
  useEffect(() => {
    if (defaultTypeAppliedRef.current) return
    const list = logTypesState.options
    if (!list || list.length === 0) return
    defaultTypeAppliedRef.current = true
    form.setFieldsValue({ logType: list[0] })
    filterRef.current = { logType: list[0] }
    tableApiRef.current?.reload()
  }, [logTypesState.options, form])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('system-log:main')
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
   * 提交查询：时间序列化秒级字符串（旧实现 dayjs format 同格式）、空条件裁剪；
   * 回首页重新查询并清空行选择（A09：不跨条件误选）。
   */
  const handleSearch = useCallback(
    (values: SystemLogSearchValues) => {
      const logName = values.logName?.trim() ?? ''
      const next: SubmittedFilter = {
        ...(logName ? { logName } : {}),
        // 类型必填校验通过后必有值；allowClear 清空时由 required 校验拦截
        ...(values.logType ? { logType: values.logType } : {}),
        ...(values.startTime
          ? { startTime: values.startTime.format('YYYY-MM-DD HH:mm:ss') }
          : {}),
        ...(values.endTime ? { endTime: values.endTime.format('YYYY-MM-DD HH:mm:ss') } : {}),
      }
      filterRef.current = next
      setRowSelection({})
      tableInstanceRef.current?.resetPageIndex()
      tableApiRef.current?.reload()
    },
    [],
  )

  /** 清空筛选：仅重置表单字段（旧实现 form.resetFields 同语义，不自动触发查询） */
  const handleReset = useCallback(() => {
    form.resetFields()
  }, [form])

  /* --------------------------- 下载日志（zip，A15/A16） --------------------------- */

  // 下载防连点：在途期间禁用下载按钮（避免重复触发整包下载）
  const [downloading, setDownloading] = useState(false)

  /**
   * 下载所选日志：POST {logType, logNames[]} → zip Blob；真实接收进度经传输
   * 管理器登记（切页继续、关页提示）；错误 JSON/HTML 不落为伪文件（DoD 9）；
   * 文件名 content-disposition 优先、default.zip 兜底（旧实现同语义）；对象
   * URL 用后即释放。
   */
  const handleDownload = useCallback(() => {
    if (downloading) return
    if (selectedNames.length === 0) {
      message.warning(t('请选择要下载的日志'))
      return
    }
    setDownloading(true)
    const transfer = beginTransfer({
      tabKey: scope?.scopeKey ?? null,
      kind: 'download',
      // 登记名用旧实现兜底名（真实文件名在响应头，成功后按服务端命名落盘）
      name: 'default.zip',
    })
    downloadSystemLog(
      {
        // 类型取当前筛选原值（旧实现 searchParams.logType 同语义）
        logType: filterRef.current.logType ?? '',
        logNames: selectedNames,
      },
      // 真实接收进度上报：total 缺失即不确定进度（不伪造百分比，规格 10.5）
      (event) => transfer.setProgress(event.loaded, event.total ?? null),
      { signal: transfer.signal },
    )
      .then(({ blob, filename }) => {
        // 媒体类型粗校验：JSON/HTML 说明是异常网关/业务错误响应，不保存为伪文件
        if (blob.type.includes('json') || blob.type.includes('html')) {
          transfer.fail(t('下载系统日志出错：{{msg}}', { msg: blob.type }))
          message.error(t('下载系统日志出错：{{msg}}', { msg: blob.type }))
          return
        }
        // 文件名：服务端 content-disposition 优先（RFC 5987 已在服务层解析），
        // 取不到回退 default.zip（旧实现同语义）；保存后立即释放对象 URL
        const safeName = filename || 'default.zip'
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = safeName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        transfer.succeed()
        message.success(t('日志下载完成'))
      })
      .catch((error: unknown) => {
        if (!isCancelledError(error)) {
          const reason = t('下载系统日志出错：{{msg}}', { msg: apiErrorMessage(error) })
          transfer.fail(reason)
          message.error(reason)
        } else {
          // 主动取消：仅登记传输行说明（P08 同款），不弹错误反馈
          transfer.fail(t('已取消下载'))
        }
      })
      .finally(() => setDownloading(false))
  }, [downloading, message, scope, selectedNames, t])

  // 本页签在途传输快照：页内进度行呈现（切页继续传输，返回本页仍可见）
  const tabTransfers = useTransfers(scope?.scopeKey ?? null)
  const activeTransfers = tabTransfers.filter(
    (task) => task.phase === 'transferring' || task.phase === 'processing',
  )

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<SystemLogDto>[]>(() => {
    return [
      {
        // 日志名称：旧版 ellipsis+悬浮完整值同语义；缺失留白；同时是下载定位键
        accessorKey: 'name',
        header: t('日志名称'),
        enableSorting: false,
        size: 340,
        cell: (info) => {
          const text = info.getValue() as string | null | undefined
          if (text === null || text === undefined || text === '') return null
          return (
            <span className={styles.nameCell} title={text}>
              {text}
            </span>
          )
        },
      },
      {
        // 最后修改时间：秒级展示统一走 displayDateTime；缺失/不可解析留白
        accessorKey: 'time',
        header: t('最后修改时间'),
        enableSorting: false,
        size: 170,
        cell: (info) => displayDateTime(info.getValue() as string | null | undefined),
      },
    ]
  }, [t])

  /* ------------------------------------ 渲染 ------------------------------------ */

  return (
    <div className={styles.page}>
      {/* 筛选栏：四条件 + 按钮组（旧实现两行栅格同布局；标签横排居左，AGENTS 第 3 节
          筛选栏参数）；不设手动刷新按钮，查询提交即刷新 */}
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
          <Form.Item label={t('日志名称')} name="logName">
            <Input placeholder={t('请输入日志名称')} allowClear />
          </Form.Item>
          <Form.Item
            label={t('日志类型')}
            name="logType"
            rules={[{ required: true, message: t('请选择日志类型') }]}
          >
            <Select placeholder={t('请选择日志类型')} options={logTypeOptions} allowClear />
          </Form.Item>
          <Form.Item label={t('开始时间')} name="startTime">
            <DatePicker
              className={styles.datePicker}
              placeholder={t('请选择日志开始时间')}
              showTime
              allowClear
            />
          </Form.Item>
          <Form.Item label={t('结束时间')} name="endTime">
            <DatePicker
              className={styles.datePicker}
              placeholder={t('请选择日志结束时间')}
              showTime
              allowClear
            />
          </Form.Item>
        </div>
        <div className={styles.searchActions}>
          <Space wrap size={8}>
            <Button type="primary" htmlType="submit" icon={<SearchIcon size={14} />}>
              {t('查询')}
            </Button>
            <Button onClick={handleReset}>{t('清空')}</Button>
            {/* 下载日志：无 system:log:download 权限隐藏；在途防连点 */}
            {canDownload ? (
              <Button
                type="primary"
                icon={<Download size={14} />}
                loading={downloading}
                onClick={handleDownload}
              >
                {t('下载日志')}
              </Button>
            ) : null}
          </Space>
          {/* 类型选项加载失败：仅状态文本（按钮纪律：下拉失败无重试按钮）；
              默认类型 NORMAL 仍可提交查询，不阻塞列表 */}
          {logTypesState.error ? <span className={styles.loadError}>{t('加载失败')}</span> : null}
        </div>
      </Form>

      {/* 本页签在途传输进度行：真实字节进度（切页继续传输，返回本页仍可见） */}
      {activeTransfers.length > 0 ? (
        <div className={styles.transferLines}>
          {activeTransfers.map((task) => (
            <div key={task.id} className={styles.transferLine}>
              {task.phase === 'processing'
                ? t('传输完成，等待服务器处理：{{name}}', { name: task.name })
                : task.progress.total !== null && task.progress.total > 0
                  ? t('正在传输 {{name}}：{{percent}}%', {
                      name: task.name,
                      percent: Math.min(100, Math.round((task.progress.loaded / task.progress.total) * 100)),
                    })
                  : t('正在传输 {{name}}：已传输 {{loaded}} 字节', { name: task.name, loaded: task.progress.loaded })}
            </div>
          ))}
        </div>
      ) : null}

      {/* 主列表：Apex request 模式（服务端分页/取消/错误重试内建）；行选择键 = 日志文件名 */}
      <div className={styles.tableWrap}>
        <ApexTableReact
          ref={tableApiRef}
          tableRef={tableInstanceRef}
          columns={columns}
          request={(params) => {
            // 类型集合未就位（尚在加载）不发起业务查询：默认类型尚未就位，
            // 此时请求必然空查；就位后由默认值 effect 触发真实起始查询
            if (logTypesRef.current === null) {
              return Promise.resolve({ data: [], rowCount: 0 })
            }
            const { pageIndex, pageSize, signal } = params
            const { pageNo, pageSize: size } = toBackendPage(pageIndex, pageSize)
            const filter = filterRef.current
            return pageSystemLogs(
              {
                pageNo,
                pageSize: size,
                ...(filter.logType ? { logType: filter.logType } : {}),
                ...(filter.logName ? { logName: filter.logName } : {}),
                ...(filter.startTime ? { startTime: filter.startTime } : {}),
                ...(filter.endTime ? { endTime: filter.endTime } : {}),
              },
              { signal },
            ).then((page) => ({
              // rowCount 取真实 total；未知总数不由前端补 0（DoD 5）
              data: page.records ?? [],
              rowCount: page.total ?? 0,
            }))
          }}
          getRowId={stringFieldRowId('name')}
          showSelectionColumn
          enableRowSelection
          onRowSelectionChange={(updater) =>
            setRowSelection(
              typeof updater === 'function'
                ? (updater as (old: RowSelectionState) => RowSelectionState)(rowSelection)
                : updater,
            )
          }
          locale={apexLocale}
          pagination={{ pageSizeOptions: [10, 20, 50, 100, 200] }}
          columnSettingsEnabled
          height="100%"
          state={{
            rowSelection,
            columnOrder: prefSlices.columnOrder,
            columnVisibility: prefSlices.columnVisibility,
            columnSizing: prefSlices.columnSizing,
            columnPinning: prefSlices.columnPinning,
          }}
          onColumnOrderChange={(updater) =>
            persistPrefs({ columnOrder: resolveUpdater(updater, prefSlices.columnOrder ?? []) })
          }
          onColumnVisibilityChange={(updater) =>
            persistPrefs({ columnVisibility: resolveUpdater(updater, prefSlices.columnVisibility ?? {}) })
          }
          onColumnSizingChange={(updater) =>
            persistPrefs({ columnSizing: resolveUpdater(updater, prefSlices.columnSizing ?? {}) })
          }
          onColumnPinningChange={(updater) =>
            persistPrefs({ columnPinning: resolveUpdater(updater, prefSlices.columnPinning ?? { start: [], end: [] }) })
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
