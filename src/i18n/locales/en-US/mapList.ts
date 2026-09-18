/**
 * en-US · mapList 命名空间（P09 地图列表页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译，逐条沿用；插值语法按本项目
 * i18next 默认双花括号（旧项目为单花括号拼接，值侧同步改写）；
 * 样板升级新增文案（删除确认影响、传输进度行、G07 拉取禁用说明等）
 * 按旧真译风格补译；公共词与 P08 vehicleAlarmCode 分片对齐。
 */

export default {
  // 列表列与筛选
  '地图名称': 'Map Name',
  '地图标识': 'Map ID',
  '地图状态': 'Map Status',
  '启用': 'Enabled',
  '禁用': 'Disabled',
  '当前版本': 'Current Version',
  '楼层': 'Floor',
  '更新人': 'Updated By',
  '更新时间': 'Updated',
  '操作': 'Action',
  '根据(名称/标识)查询': 'Search by Name/ID',
  '查询': 'Query',
  // 工具行
  '创建地图': 'Create Map',
  '导入调度地图': 'Import Dispatch Map',
  '导入车载地图': 'Import Vehicle Map',
  '拉取地图': 'Pull Map',
  '地图拉取接口暂未在服务契约中提供，入口保留待后端确认后开放':
    'The map pull API is not yet provided in the service contract; this entry stays disabled until confirmed by the backend',
  // 行操作与删除确认
  '编辑': 'Edit',
  '删除': 'Delete',
  '版本管理': 'Version Management',
  '删除地图': 'Delete Map',
  '删除影响：该地图及其全部版本数据将被永久删除，且不可恢复':
    'Impact: the map and all its version data will be permanently deleted and cannot be recovered',
  '删除地图成功': 'Map deleted successfully',
  '删除地图出错：{{msg}}': 'Error deleting map: {{msg}}',
  // 创建/编辑地图弹窗（地图名称/地图状态/楼层复用列表列词条）
  '编辑地图': 'Edit Map',
  '请输入地图名称!': 'Please enter map name!',
  '请输入地图名称': 'Please enter map name',
  '请选择地图状态!': 'Please select map status!',
  '请选择地图状态': 'Please select map status',
  '请输入地图所属楼层!': 'Please enter map floor!',
  '请输入地图所属楼层': 'Please enter map floor',
  '创建地图成功': 'Map created successfully',
  '创建地图出错：{{msg}}': 'Error creating map: {{msg}}',
  '更新地图信息成功': 'Map info updated successfully',
  '更新地图信息出错：{{msg}}': 'Error updating map info: {{msg}}',
  '清空': 'Clear',
  '确定': 'Confirm',
  '取消': 'Cancel',
  // 导入（真实进度）
  '上传地图成功，请前往版本管理中发布该地图':
    'Map uploaded successfully. Please go to Version Management to publish it',
  '上传地图出错：{{msg}}': 'Error uploading map: {{msg}}',
  '上传车载地图成功': 'Vehicle map uploaded successfully',
  '上传车载地图出错：{{msg}}': 'Failed to upload vehicle map: {{msg}}',
  '仅支持 {{ext}} 格式的文件': 'Only {{ext}} files are supported',
  '导入结果未知（本机已取消等待）': 'Import result unknown (local wait cancelled)',
  // 在途传输进度行（与 P08 vehicleAlarmCode 分片同词）
  '传输完成，等待服务器处理：{{name}}': 'Transfer completed, waiting for the server: {{name}}',
  '正在传输 {{name}}：{{percent}}%': 'Transferring {{name}}: {{percent}}%',
  '正在传输 {{name}}：已传输 {{loaded}} 字节': 'Transferring {{name}}: {{loaded}} bytes transferred',
  // 版本管理弹窗
  '版本号': 'Version',
  '是否发布': 'Published',
  '是': 'Yes',
  '否': 'No',
  '备注': 'Remark',
  '来源版本': 'Source Version',
  '创建人': 'Created By',
  '创建时间': 'Created',
  '搜索版本号/备注': 'Search version no./remark',
  '发布版本': 'Publish Version',
  '发布后将替换当前线上地图数据': 'Publishing will replace the current online map data',
  '发布版本成功': 'Version published successfully',
  '发布版本出错：{{msg}}': 'Failed to publish version: {{msg}}',
  '发布': 'Publish',
  '推送': 'Push',
  '下载': 'Download',
  '下载地图文件出错：{{msg}}': 'Failed to download map file: {{msg}}',
  '响应不是有效的地图文件': 'The response is not a valid map file',
  '下载地图文件失败': 'Failed to download map file',
  '地图': 'Map',
  '未知版本': 'Unknown Version',
  // 推送版本弹窗
  '推送地图版本': 'Push Map Version',
  '选择车辆': 'Select Vehicle',
  '未选车辆': 'Unselected Vehicles',
  '已选车辆': 'Selected Vehicles',
  '推送SLAM底图': 'Push SLAM Base Map',
  '开': 'On',
  '关': 'Off',
  '请至少选择一辆车辆': 'Please select at least one vehicle',
  '确认推送': 'Confirm Push',
  '推送版本成功': 'Version pushed successfully',
  '推送版本出错：{{msg}}': 'Failed to push version: {{msg}}',
  '获取车辆列表出错：{{msg}}': 'Failed to get vehicle list: {{msg}}',
}
