/**
 * en-US · vehicleAlarmCode 命名空间（P08 告警码管理页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译，逐条沿用；插值语法按本项目
 * i18next 默认双花括号（旧项目为单花括号，值侧同步改写）；
 * 样板升级新增文案（传输进度行、删除确认影响等）按旧真译风格补译。
 */

export default {
  // 列表列与筛选
  '告警码': 'Alarm Code',
  '告警描述': 'Description',
  '创建时间': 'Created',
  '操作': 'Action',
  '查询': 'Query',
  '请输入告警码查询': 'Search by alarm code',
  // 工具行
  '新增告警码': 'Add Alarm Code',
  '上传告警码文件': 'Upload File',
  '下载告警码文件': 'Download File',
  // 行操作与删除确认
  '编辑': 'Edit',
  '删除': 'Delete',
  '删除车辆告警码': 'Delete Alarm Code',
  '删除影响：该告警码将从系统移除，车辆上报告警时将不再展示其描述与处理建议':
    'Impact: the alarm code will be removed from the system; reported alarms will no longer show its description or suggestion',
  '删除车辆告警码成功': 'Alarm code deleted',
  '删除车辆告警码出错：{{msg}}': 'Failed to delete alarm code: {{msg}}',
  // 上传（全量覆盖）
  '上传将全量覆盖': 'Upload Overwrites All',
  '上传后将用文件内容覆盖当前所有车辆告警码，是否继续？':
    'This will overwrite all current alarm codes with the file content. Continue?',
  '继续上传': 'Continue Upload',
  '仅支持 .xlsx / .xls 格式的文件': 'Only .xlsx / .xls files are supported',
  '上传车辆告警码文件成功': 'File uploaded',
  '上传车辆告警码文件出错：{{msg}}': 'Failed to upload file: {{msg}}',
  '上传车辆告警码文件失败': 'Failed to upload file',
  // 下载
  '下载车辆告警码文件成功': 'File downloaded',
  '下载车辆告警码文件出错：{{msg}}': 'Failed to download file: {{msg}}',
  '下载车辆告警码文件失败': 'Failed to download file',
  '车辆告警码.xlsx': 'AlarmCodes.xlsx',
  // 传输进度行（真实进度，本页签在途传输）
  '正在传输 {{name}}：{{percent}}%': 'Transferring {{name}}: {{percent}}%',
  '正在传输 {{name}}：已传输 {{loaded}} 字节': 'Transferring {{name}}: {{loaded}} bytes transferred',
  '传输完成，等待服务器处理：{{name}}': 'Transfer completed, waiting for the server: {{name}}',
  // 新增/编辑弹窗
  '新增车辆告警码': 'Add Alarm Code',
  '编辑车辆告警码': 'Edit Alarm Code',
  '创建车辆告警码成功': 'Alarm code created',
  '创建车辆告警码出错：{{msg}}': 'Failed to create alarm code: {{msg}}',
  '更新车辆告警码成功': 'Alarm code updated',
  '更新车辆告警码出错：{{msg}}': 'Failed to update alarm code: {{msg}}',
  '请输入告警码': 'Please enter alarm code',
  '多语言描述': 'Multilingual Description',
  '语言': 'Language',
  '请选择语言': 'Please select language',
  '删除该语言': 'Remove this language',
  '请输入告警描述': 'Please enter description',
  '处理建议': 'Suggestion',
  '请输入处理建议（选填）': 'Please enter suggestion (optional)',
  '添加多语言描述': 'Add Multilingual Description',
  // 弹窗底部
  '清空': 'Clear',
  '确定': 'Confirm',
  '取消': 'Cancel',
}
