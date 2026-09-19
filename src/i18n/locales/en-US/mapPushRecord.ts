/**
 * en-US · mapPushRecord 命名空间（P12 地图推送记录页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译，逐条沿用（列表列/状态/操作/反馈），
 * 插值统一改 {{var}} 双花括号；确认框影响说明为样板升级补译（按旧真译风格）；
 * 「推送SLAM底图/推送」等公共词与 P09 mapList 分片对齐。
 */

export default {
  // 列表列
  '地图名称': 'Map Name',
  '地图版本': 'Map Version',
  '推送SLAM底图': 'Push SLAM Base Map',
  '推送结果': 'Push Result',
  '创建时间': 'Created',
  '操作': 'Action',
  '是': 'Yes',
  '否': 'No',
  // 推送状态（主表计数 Tag 与子表状态 Tag 共用）
  '等待': 'Waiting',
  '推送中': 'Pushing',
  '失败': 'Failed',
  '成功': 'Success',
  '已取消': 'Cancelled',
  // 记录级操作与命令确认
  '重新推送': 'Re-push',
  '取消推送': 'Cancel Push',
  '重新推送影响：将对该批次下全部车辆重新推送地图 {{mapName}}（{{mapVersion}}），推送结果以列表状态为准':
    'Impact: the map {{mapName}} ({{mapVersion}}) will be re-pushed to all vehicles in this batch; refer to the list status for push results',
  '取消推送影响：将取消该批次下未完成的地图推送，已完成的推送结果不受影响':
    'Impact: unfinished map pushes in this batch will be cancelled; finished push results are not affected',
  // 子表列与筛选
  '车辆名称': 'Vehicle Name',
  '推送状态': 'Push Status',
  '完成时间': 'Finish Time',
  '失败原因': 'Failure Reason',
  '等待原因': 'Waiting Reason',
  '请输入车辆名称': 'Please enter vehicle name',
  '请选择推送状态': 'Please select push status',
  // 子记录级操作与命令确认
  '重推': 'Re-push',
  '重推影响：将向该车辆重新推送地图，推送结果以列表状态为准':
    'Impact: the map will be re-pushed to this vehicle; refer to the list status for the push result',
  // 命令受理反馈（受理 ≠ 完成，最终状态以列表为准）
  '已发起重新推送': 'Re-push initiated',
  '已发起取消推送': 'Cancel push initiated',
  '重新推送出错：{{msg}}': 'Re-push failed: {{msg}}',
  '取消推送出错：{{msg}}': 'Cancel push failed: {{msg}}',
}
