/**
 * 软件信息页（P29 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\SystemInvolve\SoftwareInformation）等价迁移：
 * - 授权横幅：标题/副标题 + 授权状态 Tag（未知/已过期/即将到期/已激活，派生
 *   语义见 licenseStatus 纯函数）+「激活软件」入口（system:software:activate
 *   按钮码条件渲染隐藏，root 短路全开）；
 * - 两项统计：最大 AGV 数量（授权原文）、剩余授权天数（已过期钳制为 0，
 *   缺失/未知留白——旧版未知显示 0，按空值纪律收敛并登记）；
 * - 四张详情卡：激活日期/过期日期（displayDateTime 单点格式化，缺失留白）、
 *   激活码/硬件信息原文 + 一键复制（copyText 复用 P02 工具，成功才提示）；
 * - 状态呈现分界（P29 专项：读取失败不显示已授权）：
 *   加载中 → Spin；真实失败 → 失败文案（含后端 message），绝不渲染授权卡片；
 *   成功但后端无授权数据 → 「暂无激活信息」空态 + 激活入口；成功有数据 → 卡片；
 *   登录过期（1000000）与授权失效（业务码）由请求层/本页分别呈现，不混同。
 * - 激活弹窗：复用 P02 可复用激活组件 ActivationForm（失败保留输入、真实
 *   code=200 才算成功、不自动重试）；成功后同步会话激活状态（真实业务结果）
 *   并重查授权信息（原地刷新，不跳转——P02 落点导航仅授权页形态）。
 * - 页面无表格（DoD 4 不适用）：无 Apex、无列偏好；无轮询（旧版同语义），
 *   失败恢复依赖页签重新激活自动重查（AGENTS 4：非表格数据块不设手动刷新）。
 * - 权限：菜单码 system:software:view 挂路由守卫；激活按钮码
 *   system:software:activate 控制两处激活入口（横幅 + 空态）。
 */

import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { App, Button, Card, Empty, Modal, Spin, Statistic, Tag, Tooltip } from 'antd'
import {
  CalendarDays,
  Car,
  CircleCheck,
  CircleX,
  Clock,
  Copy,
  KeyRound,
  Monitor,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { ActivationForm } from '@/features/license-activation/components/ActivationForm/ActivationForm'
import { copyTextToClipboard } from '@/features/license-activation/utils/copyText'
import { useLicenseInfo } from '@/features/software-license/hooks/useLicenseInfo'
import {
  deriveLicenseStatus,
  type LicenseStatusKind,
} from '@/features/software-license/utils/licenseStatus'
import { activationConfirmed } from '@/store/slices/authSlice'
import { store } from '@/store/store'
import { displayDateTime } from '@/utils/datetime/datetimeDisplay'
import { PERM_BUTTON, usePermission } from '@/hooks/usePermission'
import styles from './SoftwareInformation.module.css'

/** 状态 Tag 的图标（lucide 对齐目标项目；尺寸对齐 Tag 内文字） */
const STATUS_ICONS: Record<LicenseStatusKind, typeof Clock> = {
  unknown: Clock,
  expired: CircleX,
  expiring: Clock,
  active: CircleCheck,
}

export default function SoftwareInformation() {
  // fallback 顺序：本页私有文案 → common（取消等公共键）；无前缀 key（AGENTS 6）
  const { t } = useTranslation(['software-license', 'common'], { nsMode: 'fallback' })
  const { message } = App.useApp()
  const { hasPerm } = usePermission()
  // 激活入口按钮码（横幅与空态两处共用；无权限条件渲染隐藏，root 短路全开）
  const canActivate = hasPerm(PERM_BUTTON.SYSTEM_SOFTWARE_ACTIVATE)

  const { license, loading, error, reload } = useLicenseInfo()
  const [activationOpen, setActivationOpen] = useState(false)

  // 授权状态派生（纯函数单点：缺失=未知、已过期、≤30 天即将到期、其余已激活）
  const status = useMemo(() => deriveLicenseStatus(license?.expirationDate), [license])

  const openActivation = useCallback(() => setActivationOpen(true), [])
  const closeActivation = useCallback(() => setActivationOpen(false), [])

  /** 激活成功（ActivationForm 内已按后端 code=200 判定并反馈）：同步会话 + 重查 */
  const handleActivated = useCallback(() => {
    // 会话 activated 更新为真实结果（与 P02 同一 action），随后原地重查授权信息
    store.dispatch(activationConfirmed())
    setActivationOpen(false)
    reload()
  }, [reload])

  /** 复制授权字段原文：成功才提示（旧系统同源行为；label 为已翻译字段名） */
  const handleCopy = useCallback(
    async (value: string | undefined, label: string) => {
      if (!value) return
      if (await copyTextToClipboard(value)) {
        void message.success(t('{{label}}已复制', { label }))
      } else {
        void message.error(t('复制失败'))
      }
    },
    [message, t],
  )

  const StatusIcon = STATUS_ICONS[status.kind]

  return (
    <div className={styles.page}>
      <Spin spinning={loading}>
        {/*
         * 三态分界：真实失败 → 失败文案（不含激活入口，避免在未知状态下诱导写操作）；
         * 成功有数据 → 授权卡片；成功无数据 → 空态 + 激活入口（旧版同位）
         */}
        {error ? (
          <div className={styles.stateBlock}>
            <p className={styles.errorText}>
              {t('获取激活信息出错')}
              {error ? `：${error}` : ''}
            </p>
          </div>
        ) : license ? (
          <>
            <Card className={styles.banner} bordered={false}>
              <div className={styles.bannerRow}>
                <div className={styles.bannerLeft}>
                  <span className={styles.bannerIcon}>
                    <ShieldCheck strokeWidth={2} />
                  </span>
                  <div>
                    <div className={styles.bannerTitle}>{t('软件授权信息')}</div>
                    <div className={styles.bannerSubtitle}>
                      {t('当前系统授权状态与激活详情')}
                    </div>
                  </div>
                </div>
                <div className={styles.bannerRight}>
                  <Tag
                    icon={<StatusIcon size={12} strokeWidth={2} />}
                    color={
                      status.kind === 'expired'
                        ? 'error'
                        : status.kind === 'expiring'
                          ? 'warning'
                          : status.kind === 'active'
                            ? 'success'
                            : 'default'
                    }
                  >
                    {status.kind === 'expired'
                      ? t('已过期')
                      : status.kind === 'expiring'
                        ? t('即将到期')
                        : status.kind === 'active'
                          ? t('已激活')
                          : t('未知')}
                  </Tag>
                  {canActivate && (
                    <Button type="primary" ghost icon={<Zap size={13} strokeWidth={2} />} onClick={openActivation}>
                      {t('激活软件')}
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            <div className={styles.statsGrid}>
              <Card bordered={false}>
                <Statistic
                  title={
                    <span className={styles.statTitle}>
                      <Car size={14} strokeWidth={2} /> {t('最大 AGV 数量')}
                    </span>
                  }
                  value={typeof license.agvNumber === 'number' ? license.agvNumber : ''}
                  suffix={t('台')}
                  valueStyle={{ color: 'var(--app-blue-text)' }}
                />
              </Card>
              <Card bordered={false}>
                <Statistic
                  title={
                    <span className={styles.statTitle}>
                      <Clock size={14} strokeWidth={2} /> {t('剩余授权天数')}
                    </span>
                  }
                  value={status.restDays === null ? '' : Math.max(status.restDays, 0)}
                  // Statistic 默认把空串数值化成 0（Number('')=0），缺失必须留白：
                  // formatter 直出原始值，空串原样渲染为空（DoD 14：0≠缺失）
                  formatter={(v) => (v === '' ? '' : v)}
                  suffix={t('天')}
                  valueStyle={{
                    color:
                      status.kind === 'expired'
                        ? 'var(--app-red-text)'
                        : status.kind === 'expiring'
                          ? 'var(--app-yellow-text)'
                          : 'var(--app-green-text)',
                  }}
                />
              </Card>
            </div>

            <div className={styles.detailGrid}>
              <Card bordered={false} title={
                <span className={styles.statTitle}>
                  <CalendarDays size={14} strokeWidth={2} /> {t('激活日期')}
                </span>
              }>
                {/* 后端墙钟字符串经部署时区单点格式化；缺失留白（不显示「-」） */}
                <div className={styles.detailValue}>{displayDateTime(license.issueDate)}</div>
              </Card>
              <Card bordered={false} title={
                <span className={styles.statTitle}>
                  <CalendarDays size={14} strokeWidth={2} /> {t('过期日期')}
                </span>
              }>
                <div className={styles.detailValue}>{displayDateTime(license.expirationDate)}</div>
              </Card>

              <Card
                className={styles.span2}
                bordered={false}
                title={
                  <span className={styles.statTitle}>
                    <KeyRound size={14} strokeWidth={2} /> {t('激活码')}
                  </span>
                }
                extra={
                  <Tooltip title={t('复制激活码')}>
                    <Button
                      type="link"
                      size="small"
                      icon={<Copy size={13} strokeWidth={2} />}
                      disabled={!license.activationCode}
                      onClick={() => handleCopy(license.activationCode, t('激活码'))}
                    >
                      {t('复制')}
                    </Button>
                  </Tooltip>
                }
              >
                {/* 激活码可能很长：定高区域内滚动查看完整内容（旧版同处理） */}
                <div className={styles.codeValue}>{license.activationCode || ''}</div>
              </Card>

              <Card
                className={styles.span2}
                bordered={false}
                title={
                  <span className={styles.statTitle}>
                    <Monitor size={14} strokeWidth={2} /> {t('硬件信息')}
                  </span>
                }
                extra={
                  <Tooltip title={t('复制硬件信息')}>
                    <Button
                      type="link"
                      size="small"
                      icon={<Copy size={13} strokeWidth={2} />}
                      disabled={!license.hardwareInfo}
                      onClick={() => handleCopy(license.hardwareInfo, t('硬件信息'))}
                    >
                      {t('复制')}
                    </Button>
                  </Tooltip>
                }
              >
                {/* 硬件信息为多行原文：pre 保留换行，定高滚动；缺失留白 */}
                <pre className={styles.hardwareValue}>{license.hardwareInfo || ''}</pre>
              </Card>
            </div>
          </>
        ) : (
          <div className={styles.stateBlock}>
            <Empty description={t('暂无激活信息')}>
              {canActivate && (
                <Button type="primary" icon={<Zap size={13} strokeWidth={2} />} onClick={openActivation}>
                  {t('激活软件')}
                </Button>
              )}
            </Empty>
          </div>
        )}
      </Spin>

      {/*
       * 激活弹窗：表单区复用 P02 ActivationForm（提交按钮「激活授权」为该组件
       * 既定文案，旧版「确认激活」收敛登记）；footer 仅保留「取消」关闭路径。
       * destroyOnHidden 关闭即销毁表单草稿（旧版 destroyOnClose 同语义）。
       */}
      <Modal
        title={
          <span className={styles.modalTitle}>
            <Zap size={14} strokeWidth={2} /> {t('激活软件')}
          </span>
        }
        open={activationOpen}
        onCancel={closeActivation}
        destroyOnHidden
        maskClosable={false}
        footer={<Button onClick={closeActivation}>{t('取消')}</Button>}
      >
        <ActivationForm onActivated={handleActivated} />
      </Modal>
    </div>
  )
}
