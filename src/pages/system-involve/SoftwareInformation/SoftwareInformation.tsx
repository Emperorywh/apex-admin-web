/**
 * 软件信息页（P29，页签业务页）。
 *
 * 源实现 SystemInvolve/SoftwareInformation/index.tsx @ e570b8df，本卡迁移差异：
 * - 许可证查询接入 T010 统一查询（页签关闭/隐藏经 scope 中止，激活成功后
 *   reload 刷新，源 useRequest.refresh 同语义）；
 * - 「激活软件」提交接入 T011 写入任务控制器（本页页签 key，零自动重发；
 *   结果未知转待确认并保留核查入口，不伪装成功/失败）；
 * - 按钮权限沿源 §7.1：无 system:software:activate 时两处激活入口隐藏
 *   （root 短路放行），改用 useAuth().hasButton 判定。
 * 视觉沿源布局（横幅卡 + 统计卡 + 明细卡），配色桥接为全局 --app-* 主题
 * 变量以跟随亮/暗主题（T016 主题合同）。
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Spin,
  Statistic,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  Copy,
  Hourglass,
  KeyRound,
  Monitor,
  ShieldCheck,
  XCircle,
  Zap,
} from 'lucide-react'
import { usePageQuery } from '@/hooks/page-query'
import { usePageSession } from '@/services/page-session'
import { useTabWriteTasks, dismissWriteTask, submitWriteTask } from '@/services/session-tasks'
import { useAuth } from '@/hooks/useAuth'
import { apiErrorMessage } from '@/services/request/request'
import {
  getLicense,
  softwareActivation,
} from '@/services/system-involve/software-information/software-information.service'
import type { LicenseInfoRecord } from '@/services/system-involve/software-information/software-information.service.types'
import { BUTTON_PERM } from '@/constants/permission.constants'
import { copyTextToClipboard } from '@/utils/clipboard'
import styles from './SoftwareInformation.module.css'

const { Paragraph, Text } = Typography

/** 激活动作标识（写入任务记录用，与 P02 授权页一致） */
const ACTIVATE_ACTION_KEY = 'software.activate'

/** 源日期展示格式（YYYY-MM-DD HH:mm:ss） */
const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss'

/** 非法/空日期原样展示（源行为：dayjs 解析失败返回原字符串） */
function formatDate(value?: string): string {
  if (!value) return '-'
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format(DATE_FORMAT) : value
}

interface LicenseStatus {
  label: string
  color: 'default' | 'error' | 'warning' | 'success'
  restDays: number
}

/**
 * 许可状态判定（源 getLicenseStatus 同规则）：过期日为空/非法＝未知；
 * 剩余天数按「过期日零点 − 今天零点」自然日差计算，<0 过期、≤30 即将到期。
 */
function getLicenseStatus(
  expirationDate: string | undefined,
  translate: (id: string) => string,
): LicenseStatus {
  if (!expirationDate) {
    return { label: translate('未知'), color: 'default', restDays: 0 }
  }
  const expire = dayjs(expirationDate)
  if (!expire.isValid()) {
    return { label: translate('未知'), color: 'default', restDays: 0 }
  }
  const restDays = expire.startOf('day').diff(dayjs().startOf('day'), 'day')
  if (restDays < 0) {
    return { label: translate('已过期'), color: 'error', restDays }
  }
  if (restDays <= 30) {
    return { label: translate('即将到期'), color: 'warning', restDays }
  }
  return { label: translate('已激活'), color: 'success', restDays }
}

/** 状态图标随状态色切换（lucide 等价迁移源 antd 图标） */
function StatusIcon({ color }: { color: LicenseStatus['color'] }) {
  const size = 13
  if (color === 'error') return <XCircle size={size} />
  if (color === 'success') return <CheckCircle2 size={size} />
  return <Clock size={size} />
}

interface ActivationFormValues {
  activationCode?: string
}

export default function SoftwareInformation() {
  const { t } = useTranslation('system')
  const { message } = App.useApp()
  const { hasButton } = useAuth()
  /* 激活为写入动作：归属当前页签（切页/关页经会话任务层接管） */
  const { tabKey } = usePageSession()
  /* 激活软件权限（banner 与空态两处入口共用，无权限均隐藏，root 短路） */
  const canActivate = hasButton(BUTTON_PERM.SYSTEM_SOFTWARE_ACTIVATE)

  /* 激活弹窗与表单（关闭销毁还原，源 destroyOnClose 语义） */
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm<ActivationFormValues>()
  const [activating, setActivating] = useState(false)

  /* 许可证查询：统一查询接口承载（scope 中止/代际隔离/失败保留旧数据） */
  const licenseQuery = usePageQuery({
    fetcher: (_params, { signal }) => getLicense({ signal }),
    params: {},
  })
  const licenseInfo: LicenseInfoRecord | null = licenseQuery.data ?? null

  /* 查询失败提示（对齐源 message.error；error 对象变化才提示一次） */
  useEffect(() => {
    if (!licenseQuery.error) return
    const text = apiErrorMessage(licenseQuery.error)
    void message.error(`${t('获取激活信息出错')}${text}`)
  }, [licenseQuery.error, message, t])

  /* 激活结果待确认记录（仅本页激活动作）；核查路径 = 重新读取许可证 */
  const writeTasks = useTabWriteTasks(tabKey)
  const pendingActivationTasks = writeTasks.filter(
    (task) => task.actionKey === ACTIVATE_ACTION_KEY && task.status === 'unknown',
  )

  /* 许可证重新读取成功即视为核查完成：清除已核查的待确认记录（不掩盖失败：
     核查读取失败时记录保留展示） */
  useEffect(() => {
    if (licenseQuery.data === undefined || pendingActivationTasks.length === 0) return
    for (const task of pendingActivationTasks) {
      dismissWriteTask(task.id)
    }
    // 依赖仅绑定「最近一次成功数据」：数据刷新后核查一次，避免随快照循环触发
  }, [licenseQuery.data])

  /* 激活状态与剩余天数（licenseInfo 变化时重算） */
  const status = getLicenseStatus(licenseInfo?.expirationDate, (id) => t(id))

  /* 打开激活弹窗：清空上次输入（源 handleOpenActivate 行为） */
  const handleOpenActivate = () => {
    form.resetFields()
    setModalOpen(true)
  }

  /* 提交激活：校验必填后经写入任务控制器上送（tabKey=本页页签） */
  const handleActivate = () => {
    void form
      .validateFields()
      .then((values: ActivationFormValues) => {
        const code = values.activationCode?.trim()
        if (!code || activating) return
        setActivating(true)
        const handle = submitWriteTask({
          tabKey,
          actionKey: ACTIVATE_ACTION_KEY,
          detail: t('提交软件激活'),
          run: (ctx) => softwareActivation({ activationCode: code }, { signal: ctx.signal }),
          onSuccess: () => {
            // 仅明确成功且纪元一致时进入：提示、关弹窗、刷新许可证（源行为）
            void message.success(t('激活成功'))
            setModalOpen(false)
            form.resetFields()
            licenseQuery.reload()
          },
        })
        void handle.settled.then((record) => {
          if (record === null) {
            // 记录被会话复位/离开确认清除：无结果可展示，仅复位提交态
            setActivating(false)
            return
          }
          if (record.status === 'failed') {
            // 后端明确拒绝（如 1001020 激活失败）：保留后端原文提示（源行为）
            const text = record.error ? apiErrorMessage(record.error) : ''
            void message.error(text || t('激活失败'))
          } else if (record.status === 'unknown') {
            // 结果未知：不关弹窗伪装成功，转待确认（页面内联展示并核查）
            void message.warning(t('激活结果待确认，请核查许可证状态'))
          }
          setActivating(false)
        })
      })
      .catch(() => {
        // 校验失败：antd 已在表单内标红，无需额外提示
      })
  }

  /* 复制字段值（内网 http 部署经 execCommand 降级，见 utils/clipboard） */
  const handleCopy = (value: string | undefined, label: string) => {
    if (!value) return
    if (copyTextToClipboard(value)) {
      void message.success(t('{label}已复制', { label: label }))
    } else {
      void message.error(t('复制失败'))
    }
  }

  return (
    <div className={styles.wrap}>
      <Spin spinning={licenseQuery.loading}>
        {licenseInfo ? (
          <>
            {/* 横幅卡：授权状态总览 + 激活入口 */}
            <Card className={styles.bannerCard} bordered={false}>
              <div className={styles.bannerContent}>
                <div className={styles.bannerLeft}>
                  <div className={styles.bannerIcon}>
                    <ShieldCheck size={32} />
                  </div>
                  <div className={styles.bannerText}>
                    <div className={styles.bannerTitle}>{t('软件授权信息')}</div>
                    <div className={styles.bannerSubtitle}>
                      {t('当前系统授权状态与激活详情')}
                    </div>
                  </div>
                </div>
                <div className={styles.bannerRight}>
                  <Tag
                    icon={<StatusIcon color={status.color} />}
                    color={status.color}
                    className={styles.statusTag}
                  >
                    {status.label}
                  </Tag>
                  {/* 激活软件：无权限条件渲染隐藏（源 §7.1，root 短路放行） */}
                  {canActivate && (
                    <Button
                      type="primary"
                      ghost
                      icon={<Zap size={14} />}
                      className={styles.activateBtn}
                      onClick={handleOpenActivate}
                    >
                      {t('激活软件')}
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* 统计卡：最大 AGV 数量 / 剩余授权天数 */}
            <Row gutter={[16, 16]} className={styles.statRow}>
              <Col xs={24} sm={12}>
                <Card bordered={false} className={styles.statCard}>
                  <Statistic
                    title={
                      <span>
                        <Car size={14} /> {t('最大 AGV 数量')}
                      </span>
                    }
                    value={licenseInfo.agvNumber ?? 0}
                    suffix={t('台')}
                    valueStyle={{ color: 'var(--app-blue)' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card bordered={false} className={styles.statCard}>
                  <Statistic
                    title={
                      <span>
                        <Hourglass size={14} /> {t('剩余授权天数')}
                      </span>
                    }
                    value={status.restDays < 0 ? 0 : status.restDays}
                    suffix={t('天')}
                    valueStyle={{
                      color:
                        status.color === 'error'
                          ? 'var(--app-red)'
                          : status.color === 'warning'
                            ? 'var(--app-orange)'
                            : 'var(--app-green)',
                    }}
                  />
                </Card>
              </Col>
            </Row>

            {/* 明细卡：激活/过期日期、激活码与硬件信息 */}
            <Row gutter={[16, 16]} className={styles.detailRow}>
              <Col xs={24} lg={12}>
                <Card
                  bordered={false}
                  className={styles.detailCard}
                  title={
                    <span>
                      <Calendar size={14} /> {t('激活日期')}
                    </span>
                  }
                >
                  <div className={styles.detailValue}>{formatDate(licenseInfo.issueDate)}</div>
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card
                  bordered={false}
                  className={styles.detailCard}
                  title={
                    <span>
                      <Calendar size={14} /> {t('过期日期')}
                    </span>
                  }
                >
                  <div className={styles.detailValue}>
                    {formatDate(licenseInfo.expirationDate)}
                  </div>
                </Card>
              </Col>

              <Col xs={24}>
                <Card
                  bordered={false}
                  className={styles.detailCard}
                  title={
                    <span>
                      <KeyRound size={14} /> {t('激活码')}
                    </span>
                  }
                  extra={
                    <Tooltip title={t('复制激活码')}>
                      <Button
                        type="link"
                        icon={<Copy size={14} />}
                        disabled={!licenseInfo.activationCode}
                        onClick={() => handleCopy(licenseInfo.activationCode, t('激活码'))}
                      >
                        {t('复制')}
                      </Button>
                    </Tooltip>
                  }
                >
                  {/*
                   * 激活码可能超过 15 行，全量展示会把卡片撑得很高：
                   * 超出固定高度后在区域内滚动查看完整内容（源行为）
                   */}
                  <Paragraph className={styles.codeValue}>
                    {licenseInfo.activationCode || '-'}
                  </Paragraph>
                </Card>
              </Col>

              <Col xs={24}>
                <Card
                  bordered={false}
                  className={styles.detailCard}
                  title={
                    <span>
                      <Monitor size={14} /> {t('硬件信息')}
                    </span>
                  }
                  extra={
                    <Tooltip title={t('复制硬件信息')}>
                      <Button
                        type="link"
                        icon={<Copy size={14} />}
                        disabled={!licenseInfo.hardwareInfo}
                        onClick={() => handleCopy(licenseInfo.hardwareInfo, t('硬件信息'))}
                      >
                        {t('复制')}
                      </Button>
                    </Tooltip>
                  }
                >
                  <pre className={styles.hardwareInfo}>
                    {licenseInfo.hardwareInfo ? (
                      licenseInfo.hardwareInfo
                    ) : (
                      <Text type="secondary">-</Text>
                    )}
                  </pre>
                </Card>
              </Col>
            </Row>
          </>
        ) : (
          !licenseQuery.loading && (
            <div className={styles.emptyWrapper}>
              <Empty description={t('暂无激活信息')}>
                {/* 激活软件：无权限条件渲染隐藏（源 §7.1） */}
                {canActivate && (
                  <Button type="primary" icon={<Zap size={14} />} onClick={handleOpenActivate}>
                    {t('激活软件')}
                  </Button>
                )}
              </Empty>
            </div>
          )
        )}
      </Spin>

      {/* 激活结果待确认：内联提示（提交时间 + 核查入口），不伪装成败 */}
      {pendingActivationTasks.map((task) => (
        <div key={task.id} className={styles.pendingNotice}>
          <span>
            {t('有一条软件激活提交结果未知（提交时间 {time}），已停止等待，请核查许可证状态。', {
              time: dayjs(task.submittedAt).format(DATE_FORMAT),
            })}
          </span>
          <Button size="small" type="link" onClick={() => licenseQuery.reload()}>
            {t('核查许可状态')}
          </Button>
        </div>
      ))}

      <Modal
        title={
          <span>
            <Zap size={15} style={{ marginRight: 6, color: 'var(--app-blue)' }} />
            {t('激活软件')}
          </span>
        }
        open={modalOpen}
        onOk={handleActivate}
        onCancel={() => setModalOpen(false)}
        confirmLoading={activating}
        okText={t('确认激活')}
        cancelText={t('取消')}
        destroyOnHidden
        maskClosable={false}
      >
        <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 12 }}>
          <Form.Item
            name="activationCode"
            label={t('激活码')}
            rules={[{ required: true, message: t('请输入激活码') }]}
          >
            <Input.TextArea placeholder={t('请输入激活码')} autoSize={{ minRows: 4, maxRows: 8 }} allowClear />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
