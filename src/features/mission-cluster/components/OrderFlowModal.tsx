/**
 * 创建/重发工艺弹窗（P21 整页重写，旧 MissionFlow/FlowModal 等价迁移）。
 *
 * 交互与契约要点：
 * - 双模式（旧 repeatRow 有无同语义）：mode=create 创建 / mode=resend 重发——
 *   重发=按行回显表单（名称/表达式/循环次数/触发方式 + 模板集合从子工艺
 *   subOrderFlows 提取 orderTemplateKey），提交走同一创建接口 createOrderFlow
 *   （旧实现同语义：重发即创建，不带源工艺 id）；
 * - 表单字段与旧版逐项一致：工艺名称（必填）/时间表达式（必填 + 6 段形态
 *   onBlur 校验，cronRegex 旧同款；CronExpress 构建器保留秒位与 ? 语义）/
 *   模板集合（Transfer 全量选项 getOrderTemplates，必填）/循环次数（必填，
 *   min=-1 精度 0，-1=无限循环）/触发方式（必填单选 0=并行 1=串行）；
 * - 提交组装显式按 OpenAPI OrderFlowParam 字段（行为等价旧 getFieldsValue(true)
 *   全量——后端只消费声明字段）；模板集合提交受控 targetKeys（顺序=用户添加
 *   顺序，原样提交不重排=P11 同纪律）；
 * - 失效模板识别（A17，P11 同款纪律）：重发回显中已不在当前选项集合的模板
 *   key（模板已被删除）合成占位条目保留原名称标识（名称取自源行子工艺），并
 *   阻止提交（要求显式移除后保存），不静默丢弃也不以失效 key 提交；
 * - 打开时按模式回填/清空（依赖 open 触发=P32 教训）；选项仅打开时加载；
 *   关闭销毁草稿（destroyOnHidden，旧 handleCancel resetFields 同语义；失败
 *   保留输入=旧失败路径不关弹窗同语义）；提交防重复（submitting 早退+loading）。
 */

import { useEffect, useMemo, useState } from 'react'
import { App, Form, Input, InputNumber, Modal, Radio, Transfer } from 'antd'
import type { RadioGroupProps, TransferProps } from 'antd'
// 跨命名空间：主体文案走 orderFlow，选项加载失败走 common「加载失败」
// （AGENTS 第 6 节 nsMode fallback，无前缀 key 按数组顺序回退）
import { useTranslation } from 'react-i18next'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { fetchOrderTemplates } from '@/services/order-template/order-template.service'
import type { OrderTemplateDto } from '@/services/order-template/order-template.service.types'
import { createOrderFlow } from '@/services/order-flow/order-flow.service'
import type { OrderFlowDto } from '@/services/order-flow/order-flow.service.types'
import { useStaticOptions } from '@/hooks/useStaticOptions'
import { CRON_EXPRESSION_PATTERN } from '@/features/mission-cluster/components/cron/cronConfig'
import { CronExpress } from '@/features/mission-cluster/components/cron/CronExpress'

/** 弹窗模式：create 创建 / resend 重发（target=源工艺行） */
export type OrderFlowModalMode = 'create' | 'resend'

/** 穿梭框条目：真实选项与失效合成条目共用形状（title 即展示名） */
interface OrderTemplateItem {
  key: string
  title: string
}

/** 表单值形状（字段名与协议 DTO 同名；模板集合经受控 targetKeys 镜像） */
interface OrderFlowFormValues {
  orderFlowName: string
  cronExpression?: string
  orderTemplateKeys?: string[]
  triggerTimes?: number
  triggerType: number
}

interface OrderFlowModalProps {
  open: boolean
  mode: OrderFlowModalMode
  /** 重发源工艺行（mode=resend 时回显；create 时为 null） */
  target: OrderFlowDto | null
  onClose: () => void
  /** 提交成功后回调（页面刷新列表；本组件关闭即销毁草稿） */
  onSucceeded: () => void
}

export function OrderFlowModal({ open, mode, target, onClose, onSucceeded }: OrderFlowModalProps) {
  const { t } = useTranslation(['orderFlow', 'common'], { nsMode: 'fallback' })
  const { message } = App.useApp()
  const [form] = Form.useForm<OrderFlowFormValues>()
  const [submitting, setSubmitting] = useState(false)

  // 穿梭框选中态（受控）：targetKeys=已选模板 key 集合（顺序即添加顺序），
  // selectedKeys=两侧勾选态（与已选集合分离，勾选后取消不污染已选=P11 同款）
  const [targetKeys, setTargetKeys] = useState<string[]>([])
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

  // 模板选项（共享契约 getOrderTemplates）：仅弹窗打开时加载；关闭再打开自然
  // 重查，模板增删随之反映（P11/P20 同口径）
  const templateOptions = useStaticOptions<OrderTemplateDto>(
    (signal) => fetchOrderTemplates({ signal }),
    open,
  )

  // 弹窗打开时按模式回填 / 清空（依赖 open 触发=P32 教训：重发可能指向同一行
  // 引用，仅依赖 target 会跳过回填）
  useEffect(() => {
    if (!open) return
    setSelectedKeys([])
    if (mode === 'resend' && target) {
      // 重发回显：模板 key 集合从源行子工艺提取（旧 subOrderFlows.map 同口径）
      const keys =
        target.subOrderFlows
          ?.map((flow) => flow.orderTemplateKey ?? '')
          .filter((key) => key !== '') ?? []
      form.setFieldsValue({
        orderFlowName: target.orderFlowName ?? '',
        cronExpression: target.cronExpression ?? '',
        triggerTimes: target.triggerTimes,
        triggerType: target.triggerType ?? 0,
        orderTemplateKeys: keys,
      })
      setTargetKeys(keys)
    } else {
      form.resetFields()
      setTargetKeys([])
    }
  }, [open, mode, target, form])

  /**
   * 失效模板识别：已选 key 中不在当前选项集合的条目（模板创建后被删除）。
   * 选项尚未加载完成（loading/失败）时不判定，避免误报（P11 同款）。
   */
  const missingKeys = useMemo(() => {
    if (templateOptions.loading || templateOptions.error || templateOptions.options === null) {
      return []
    }
    const known = new Set((templateOptions.options ?? []).map((item) => item.orderTemplateKey ?? ''))
    return targetKeys.filter((key) => !known.has(key))
  }, [templateOptions.options, templateOptions.loading, templateOptions.error, targetKeys])

  // 源行子工艺携带的模板名称（失效合成条目的识别名来源，不猜名称语义）
  const knownTemplateNames = useMemo(() => {
    const map = new Map<string, string>()
    target?.subOrderFlows?.forEach((flow) => {
      if (flow.orderTemplateKey) {
        map.set(flow.orderTemplateKey, flow.orderTemplateName ?? '')
      }
    })
    return map
  }, [target])

  // 穿梭框数据源 = 真实选项 + 失效合成条目（保留原名称标识=P11 同款）
  const transferDataSource = useMemo<OrderTemplateItem[]>(() => {
    const realItems: OrderTemplateItem[] = (templateOptions.options ?? []).map((item) => ({
      key: item.orderTemplateKey ?? '',
      title: item.orderTemplateName ?? item.orderTemplateKey ?? '',
    }))
    const missingItems: OrderTemplateItem[] = missingKeys.map((key) => ({
      key,
      title: knownTemplateNames.get(key) || key,
    }))
    return [...realItems, ...missingItems]
  }, [templateOptions.options, missingKeys, knownTemplateNames])

  /** 穿梭框条目渲染：失效合成条目在原名称后附不可用说明（P11 同款呈现） */
  const renderItem: TransferProps<OrderTemplateItem>['render'] = (item) => {
    const isMissing = !(templateOptions.options ?? []).some(
      (option) => (option.orderTemplateKey ?? '') === item.key,
    )
    return isMissing ? `${item.title}（${t('已不可用')}）` : item.title
  }

  /** 搜索本地过滤：按展示名（含模板 key 兜底）匹配（旧搜索框同语义） */
  const filterOption: TransferProps<OrderTemplateItem>['filterOption'] = (inputValue, item) =>
    (item.title ?? '').toLowerCase().includes(inputValue.toLowerCase())

  /** 穿梭框移动：同步受控已选集合与表单镜像（保持添加顺序原样提交；Key 收敛 string） */
  const handleTransferChange: TransferProps<OrderTemplateItem>['onChange'] = (nextTargetKeys) => {
    setTargetKeys(nextTargetKeys.map(String))
    form.setFieldValue('orderTemplateKeys', nextTargetKeys.map(String))
  }

  /** 两侧条目勾选态：勾选不等于移动，单独受控防误移（P11 同款） */
  const handleSelectChange: TransferProps<OrderTemplateItem>['onSelectChange'] = (
    sourceSelectedKeys,
    targetSelectedKeys,
  ) => {
    setSelectedKeys([...sourceSelectedKeys.map(String), ...targetSelectedKeys.map(String)])
  }

  /** 提交：存在失效模板时直接拦截（A17 阻止错误提交），否则按 OrderFlowParam 创建 */
  const handleOk = async () => {
    const values = await form.validateFields()
    if (submitting) return
    if (missingKeys.length > 0) {
      message.error(
        t('模板集合中 {{count}} 个模板已失效，请先在列表中移除后再保存', {
          count: missingKeys.length,
        }),
      )
      return
    }
    setSubmitting(true)
    try {
      await createOrderFlow({
        orderFlowName: values.orderFlowName,
        orderTemplateKeys: targetKeys,
        cronExpression: values.cronExpression ?? '',
        triggerTimes: values.triggerTimes ?? 0,
        triggerType: values.triggerType,
      })
      message.success(t('创建任务分组成功'))
      onSucceeded()
    } catch (error) {
      if (!isCancelledError(error)) {
        message.error(t('创建任务分组出错：{{msg}}', { msg: apiErrorMessage(error) }))
      }
    } finally {
      setSubmitting(false)
    }
  }

  /** 触发方式选项（0=并行 1=串行，旧 triggerTypes 同值域；说明文案旧 tooltip 同款） */
  const triggerTypeOptions: RadioGroupProps['options'] = [
    { value: 0, label: t('并行触发') },
    { value: 1, label: t('串行触发') },
  ]

  return (
    <Modal
      title={t('创建工艺')}
      open={open}
      width={1200}
      onOk={handleOk}
      onCancel={onClose}
      okButtonProps={{ loading: submitting }}
      // 关闭即销毁草稿（旧 handleCancel resetFields 同语义，等价迁移）
      destroyOnHidden
    >
      {/* 弹窗内表单参数（AGENTS 第 3 节：labelCol 6 / wrapper 18）；旧版 1200 宽
          为容纳 Transfer 双栏（300×360×2），等价保留 */}
      <Form
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
        form={form}
        initialValues={{ triggerType: 0 }}
      >
        <Form.Item<OrderFlowFormValues>
          label={t('工艺名称')}
          name="orderFlowName"
          rules={[{ required: true, message: t('请输入工艺名称') }]}
        >
          <Input placeholder={t('请输入工艺名称')} />
        </Form.Item>

        <Form.Item<OrderFlowFormValues>
          label={t('时间表达式')}
          name="cronExpression"
          validateFirst
          rules={[
            { required: true, message: t('请输入时间表达式') },
            {
              required: true,
              pattern: CRON_EXPRESSION_PATTERN,
              message: t('请输入符合规则的正则表达式'),
              validateTrigger: 'onBlur',
            },
          ]}
        >
          <CronExpress />
        </Form.Item>

        <Form.Item<OrderFlowFormValues>
          label={t('模板集合')}
          name="orderTemplateKeys"
          rules={[{ required: true, message: t('请选择任务集合') }]}
        >
          <Transfer<OrderTemplateItem>
            dataSource={transferDataSource}
            rowKey={(item) => item.key}
            render={renderItem}
            targetKeys={targetKeys}
            selectedKeys={selectedKeys}
            onChange={handleTransferChange}
            onSelectChange={handleSelectChange}
            filterOption={filterOption}
            showSearch={{ placeholder: t('搜索') }}
            titles={[t('待选工艺'), t('已选工艺')]}
            actions={[t('添加'), t('撤回')]}
            // 选项加载失败时把空列表文案覆盖为「加载失败」状态文本（不设重试
            // 按钮=按钮纪律，P10/P20 同款；重新打开弹窗自动重查即恢复路径）
            locale={templateOptions.error ? { notFoundContent: t('加载失败') } : undefined}
            // 旧 listStyle 300×360 双栏（antd v6 以 styles.section 承载）
            styles={{ section: { width: 300, height: 360 } }}
          />
        </Form.Item>

        <Form.Item<OrderFlowFormValues>
          label={t('循环次数')}
          name="triggerTimes"
          tooltip={t('任务成功的触发次数，-1表示无限循环')}
          rules={[{ required: true, message: t('请输入循环次数') }]}
        >
          <InputNumber style={{ width: '100%' }} placeholder={t('请输入循环次数')} min={-1} precision={0} />
        </Form.Item>

        <Form.Item<OrderFlowFormValues>
          label={t('触发方式')}
          name="triggerType"
          tooltip={t('并行触发:时间周期到达马上创建任务，串行触发:等待上个任务终止再创建任务')}
          rules={[{ required: true, message: t('请选择触发方式') }]}
        >
          <Radio.Group options={triggerTypeOptions} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
