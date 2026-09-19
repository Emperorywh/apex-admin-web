/**
 * en-US · dispatchConfig 命名空间（P13 调度中心页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译，逐条沿用（列头/占位/确认标题/保存反馈），
 * 插值统一改 {{var}} 双花括号；冲突中止与重置影响说明为样板升级补译（按旧真译风格）；
 * 「保存」等公共词在 common 命名空间，本分片不重复。
 */

export default {
  // 表格列
  '配置名称': 'Config Name',
  '默认值': 'Default Value',
  '配置值': 'Config Value',
  '配置值范围': 'Value Range',
  '配置值单位': 'Unit',
  // 编辑占位
  '请输入配置值': 'Please enter config value',
  '请选择配置值': 'Please select config value',
  // 动作与草稿标签
  '重置': 'Reset',
  '调度参数': 'Dispatch parameters',
  // 保存确认与反馈
  '确定保存当前页调度参数吗?': 'Save current dispatch parameters?',
  '将保存「{{tab}}」分类下全部 {{count}} 项调度参数（含未修改项），保存后立即生效':
    'All {{count}} dispatch parameters in "{{tab}}" (including unchanged ones) will be saved and take effect immediately',
  '保存调度参数成功': 'Dispatch parameters saved successfully',
  '保存调度参数出错：{{msg}}': 'Error saving dispatch parameters: {{msg}}',
  // 预读冲突中止（G13：并发编辑不做无条件覆盖）
  '配置已被其他用户修改，保存已中止，请核对后重试：{{keys}}':
    'The configuration has been modified by another user; save aborted. Please review and retry: {{keys}}',
  // 重置（草稿回退到最近一次确认保存的基线）确认
  '确定要重置当前页调度参数吗?': 'Reset current dispatch parameters?',
  '将放弃「{{tab}}」分类下 {{count}} 项未保存修改，回到最近一次保存的值，该操作无法恢复':
    '{{count}} unsaved changes in "{{tab}}" will be discarded and revert to the last saved values; this cannot be undone',
}
