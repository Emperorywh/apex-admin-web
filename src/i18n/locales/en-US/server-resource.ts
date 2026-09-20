/**
 * 服务器资源监控页命名空间（P40，en-US）。
 * 覆盖 /analyze-visual/server-resource-monitor 页面全部文案：旧系统该页 en-US
 * 真译逐条沿用（React Intl 单花括号插值已改写为 i18next 双花括号，AGENTS §6）；
 * 新形态新增文案（全屏/独立窗口等，独立窗口术语与 orderInfo/vehicleInfo 分片同款）。
 * zh-CN 不维护资源文件（中文 key 即文案）。
 */

export default {
  // ── 页面与工具栏 ──
  // 页面标题：新形态为工作区页签监控页，措辞「服务器资源监控」（旧大屏措辞
  // 「Server Resource Monitor」沿用，去掉「大屏/大屏幕」语义）
  '服务器资源监控': 'Server Resource Monitor',
  // 连接状态徽标（旧真译沿用）
  '实时数据': 'Live',
  '连接失败': 'Disconnected',
  '连接中…': 'Connecting…',
  // 工具栏形态入口（独立窗口与 orderInfo/vehicleInfo 分片同款文案）
  '独立窗口': 'Standalone Window',
  '打开独立窗口失败，请允许浏览器弹窗后重试':
    'Failed to open the standalone window. Allow pop-ups for this site and try again.',
  '全屏': 'Fullscreen',
  '退出全屏': 'Exit Fullscreen',
  // Fullscreen API 不可用（iframe 无授权等）时的禁用说明 / 被拒绝提示
  '当前环境不支持全屏显示': 'Fullscreen is not available in the current environment',
  '浏览器拒绝了全屏请求': 'The browser rejected the fullscreen request',
  // 数据表格入口（旧真译沿用）
  '数据表格': 'Data Table',
  '以表格形式查看当前快照（无障碍视图）': 'View the current snapshot as a table (accessible view)',

  // ── 仪表面板 ──
  'CPU 使用率': 'CPU Usage',
  '系统内存': 'System Memory',
  '内存使用率': 'Memory Usage',
  'JVM 堆内存': 'JVM Heap Memory',
  'JVM 堆使用率': 'JVM Heap Usage',
  '逻辑核心': 'Logical Cores',
  '负载状态': 'Load Status',
  '总内存': 'Total',
  '已用': 'Used',
  '空闲': 'Idle',
  '堆最大': 'Heap Max',
  '堆已用': 'Heap Used',
  '状态': 'Status',

  // ── 指标卡 ──
  'CPU 核心数': 'CPU Cores',
  '{{count}} 核': '{{count}} cores',
  '逻辑处理器数量': 'Logical processor count',
  '系统内存总量': 'Total System Memory',
  '已用 {{used}} · 空闲 {{free}}': 'Used {{used}} · Free {{free}}',
  'JVM 堆最大内存': 'JVM Heap Max Memory',
  '已用 {{used}}': 'Used {{used}}',
  '磁盘分区': 'Disk Partitions',
  '{{count}} 个': '{{count}}',
  '平均使用率 {{value}} %': 'Avg usage {{value}} %',
  '暂无分区数据': 'No partition data',

  // ── 趋势图 ──
  '资源使用趋势': 'Resource Usage Trend',
  // 图例短名（序列第二项）
  '内存': 'Mem',
  '正在采集数据…': 'Collecting data…',
  '实时接口数据': 'live API data',
  '连接失败，等待重试': 'connection lost, retrying',
  '每 {{seconds}} 秒采样 · 窗口约 {{minutes}} 分钟 · {{source}} · 悬停查看逐点数值':
    'Sampling every {{seconds}}s · ~{{minutes}}min window · {{source}} · hover for values',

  // ── 磁盘面板 ──
  '暂无磁盘数据': 'No disk data',
  '使用率': 'Usage',
  '已用 / 总量': 'Used / Total',
  '已用 {{used}} / 共 {{total}} · 空闲 {{free}}': 'Used {{used}} / Total {{total}} · Free {{free}}',

  // ── 快照表格弹窗 ──
  '实时数据表格': 'Realtime Data Table',
  '指标': 'Metric',
  '当前值': 'Current',
  '详情': 'Details',
  '最近更新：{{time}} · 数据源：{{source}}': 'Last updated: {{time}} · Source: {{source}}',
  '实时接口': 'live API',
  '磁盘 {{name}}': 'Disk {{name}}',
  '设备 {{device}} · 总 {{total}} · 已用 {{used}} · 空闲 {{free}}':
    'Device {{device}} · Total {{total}} · Used {{used}} · Free {{free}}',
  '{{cores}} 逻辑核心 · 状态 {{status}}': '{{cores}} logical cores · {{status}}',
  '系统内存使用率': 'System Memory Usage',
  '总 {{total}} · 已用 {{used}} · 空闲 {{free}}': 'Total {{total}} · Used {{used}} · Free {{free}}',
  '最大 {{max}} · 已用 {{used}} · 状态 {{status}}': 'Max {{max}} · Used {{used}} · {{status}}',

  // ── 严重程度档位（resourcePolicy.sevOf 文案，旧真译沿用） ──
  '正常': 'Normal',
  '偏高': 'High',
  '危险': 'Critical',
}
