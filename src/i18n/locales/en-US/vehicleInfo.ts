/**
 * 完整车辆详情页命名空间（P39，en-US）。
 * 覆盖 /vehicle-info 页面全部文案：详情标签/枚举值文案（旧真译沿用，源自旧系统
 * 车辆详情页 t() 消费的 orderRefer 标签与 RobotStatus/eStops 等枚举资源）+
 * P39 形态新增文案（独立窗口/缺参数/不存在反馈，与 orderInfo 分片同风格）。
 * zh-CN 不维护资源文件（中文 key 即文案）。
 */

export default {
  // ── 页面（P39 形态） ──
  // 页面工具栏标题（旧页面 Descriptions title 同名 key，旧真译沿用）
  '车辆详情': 'Vehicle Details',
  // 独立窗口按钮（与 orderInfo 分片同款文案，分片自包含不互相依赖）
  '独立窗口': 'Standalone Window',
  // 独立窗口被浏览器拦截时的可读提示
  '打开独立窗口失败，请允许浏览器弹窗后重试':
    'Failed to open the standalone window. Allow pop-ups for this site and try again.',
  // 缺参数态：/vehicle-info 无有效定位参数时的明确反馈
  '缺少车辆编号参数': 'Missing vehicle ID parameter. Open this page from the vehicle list.',
  // 车辆不存在：与任务详情同族的 data=null 语义（联验实证后呈现）
  '车辆不存在或已被删除': 'Vehicle not found or already deleted.',
  // 详情抽屉「完整详情」入口（与 orderInfo 分片同款文案）
  '完整详情': 'Full Details',
  // 查询失败状态文本（旧 message 前缀沿用，后接真实错误信息）
  '查询车辆信息出错': 'Error querying vehicle info: ',

  // ── 详情字段标签（旧 orderRefer 既有真译沿用；x/y 无映射显示原字段名，不进分片） ──
  '车辆唯一标识': 'Vehicle Unique ID',
  '车辆名称': 'Vehicle Name',
  '类型': 'Type',
  '订单编号': 'Order No.',
  '订单名称': 'Order Name',
  '订单状态': 'Order Status',
  '连接状态': 'Connection Status',
  '安全域状态': 'Safety Zone Status',
  '紧急停车': 'Emergency Stop',
  '电量（%）': 'Battery (%)',
  '电池电压（v）': 'Battery Voltage (V)',
  '电池健康状态': 'Battery Health',
  '充电中': 'Charging',
  '电池电流(a)': 'Battery Current (A)',
  '长度（m）': 'Length (m)',
  '宽度（m）': 'Width (m)',
  '偏移距离（m）': 'Offset (m)',
  '载货长度（m）': 'Load Length (m)',
  '载货宽度（m）': 'Load Width (m)',
  '车辆的旋转弧度': 'Rotation (rad)',
  '地图唯一标识': 'Map Unique ID',
  '地图名称': 'Map Name',
  '是否开启了定位': 'Positioning Enabled',
  '定位置信度': 'Loc. Score',
  '定位偏差范围值': 'Positioning Deviation Range',
  'agv坐标是否正常': 'AGV Coordinates Normal',
  '车辆执行状态': 'Vehicle Exec Status',
  '调度状态': 'Dispatch Status',
  '暂停状态': 'Paused',
  '载货': 'Loaded',
  '创建时间': 'Created',

  // ── 枚举/布尔值文案（旧 RobotStatus/eStops/DispatchState/OrderStatus 等既有真译沿用） ──
  '异常': 'Error',
  '正常': 'Normal',
  '已开启': 'On',
  '未开启': 'Off',
  '已暂停': 'Paused',
  '未暂停': 'Not Paused',
  '暂停': 'Paused',
  '是': 'Yes',
  '否': 'No',
  '在线': 'Online',
  '离线': 'Offline',
  '连接中断': 'Disconnected',
  '避障': 'Avoiding',
  '抱闸': 'Brake',
  '急停': 'Emergency Stop',
  '启用': 'Enabled',
  '禁用': 'Disabled',
  '空闲': 'Idle',
  '交管': 'Traffic',
  '执行中': 'Processing',
  '充电': 'Charging',
  '小车': 'AGV',
  '叉车': 'Forklift',
  '队列中': 'Queued',
  '队列外': 'Out of Queue',
  '挂起': 'Suspended',
  '取消': 'Cancel',
  '成功': 'Success',
  '失败': 'Failed',
}
