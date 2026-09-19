/**
 * en-US · systemLog 命名空间（P26 系统日志页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译，逐条沿用（筛选条件/类型/操作/下载反馈）；
 * 「下载系统日志出错」旧资源为「文案 + err.message 拼接」形态，统一改 {{msg}}
 * 插值（P25 同款修正）；传输行三条与「已取消下载」沿用 P08/P25 既有译法；
 * 「加载失败」与 common 命名空间同词（本页单命名空间，分片内自带）。
 */

export default {
  // 筛选栏
  '日志名称': 'Log Name',
  '请输入日志名称': 'Please enter log name',
  '日志类型': 'Log Type',
  '请选择日志类型': 'Please select log type',
  '开始时间': 'Start Time',
  '请选择日志开始时间': 'Please select log start time',
  '结束时间': 'End Time',
  '请选择日志结束时间': 'Please select log end time',
  '查询': 'Query',
  '清空': 'Clear',
  // 列表列
  '最后修改时间': 'Last Modified',
  // 下载
  '下载日志': 'Download Log',
  '请选择要下载的日志': 'Please select logs to download',
  '日志下载完成': 'Log download completed',
  '下载系统日志出错：{{msg}}': 'Failed to download system log: {{msg}}',
  '已取消下载': 'Download cancelled',
  // 传输行（P08 同形态）
  '正在传输 {{name}}：{{percent}}%': 'Transferring {{name}}: {{percent}}%',
  '正在传输 {{name}}：已传输 {{loaded}} 字节': 'Transferring {{name}}: {{loaded}} bytes transferred',
  '传输完成，等待服务器处理：{{name}}': 'Transfer completed, waiting for the server: {{name}}',
  // 状态文本（与 common 命名空间同词）
  '加载失败': 'Failed to load',
}
