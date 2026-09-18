/**
 * 完整任务详情页（P38，/order-info）。
 *
 * 旧实现：OrderInfo/index.tsx——主体 Descriptions（column=3）+ mission 服务端
 * 分页 antd Table + ExpandedActions 动作展开子表；orderKey 取自整段 query
 * （location.search.substring(1) 裸值形态），无返回按钮、无轮询（普通查询纪律）。
 *
 * 形态决策（D08/规格 7：详情默认工作区页签，提供独立窗口入口）：
 * - 本路由位于受保护根内（definitions.tsx order-info），直访或导航进入时
 *   作为工作区页签打开；不同任务编号的 search 不同 → 页签 key 不同 →
 *   自动获得独立页签、独立缓存实例与独立请求 scope（实体页签隔离）；
 * - 「独立窗口」按钮经 openStandaloneWindow 打开同一路径：新窗口走同一
 *   认证+权限守卫，会话/语言/主题来自持久化，同实体复用同一窗口；
 * - 业务实现（主体+子任务表+动作子表）复用 OrderDetailPanel，与列表
 *   快速预览弹窗共用（快速预览不替代完整详情路由）。
 *
 * 状态区分（专项验收）：
 * - 缺参数：StateBlock gap 呈现明确反馈，不发起空参请求；
 * - 无权限：路由守卫按 order-record:view 拦截（meta.perm）；
 * - 会话过期：请求层 1000000 单飞收敛跳登录（公共机制）；
 * - 任务不存在/查询失败：后端业务拒绝经 ApiError 呈现真实 message
 *   （不伪造「不存在」判定），表格区域 Apex 内建错误+重试。
 */

import { useCallback } from 'react'
import { App, Button, Typography } from 'antd'
import { ExternalLink } from 'lucide-react'
import { useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { StateBlock } from '@/components/StateBlock/StateBlock'
import { ROUTE_PATHS } from '@/router/definitions'
import { openStandaloneWindow } from '@/utils/window/standaloneWindow'
import { OrderDetailPanel } from '@/features/order-detail/components/OrderDetailPanel'
import { parseOrderInfoSearch } from '@/features/order-detail/orderDetailNavigation'
import styles from './OrderInfo.module.css'

export default function OrderInfo() {
  // 详情字段文案沿用 orderRecord 命名空间（P03 旧真译四语言）；P38 新增页面文案
  // （独立窗口/缺参数）走 orderInfo 命名空间。本项目 nsSeparator=false（中文 key
  // 即文案），t() 不得带「ns:」前缀；nsMode='fallback' 按数组顺序跨命名空间查 key。
  const { t } = useTranslation(['orderRecord', 'orderInfo'], { nsMode: 'fallback' })
  const { message } = App.useApp()
  const location = useLocation()

  // 解析实体定位参数（命名 orderKey 标准 + 历史裸值兼容，见 orderDetailNavigation）
  const parsed = parseOrderInfoSearch(location.search)

  /**
   * 打开独立窗口：同一路径 + 实体参数，新窗口同守卫同会话；
   * 浏览器拦截弹窗时返回 false，给出可读提示而不是静默失败。
   */
  const handleOpenStandalone = useCallback(() => {
    if (!parsed) return
    const opened = openStandaloneWindow(ROUTE_PATHS['order-info'], {
      orderKey: parsed.orderKey,
    })
    if (!opened) {
      message.warning(t('打开独立窗口失败，请允许浏览器弹窗后重试'))
    }
  }, [parsed, message, t])

  // 缺参数：明确反馈进入方式，与查询失败/无权限/空数据分开呈现
  if (!parsed) {
    return (
      <div className={styles.page}>
        <StateBlock variant="gap" description={t('缺少任务编号参数')} />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* 紧凑工具栏：页面标题 + 当前任务编号（可复制，多页签场景可辨识）+ 独立窗口入口 */}
      <div className={styles.toolbar}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>{t('订单详情')}</span>
          <Typography.Text type="secondary" copyable={{ text: parsed.orderKey }} ellipsis>
            {parsed.orderKey}
          </Typography.Text>
        </div>
        <Button icon={<ExternalLink size={14} />} onClick={handleOpenStandalone}>
          {t('独立窗口')}
        </Button>
      </div>
      {/* 详情业务组件：单请求喂主体+子任务表；表格在剩余空间弹性撑满（内部滚动） */}
      <div className={styles.body}>
        <OrderDetailPanel orderKey={parsed.orderKey} descriptionsColumn={3} missionTableHeight="fill" />
      </div>
    </div>
  )
}
