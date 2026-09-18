/**
 * 完整车辆详情页（P39，/vehicle-info）。
 *
 * 旧实现：C:\code\dd src/pages/VehicleInfo/index.tsx——裸值 query 取 vehicleKey，
 * GET getVehicleState 后 transformVehicleInfo 生成三列 Descriptions；失败 message
 * 提示；无轮询、无返回按钮。
 *
 * 形态决策（D08/规格 7，同构 P38 /order-info）：
 * - 本路由位于受保护根内（definitions.tsx vehicle-info），直访或导航进入时
 *   作为工作区页签打开；不同车辆唯一标识的 search 不同 → 页签 key 不同 →
 *   自动获得独立页签、独立缓存实例与独立请求 scope（实体页签隔离）；
 * - 「独立窗口」按钮经 openStandaloneWindow 打开同一路径：新窗口走同一
 *   认证+权限守卫，会话/语言/主题来自持久化，同实体复用同一窗口；
 * - 状态区分：缺参数 StateBlock gap（不发空参请求）；无权限路由守卫按
 *   vehicle-list:view 拦截；会话过期请求层 1000000 单飞收敛；车辆不存在/
 *   查询失败由 Panel 分别呈现（轮询失败自动恢复，无手动刷新按钮）。
 */

import { useCallback } from 'react'
import { App, Button, Typography } from 'antd'
import { ExternalLink } from 'lucide-react'
import { useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { StateBlock } from '@/components/StateBlock/StateBlock'
import { ROUTE_PATHS } from '@/router/definitions'
import { openStandaloneWindow } from '@/utils/window/standaloneWindow'
import { VehicleDetailPanel } from '@/features/vehicle-detail/components/VehicleDetailPanel'
import { parseVehicleInfoSearch } from '@/features/vehicle-detail/vehicleDetailNavigation'
import styles from './VehicleInfo.module.css'

export default function VehicleInfo() {
  // 页面文案走 vehicleInfo 私有命名空间（四语言分片同构）；nsSeparator=false
  //（中文 key 即文案），t() 不带「ns:」前缀（AGENTS 第 6 节纪律）
  const { t } = useTranslation('vehicleInfo')
  const { message } = App.useApp()
  const location = useLocation()

  // 解析实体定位参数（命名 vehicleKey 标准 + 历史裸值兼容，见 vehicleDetailNavigation）
  const parsed = parseVehicleInfoSearch(location.search)

  /**
   * 打开独立窗口：同一路径 + 实体参数，新窗口同守卫同会话；
   * 浏览器拦截弹窗时返回 false，给出可读提示而不是静默失败。
   */
  const handleOpenStandalone = useCallback(() => {
    if (!parsed) return
    const opened = openStandaloneWindow(ROUTE_PATHS['vehicle-info'], {
      vehicleKey: parsed.vehicleKey,
    })
    if (!opened) {
      message.warning(t('打开独立窗口失败，请允许浏览器弹窗后重试'))
    }
  }, [parsed, message, t])

  // 缺参数：明确反馈进入方式，与查询失败/无权限/车辆不存在分开呈现
  if (!parsed) {
    return (
      <div className={styles.page}>
        <StateBlock variant="gap" description={t('缺少车辆编号参数')} />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* 紧凑工具栏：页面标题 + 当前车辆标识（可复制，多页签场景可辨识）+ 独立窗口入口 */}
      <div className={styles.toolbar}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>{t('车辆详情')}</span>
          <Typography.Text type="secondary" copyable={{ text: parsed.vehicleKey }} ellipsis>
            {parsed.vehicleKey}
          </Typography.Text>
        </div>
        <Button icon={<ExternalLink size={14} />} onClick={handleOpenStandalone}>
          {t('独立窗口')}
        </Button>
      </div>
      {/* 详情业务组件：可见轮询喂主体 Descriptions（内容超高时页面内部滚动） */}
      <div className={styles.body}>
        <VehicleDetailPanel vehicleKey={parsed.vehicleKey} descriptionsColumn={3} />
      </div>
    </div>
  )
}
