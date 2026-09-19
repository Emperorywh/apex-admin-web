/**
 * en-US · systemVersion 命名空间（P25 版本管理页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译，逐条沿用（列表列/类型/操作/重启/回滚/
 * 上传进度/ETA 单位）；「确认删除该待升级版本?」及下载弹窗取消类文案在旧资源
 * 缺失（<MISSING>），按旧真译风格补译；错误反馈改为 {{msg}} 插值形态；
 * 旧 ETA 插值「{n} s」为单花括号形态，i18next 下不替换，统一改 {{n}}（P22 同款）。
 */

export default {
  // 列表列
  '版本类型': 'Version Type',
  '提交描述': 'Commit Description',
  'Git标签': 'Git Tag',
  '提交信息': 'Commit Message',
  '提交时间': 'Commit Time',
  '构建时间': 'Build Time',
  '操作': 'Action',
  // 版本类型
  '当前版本': 'Current Version',
  '备份版本': 'Backup Version',
  '待升级': 'Pending',
  // 行操作与工具行
  '下载': 'Download',
  '回滚': 'Rollback',
  '删除': 'Delete',
  '重启程序': 'Restart Program',
  // 重启确认与反馈
  '确认重启程序?': 'Confirm restart program?',
  '重启前请确认是否具备重启条件！（危险操作）':
    'Please confirm restart conditions before proceeding! (Dangerous Operation)',
  '重启程序成功': 'Program restarted successfully',
  '重启程序出错：{{msg}}': 'Failed to restart program: {{msg}}',
  // 回滚确认与反馈
  '确认回滚到当前版本?': 'Confirm rollback to this version?',
  '回滚前请确认是否具备回滚条件！（危险操作）':
    'Please confirm rollback conditions before proceeding! (Dangerous Operation)',
  '正在回滚版本，请稍候...': 'Rolling back version, please wait...',
  '回滚版本成功': 'Version rolled back successfully',
  '回滚版本出错：{{msg}}': 'Failed to rollback version: {{msg}}',
  // 删除确认与反馈
  '确认删除该待升级版本?': 'Confirm delete of this pending version?',
  '删除影响：该待升级版本包将被删除，且不可恢复':
    'Impact: this pending version package will be deleted and cannot be recovered',
  '删除待升级版本成功': 'Pending version deleted successfully',
  '删除待升级版本出错：{{msg}}': 'Failed to delete pending version: {{msg}}',
  // 上传（更新版本包）
  '更新版本包': 'Update Version Package',
  '仅支持上传 .zip 格式的版本包': 'Only .zip version packages are supported',
  '更新版本包成功': 'Version package updated successfully',
  '更新版本包出错：{{msg}}': 'Failed to update version package: {{msg}}',
  '正在上传版本包': 'Uploading version package',
  '取消上传': 'Cancel Upload',
  '确认取消上传？': 'Cancel upload?',
  '已上传的部分将被丢弃，需要重新选择文件上传。':
    'The uploaded portion will be discarded. You need to select the file again.',
  '继续上传': 'Continue Upload',
  '已取消上传': 'Upload cancelled',
  '上传完成': 'Upload completed',
  '上传完成，等待服务器处理版本包，请勿关闭页面...':
    'Upload completed, waiting for the server to process the version package, please do not close the page...',
  '版本包上传中，请勿关闭页面...': 'Uploading version package, please do not close the page...',
  // 传输速度与剩余时间（旧 {n} 单花括号形态改为 i18next {{n}}）
  '剩余': 'Remaining',
  '{{n}} 秒': '{{n}} s',
  '{{n}} 分': '{{n}} min',
  // 下载（真实进度弹窗，替代旧伪进度）
  '正在下载版本包': 'Downloading version package',
  '版本包下载中，请勿关闭页面...': 'Downloading version package, please do not close the page...',
  '版本包下载完成': 'Download complete',
  '下载版本包出错：{{msg}}': 'Failed to download version package: {{msg}}',
  '取消下载': 'Cancel Download',
  '确认取消下载？': 'Cancel download?',
  '已下载的部分将被丢弃，可重新点击下载。':
    'The downloaded portion will be discarded. You can click download again.',
  '继续下载': 'Continue Download',
  '已取消下载': 'Download cancelled',
}
