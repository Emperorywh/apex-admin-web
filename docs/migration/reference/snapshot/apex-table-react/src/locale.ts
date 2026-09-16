import type { ApexLocale } from './types';

/*
 * 内置可见文案和可访问名称集中管理。
 * 数量格式化同样开放，避免其他语言仍混入中文单位。
 * 业务下拉菜单的触发文案由消费方提供，不纳入表格内置文案。
 */
export const zhCN: ApexLocale = {
  tableName: '数据表格', loading: '正在加载…', empty: '暂无数据', noMatches: '没有匹配的结果', noColumns: '没有可见列，请在列设置中选择要显示的列',
  error: '加载失败', retry: '重试', columnSettings: '列设置', close: '关闭', resetLayout: '恢复默认', clearSelection: '清空选择',
  /*
   * 弹窗采用草稿提交，并为拖动、字段编辑提供可访问的说明。
   * 所有新增文字均支持通过 locale 覆盖。
   */
  fieldName: '字段名', pinPosition: '固定位置', displayStatus: '显示状态', settingsHint: '拖动序号调整顺序，可设置列宽、显示状态和固定位置',
  cancel: '取消', confirm: '确定', invalidColumnWidth: '请输入允许范围内的有效列宽', reorderBlocked: '只能在相同固定区域内排序，且不能跨越锁定列',
  dragColumn: '拖动排序', dragInstructions: '按空格开始拖动，使用上下方向键调整顺序，再按空格放下，按 Esc 取消拖动。',
  selectPage: '选择当前页可选行', selectResults: '选择全部筛选结果', rowNumber: '序号', previousPage: '上一页', nextPage: '下一页',
  /*
   * 行详情按钮使用明确的动作名称，支持键盘与读屏操作。
   * 调用方可以通过 locale 单独覆盖这组文字。
   */
  expansion: '行展开', expandRow: '展开行', collapseRow: '收起行',
  pageSize: '每页数量', jumpToPage: '跳至', pageUnit: '页', pinStart: '固定在左侧', pinEnd: '固定在右侧', unpin: '取消固定',
  moveUp: '上移', moveDown: '下移', width: '列宽', showColumn: '显示列', minOneColumn: '至少保留一列业务信息', pinSpace: '固定列需为中间区域保留至少 160px',
  unknownTotal: '未提供准确总数，请替换或隐藏分页控件', unsupportedLayout: '此配置尚无完整界面支持：首版仅支持平铺单层表头',
  invalidGeometry: '尺寸配置无效：行高至少 32px，轨道和列宽必须为有限正数', invalidPagination: '分页参数无效：pageIndex 必须为非负整数，pageSize 必须为正整数', duplicateRowId: '存在空行 ID 或重复行 ID，请配置唯一稳定的 getRowId',
  duplicateColumnId: '存在空列 ID 或重复列 ID，请检查列定义', unmeasurable: '表体需要明确高度或可测量的 flex 容器',
  virtualizationDisabled: '大数据已关闭虚拟化，完整挂载可能影响性能', protectedProp: '插槽不能覆盖受保护的语义、状态或几何属性',
  compact: '紧凑', standard: '标准', comfortable: '宽松', density: '行密度',
  selectRow: (id) => `选择行 ${id}`, sortColumn: (label) => `排序：${label}`, resizeColumn: (label) => `调整列宽：${label}`,
  page: (index) => `第 ${index + 1} 页`, total: (count) => `共 ${count.toLocaleString('zh-CN')} 条`,
  selected: (count) => `已选择 ${count.toLocaleString('zh-CN')} 条`, perPage: (count) => `${count} 条/页`,
};
