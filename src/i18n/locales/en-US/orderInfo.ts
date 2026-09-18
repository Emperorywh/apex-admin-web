/**
 * 任务详情页命名空间（P38，en-US）。
 * 覆盖 /order-info 页面级新增文案；详情字段/表格文案走 orderRecord 命名空间
 * （P03 已交付四语言旧真译，弹窗与完整页共用）。
 * 旧系统 /order-info 页面无独立语言资源（文案与详情弹窗同 key），本分片为
 * P38 形态新增（完整详情入口/独立窗口/缺参数反馈），无旧 key 需要映射。
 */

export default {
  // 详情弹窗「完整详情」按钮：关闭弹窗并在工作区页签打开 /order-info
  '完整详情': 'Full Details',
  // 完整详情页工具栏按钮：经独立窗口打开同一路径（同守卫同会话）
  '独立窗口': 'Standalone Window',
  // 缺参数态：/order-info 无有效定位参数时的明确反馈
  '缺少任务编号参数': 'Missing order ID parameter. Open this page from the order record list.',
  // 任务不存在：后端对未知编号返回 code=200 + data=null（2026-09-18 实证），
  // 主体缺失时的明确反馈，与查询失败/空列表分开
  '任务不存在或已被删除': 'Order not found or already deleted.',
  // 独立窗口被浏览器拦截时的可读提示
  '打开独立窗口失败，请允许浏览器弹窗后重试':
    'Failed to open the standalone window. Allow pop-ups for this site and try again.',
}
