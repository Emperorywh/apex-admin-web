/**
 * 服务器资源监控页（P40 整页交付；旧 AnalyzeVisual/ServerRealtimeResources 等价迁移）。
 *
 * 形态决策（D08/规格 7，P39 交接登记的同构迁移）：
 * - 旧实现为布局外全屏大屏（layout:false，右上「返回」退出）；新形态默认工作区
 *   页签（路由迁入受保护根，完整路径 /analyze-visual/server-resource-monitor 不变），
 *   工具栏提供「独立窗口」（openStandaloneWindow 同路径同守卫）与「全屏」
 *   （Fullscreen API，页面根元素）两种扩展形态；「返回」按钮随全屏大屏形态退役
 *   （工作区页签由外壳页签导航，独立窗口由系统窗口关闭，差异登记 tasks/P40.md）；
 * - 菜单入口仍是别名 /analyze-visual/server-resource（redirect 到本页，同码守卫）。
 *
 * 数据流（旧 index.tsx 机制等价升级）：
 * - GET serverResource/current 唯一数据源；useVisiblePolling 约 5 秒可见串行轮询
 *   （旧 2 秒 → 规格默认节奏，polling.constants 集中配置），页签隐藏/后台保留
 *   最后快照，恢复可见立即刷新，失败按倍率退避（A12/D14）；
 * - 失败清空快照区域（快照置 null + 徽标「连接失败」+ 脚注标示），已采集的
 *   真实趋势历史保留但停止追加，恢复后自动续采切回实时（旧实现同口径，D15）；
 * - 数值纪律：使用率缺失/非法归一为「不可计算」显示「--」，绝不显示虚假 0%
 *   （resourcePolicy.normRate 纪律修正，DoD 14）。
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Tooltip } from 'antd'
import { ExternalLink, Maximize2, Minimize2, Table2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { POLL_BASE_INTERVAL_MS } from '@/constants/polling.constants'
import { ROUTE_PATHS } from '@/router/definitions'
import { useTheme } from '@/hooks/useTheme'
import { useVisiblePolling } from '@/hooks/useVisiblePolling'
import { openStandaloneWindow } from '@/utils/window/standaloneWindow'
import { fetchServerResourceCurrent } from '@/services/server-resource/server-resource.service'
import type { ServerResourceSnapshotDto } from '@/services/server-resource/server-resource.service.types'
import {
  MAX_HIST,
  SERIES,
  normRate,
  pad2,
  sevOf,
} from '@/features/server-resource/resourcePolicy'
import type { TipState } from '@/features/server-resource/resourcePolicy'
import { DiskPanel } from '@/features/server-resource/components/DiskPanel'
import { ResourceGauge } from '@/features/server-resource/components/ResourceGauge'
import { ResourceTrendChart } from '@/features/server-resource/components/ResourceTrendChart'
import type { TrendSeries } from '@/features/server-resource/components/ResourceTrendChart'
import { SnapshotTableModal } from '@/features/server-resource/components/SnapshotTableModal'
import styles from './ServerRealtimeResources.module.css'

/** 连接状态徽标：连接中 / 实时 / 连接失败（错误态与加载态必须可区分） */
type ConnMode = 'wait' | 'live' | 'error'

/**
 * 头部时钟（独立组件 + 自有 1s 定时器，避免整页每秒重渲染）。
 * 日期用 Intl 按当前语言格式化；时间固定 24 小时制 HH:mm:ss。
 */
function HeaderClock() {
  const { i18n } = useTranslation('server-resource')
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const dateText = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }).format(now),
    [i18n.language, now],
  )
  return (
    <div className={styles.clock}>
      <div className={styles.clockDate}>{dateText}</div>
      <div className={styles.clockTime}>
        {pad2(now.getHours())}:{pad2(now.getMinutes())}:{pad2(now.getSeconds())}
      </div>
    </div>
  )
}

export default function ServerRealtimeResources() {
  const { t } = useTranslation('server-resource')
  const resolvedTheme = useTheme()
  const { message } = App.useApp()

  /** 最近一次成功快照；null 表示尚未成功或处于连接失败降级态（区域已清空） */
  const [snapshot, setSnapshot] = useState<ServerResourceSnapshotDto | null>(null)
  /** 真实失败态（主动取消不算）：失败时清空快照并呈现，恢复由轮询退避自动重查 */
  const [failed, setFailed] = useState(false)
  /** 趋势历史（客户端逐次采样累积，最多 MAX_HIST 点）；失败时保留但停止追加 */
  const [hist, setHist] = useState<{ t: number; cpu: number | null; mem: number | null; jvm: number | null }[]>([])
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null)
  /** 页面级悬浮提示（趋势图与磁盘行共用），null 表示隐藏 */
  const [tip, setTip] = useState<TipState | null>(null)
  const [tableOpen, setTableOpen] = useState(false)
  /** 全屏态（Fullscreen API；Esc 退出经 fullscreenchange 同步回按钮文案） */
  const [fullscreen, setFullscreen] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)

  /**
   * 轮询单次刷新：signal 透传请求层；成功更新快照并追加趋势采样，
   * 真实失败清空快照区域并置错误态（D15），主动取消静默。
   */
  const refresh = useCallback(async (signal: AbortSignal) => {
    try {
      const data = await fetchServerResourceCurrent({ signal })
      if (signal.aborted) return
      // 快照接口正常必有 data；空 data 视为该轮无有效数据（按失败呈现，不冒充成功）
      if (!data) throw new Error('empty snapshot')
      setSnapshot(data)
      setFailed(false)
      const now = Date.now()
      setLastSuccessAt(now)
      // 趋势采样追加：不可计算点记 null（画线断笔），窗口满后移除最旧点
      setHist((prev) => {
        const next = [
          ...prev,
          {
            t: now,
            cpu: normRate(data.systemCpuLoad),
            mem: normRate(data.systemMemoryUsageRate),
            jvm: normRate(data.jvmHeapUsageRate),
          },
        ]
        if (next.length > MAX_HIST) next.shift()
        return next
      })
    } catch {
      // 主动取消（页签关闭/隐藏/刷新重建）静默；真实失败清空远端数据区域
      if (signal.aborted) return
      setSnapshot(null)
      setFailed(true)
    }
  }, [])

  // 可见串行轮询：页签激活 + 文档可见才刷新；隐藏保留快照，恢复立即刷新，失败退避
  useVisiblePolling({ refresh })

  /* ------------------------------ 全屏生命周期（Fullscreen API） ------------------------------ */

  // 全屏状态同步：进入/退出（含 Esc）都经 fullscreenchange 事件回写按钮文案
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  /**
   * 进入/退出页面根元素全屏。按钮状态乐观更新（点击即反馈），
   * fullscreenchange 事件随后作权威同步（覆盖 Esc 等系统路径退出）；
   * 被浏览器拒绝时回滚乐观态并给出可读提示。
   */
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      setFullscreen(false)
      void document.exitFullscreen().catch(() => {})
      return
    }
    const target = pageRef.current
    if (!target) return
    setFullscreen(true)
    target.requestFullscreen?.().catch(() => {
      setFullscreen(false)
      message.warning(t('浏览器拒绝了全屏请求'))
    })
  }, [message, t])

  /* ------------------------------ 悬浮提示：随鼠标移动，视口边界翻转 ------------------------------ */

  const tipRef = useRef<HTMLDivElement>(null)
  const [tipPos, setTipPos] = useState({ left: 0, top: 0 })
  useLayoutEffect(() => {
    if (!tip || !tipRef.current) return
    const r = tipRef.current.getBoundingClientRect()
    let left = tip.x + 16
    let top = tip.y + 14
    if (left + r.width > window.innerWidth - 8) left = tip.x - r.width - 12
    if (top + r.height > window.innerHeight - 8) top = tip.y - r.height - 10
    setTipPos({ left, top })
  }, [tip])

  const showTip = useCallback((x: number, y: number, title: string, rows: TipState['rows']) => {
    setTip({ x, y, title, rows })
  }, [])
  const hideTip = useCallback(() => setTip(null), [])

  /** 打开独立窗口：同一路径（同守卫同会话）；弹窗被拦截时给出可读提示 */
  const handleOpenStandalone = useCallback(() => {
    const opened = openStandaloneWindow(ROUTE_PATHS['analyze-visual-server-resource-monitor'])
    if (!opened) {
      message.warning(t('打开独立窗口失败，请允许浏览器弹窗后重试'))
    }
  }, [message, t])

  /* ------------------------------ 派生展示值 ------------------------------ */

  const cpu = snapshot ? normRate(snapshot.systemCpuLoad) : null
  const mem = snapshot ? normRate(snapshot.systemMemoryUsageRate) : null
  const jvm = snapshot ? normRate(snapshot.jvmHeapUsageRate) : null
  const disks = snapshot?.disks ?? null
  // 磁盘平均使用率：仅对可计算分区求平均；无可计算分区为 null（不补 0，DoD 14）
  const diskAvg = useMemo(() => {
    if (!disks || disks.length === 0) return null
    const rates = disks.map((d) => normRate(d.usageRate)).filter((r): r is number => r !== null)
    if (rates.length === 0) return null
    return rates.reduce((sum, r) => sum + r, 0) / rates.length
  }, [disks])

  // 趋势序列定义（颜色固定，名称随语言变化）
  const trendSeries: TrendSeries[] = useMemo(
    () => [
      { key: SERIES[0].key, color: SERIES[0].color, name: t('CPU 使用率') },
      { key: SERIES[1].key, color: SERIES[1].color, name: t('内存使用率') },
      { key: SERIES[2].key, color: SERIES[2].color, name: t('JVM 堆使用率') },
    ],
    [t],
  )

  const mode: ConnMode = failed ? 'error' : snapshot ? 'live' : 'wait'
  const trendFootSource =
    mode === 'live' ? t('实时接口数据') : mode === 'error' ? t('连接失败，等待重试') : t('连接中…')

  /** 严重程度状态点（仪表底部 chip）；不可计算显示中性占位 */
  const renderChip = (v: number | null) => {
    const sev = v === null ? null : sevOf(v)
    return (
      <span className={styles.chip}>
        <i
          className={styles.chipDot}
          style={sev ? { background: sev.dot, boxShadow: `0 0 7px ${sev.dot}` } : undefined}
        />
        <em className={styles.chipText}>{sev ? t(sev.t) : '--'}</em>
      </span>
    )
  }

  /** 图例/浮层共用的百分比格式化：null 显示「--」（不显示 0） */
  const fmtPct = (v: number | null) => (v === null ? '--' : `${v.toFixed(1)}%`)

  return (
    <div className={styles.page} ref={pageRef}>
      {/* ================= 工具栏：标题 + 徽标 + 时钟 + 形态入口 ================= */}
      <div className={styles.toolbar}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>{t('服务器资源监控')}</h1>
          <span className={styles.subtitle}>SERVER RESOURCE MONITORING</span>
        </div>
        <div className={styles.toolbarSide}>
          <HeaderClock />
          <div className={`${styles.badge} ${styles[`badge_${mode}`]}`}>
            <i className={styles.badgeDot} />
            <span>
              {mode === 'live' ? t('实时数据') : mode === 'error' ? t('连接失败') : t('连接中…')}
            </span>
          </div>
          <div className={styles.toolbarActions}>
            <Button
              icon={<Table2 size={14} />}
              title={t('以表格形式查看当前快照（无障碍视图）')}
              onClick={() => setTableOpen(true)}
            >
              {t('数据表格')}
            </Button>
            {/* Fullscreen API 不可用（iframe 无授权等）时禁用并说明，不给死按钮 */}
            <Tooltip title={document.fullscreenEnabled ? undefined : t('当前环境不支持全屏显示')}>
              <Button
                icon={fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                disabled={!document.fullscreenEnabled}
                onClick={toggleFullscreen}
              >
                {fullscreen ? t('退出全屏') : t('全屏')}
              </Button>
            </Tooltip>
            <Button icon={<ExternalLink size={14} />} onClick={handleOpenStandalone}>
              {t('独立窗口')}
            </Button>
          </div>
        </div>
      </div>

      {/* ================= 主体三列：CPU/内存 · 指标卡+趋势 · JVM/磁盘 ================= */}
      <main className={styles.main}>
        {/* 左列：CPU + 系统内存 */}
        <section className={styles.col}>
          <div className={styles.panel}>
            <div className={styles.panelTitle}>{t('CPU 使用率')}</div>
            <div className={styles.gaugeWrap}>
              <ResourceGauge name={t('CPU 使用率')} value={cpu} />
            </div>
            <div className={styles.gaugeFoot}>
              <div className={styles.mini}>
                <span className={styles.miniK}>{t('逻辑核心')}</span>
                <span className={styles.miniV}>{snapshot?.cpuCores ?? '--'}</span>
              </div>
              <div className={styles.mini}>
                <span className={styles.miniK}>{t('负载状态')}</span>
                {renderChip(cpu)}
              </div>
            </div>
          </div>
          <div className={styles.panel}>
            <div className={styles.panelTitle}>{t('系统内存')}</div>
            <div className={styles.gaugeWrap}>
              <ResourceGauge name={t('内存使用率')} value={mem} />
            </div>
            <div className={styles.gaugeFoot}>
              <div className={styles.mini}>
                <span className={styles.miniK}>{t('总内存')}</span>
                <span className={styles.miniV}>{snapshot?.systemMemoryTotal ?? '--'}</span>
              </div>
              <div className={styles.mini}>
                <span className={styles.miniK}>{t('已用')}</span>
                <span className={styles.miniV}>{snapshot?.systemMemoryUsed ?? '--'}</span>
              </div>
              <div className={styles.mini}>
                <span className={styles.miniK}>{t('空闲')}</span>
                <span className={styles.miniV}>{snapshot?.systemMemoryFree ?? '--'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* 中列：指标卡（2×2）+ 趋势 */}
        <section className={styles.col}>
          <div className={styles.statGrid}>
            <div className={styles.tile}>
              <div className={styles.tileK}>{t('CPU 核心数')}</div>
              <div className={styles.tileV}>
                {snapshot?.cpuCores != null ? t('{{count}} 核', { count: snapshot.cpuCores }) : '--'}
              </div>
              <div className={styles.tileS}>{t('逻辑处理器数量')}</div>
            </div>
            <div className={styles.tile}>
              <div className={styles.tileK}>{t('系统内存总量')}</div>
              <div className={styles.tileV}>{snapshot?.systemMemoryTotal ?? '--'}</div>
              <div className={styles.tileS}>
                {snapshot
                  ? t('已用 {{used}} · 空闲 {{free}}', {
                      used: snapshot.systemMemoryUsed ?? '',
                      free: snapshot.systemMemoryFree ?? '',
                    })
                  : '--'}
              </div>
            </div>
            <div className={styles.tile}>
              <div className={styles.tileK}>{t('JVM 堆最大内存')}</div>
              <div className={styles.tileV}>{snapshot?.jvmHeapMax ?? '--'}</div>
              <div className={styles.tileS}>
                {snapshot ? t('已用 {{used}}', { used: snapshot.jvmHeapUsed ?? '' }) : '--'}
              </div>
            </div>
            <div className={styles.tile}>
              <div className={styles.tileK}>{t('磁盘分区')}</div>
              <div className={styles.tileV}>{disks ? t('{{count}} 个', { count: disks.length }) : '--'}</div>
              <div className={styles.tileS}>
                {diskAvg !== null
                  ? t('平均使用率 {{value}} %', { value: diskAvg.toFixed(1) })
                  : t('暂无分区数据')}
              </div>
            </div>
          </div>
          <div className={`${styles.panel} ${styles.trendPanel}`}>
            <div className={styles.panelTitle}>
              {t('资源使用趋势')}
              <div className={styles.legend}>
                {trendSeries.map((s, i) => (
                  <span className={styles.legendItem} key={s.key}>
                    <i className={styles.legendLine} style={{ background: s.color }} />
                    {/* 图例行内只放短名 + 当前值；完整名称在悬浮提示中展示 */}
                    {i === 0 ? 'CPU' : i === 1 ? t('内存') : 'JVM'}
                    <b>{fmtPct(i === 0 ? cpu : i === 1 ? mem : jvm)}</b>
                  </span>
                ))}
              </div>
            </div>
            <ResourceTrendChart
              points={hist}
              series={trendSeries}
              collectingText={t('正在采集数据…')}
              theme={resolvedTheme}
              onTip={showTip}
              onTipHide={hideTip}
            />
            <div className={styles.trendFoot}>
              {t('每 {{seconds}} 秒采样 · 窗口约 {{minutes}} 分钟 · {{source}} · 悬停查看逐点数值', {
                seconds: POLL_BASE_INTERVAL_MS / 1000,
                minutes: Math.round((MAX_HIST * POLL_BASE_INTERVAL_MS) / 60000),
                source: trendFootSource,
              })}
            </div>
          </div>
        </section>

        {/* 右列：JVM + 磁盘 */}
        <section className={styles.col}>
          <div className={styles.panel}>
            <div className={styles.panelTitle}>{t('JVM 堆内存')}</div>
            <div className={styles.gaugeWrap}>
              <ResourceGauge name={t('JVM 堆使用率')} value={jvm} />
            </div>
            <div className={styles.gaugeFoot}>
              <div className={styles.mini}>
                <span className={styles.miniK}>{t('堆最大')}</span>
                <span className={styles.miniV}>{snapshot?.jvmHeapMax ?? '--'}</span>
              </div>
              <div className={styles.mini}>
                <span className={styles.miniK}>{t('堆已用')}</span>
                <span className={styles.miniV}>{snapshot?.jvmHeapUsed ?? '--'}</span>
              </div>
              <div className={styles.mini}>
                <span className={styles.miniK}>{t('状态')}</span>
                {renderChip(jvm)}
              </div>
            </div>
          </div>
          <div className={`${styles.panel} ${styles.diskPanel}`}>
            <div className={styles.panelTitle}>{t('磁盘分区')}</div>
            <DiskPanel disks={disks} onTip={showTip} onTipHide={hideTip} />
          </div>
        </section>
      </main>

      {/* 页面级悬浮提示（趋势图与磁盘行共用） */}
      {tip && (
        <div className={styles.globalTip} ref={tipRef} style={{ left: tipPos.left, top: tipPos.top }}>
          <div className={styles.globalTipTitle}>{tip.title}</div>
          {tip.rows.map((r, i) => (
            <div className={styles.globalTipRow} key={i}>
              <span className={styles.tipColor} style={{ background: r.color }} />
              <span className={styles.tipName}>{r.name}</span>
              <span className={styles.tipValue}>{r.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* 表格视图（当前快照的表格等价呈现，Apex data 模式） */}
      <SnapshotTableModal
        open={tableOpen}
        snapshot={snapshot}
        lastSuccessAt={lastSuccessAt}
        sourceText={mode === 'live' ? t('实时接口') : t('连接失败')}
        onClose={() => setTableOpen(false)}
      />
    </div>
  )
}
