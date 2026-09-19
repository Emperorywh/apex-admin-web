/**
 * en-US · database-backup 命名空间（P30 数据库备份页私有文案）。
 * 旧系统 en-US 真译逐条沿用（列头/库选择/查询反馈）；「{msg}」前缀拼接改为
 * i18next 的 {{msg}} 插值形态（P25 沉淀）；下载弹窗类文案旧资源缺失，按旧真译
 * 风格补译并与 systemVersion（P25）下载术语对齐。
 */

export default {
  // 库选择与反馈
  '备份数据库：': 'Backup Database: ',
  '请选择备份数据库': 'Please select a backup database',
  '请先选择数据库': 'Please select a database first',
  '查询备份数据库出错：{{msg}}': 'Failed to query backup databases: {{msg}}',
  '查询备份文件出错：{{msg}}': 'Failed to query backup files: {{msg}}',
  // 列表列
  '文件名': 'File Name',
  '文件大小': 'File Size',
  '创建时间': 'Created',
  '路径': 'Path',
  '操作': 'Action',
  // 行操作
  '下载': 'Download',
  // 下载（真实进度弹窗）
  '正在下载备份文件': 'Downloading backup file',
  '备份文件下载中，请勿关闭页面...': 'Downloading backup file, please do not close the page...',
  '备份文件下载完成': 'Backup file download complete',
  '下载备份文件出错：{{msg}}': 'Failed to download backup file: {{msg}}',
  '取消下载': 'Cancel Download',
  '确认取消下载？': 'Cancel download?',
  '已下载的部分将被丢弃，可重新点击下载。':
    'The downloaded portion will be discarded. You can click download again.',
  '继续下载': 'Continue Download',
  '已取消下载': 'Download cancelled',
  // 传输速度与剩余时间
  '剩余': 'Remaining',
  '{{n}} 秒': '{{n}} s',
  '{{n}} 分': '{{n}} min',
} as const
