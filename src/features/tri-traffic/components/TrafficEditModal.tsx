/**
 * 三方交管新增 / 编辑弹窗（P19 整页重写，旧 TrafficModal 等价迁移）。
 *
 * 交互与契约要点（旧实现 C:\code\dd\src\pages\TriTraffic\TrafficModal 等价）：
 * - 单弹窗双模式：modifyRow 为 null 时新增（addTripartiteTraffic），非空时编辑
 *   （updateTripartiteTraffic 完整实体提交——旧实现 getFieldsValue(true) 连同
 *   回显时塞入表单状态的原记录字段一并提交同边界：payload = 原记录快照 +
 *   表单四字段 + 展开后的 extendParam）；
 * - 表单四块（旧实现逐项一致）：区域编号（必填，最长 64）/ 点边组合（必填
 *   下拉，按名称过滤、可清空；选项由页面注入 = getSimpleTripartiteTrafficEdge
 *   Groups 全集）/ 是否外部系统作为仲裁方（开关，非必填）/ 扩展参数（Form.List
 *   key-value 行，行内必填 + 整组校验「必须含一个 key=url 的行」）；
 * - 扩展参数转换：提交经 listToJson（[{key,value}] → {key:value}，同 key 后行
 *   覆盖前行=旧实现 transformListJson 同语义）；回显经 jsonToList（对象 → 行数
 *   组=transformJsonList 同语义）；value 非字符串只转显示、未改动保留原值随
 *   表单提交（P23 ActionFormModal 同款守恒）；
 * - 编辑回显开关状态：旧版 Form.Item 包 Switch 未写 valuePropName="checked"，
 *   编辑回显时开关不亮（值在表单状态里正确、仅显示不受控）——重写按 antd 标准
 *   写法补 valuePropName，差异登记 P19 交接记录；
 * - 关闭即销毁草稿（destroyOnHidden + resetFields，旧版 handleCancel 同语义，
 *   P32 弹窗先例同款）；弹窗短生命周期不接页签脏保护（旧版同边界）；
 * - 点边组合已删除的场景（专项验收「已删除组合不可静默替换」）：编辑回显的
 *   nodeEdgeGroupId 不在选项集合内时 antd Select 原值裸显（旧版同行为），用户
 *   不主动改选则提交保留原值，不做静默替换或清空。
 */

import { useEffect, useState } from 'react'
import { App, Button, Col, Form, Input, Modal, Row, Select, Switch } from 'antd'
import { CircleMinus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  addTripartiteTraffic,
  updateTripartiteTraffic,
} from '@/services/tripartite-traffic/tripartite-traffic.service'
import type {
  SimpleMapNodeEdgeGroup,
  TripartiteTrafficRecord,
} from '@/services/tripartite-traffic/tripartite-traffic.service.types'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { toValueDisplayText } from '@/utils/display/valueDisplay'

/** 扩展参数行形状（旧实现 transformJsonList 产出的 {key,value} 行） */
interface ExtendParamRow {
  key: string
  value: unknown
}

/** 表单值形状（id 等原记录字段不进表单，编辑时由快照携带提交） */
interface TrafficFormValues {
  areaCode: string
  nodeEdgeGroupId?: string
  isExternalArbitrator?: boolean
  extendParam?: ExtendParamRow[]
}

/** [{key,value}] → {key:value}（旧实现 transformListJson 同语义：同 key 后行覆盖前行） */
function listToJson(list: ExtendParamRow[] | undefined): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  for (const { key, value } of list ?? []) {
    obj[key] = value
  }
  return obj
}

/** {key:value} → [{key,value}]（旧实现 transformJsonList 同语义：仅自有可枚举键） */
function jsonToList(obj: Record<string, unknown> | null | undefined): ExtendParamRow[] {
  const list: ExtendParamRow[] = []
  for (const key of Object.keys(obj ?? {})) {
    list.push({ key, value: (obj as Record<string, unknown>)[key] })
  }
  return list
}

interface TrafficEditModalProps {
  /** 弹窗是否打开 */
  open: boolean
  /** 点边组合选项全集（页面加载 getSimpleTripartiteTrafficEdgeGroups 后注入） */
  edgeGroups: SimpleMapNodeEdgeGroup[]
  /** 编辑目标行快照（null=新增模式） */
  modifyRow: TripartiteTrafficRecord | null
  onClose: () => void
  /** 提交成功后回调（页面刷新列表并关闭弹窗） */
  onSucceeded: () => void
}

export function TrafficEditModal({
  open,
  edgeGroups,
  modifyRow,
  onClose,
  onSucceeded,
}: TrafficEditModalProps) {
  const { t } = useTranslation('tripartite-traffic')
  const { message } = App.useApp()
  const [form] = Form.useForm<TrafficFormValues>()
  // 提交中状态：驱动确认按钮 loading，防止重复提交
  const [submitting, setSubmitting] = useState(false)

  /** 点边组合下拉选项（id+name 齐备的条目；按名称过滤=旧 optionFilterProp="name" 同语义） */
  const edgeGroupOptions = edgeGroups
    .filter((group) => group.id !== null && group.id !== undefined && group.id !== '')
    .map((group) => ({ label: group.name ?? '', value: group.id as string }))

  /** 弹窗打开时按模式回填 / 清空表单（旧版 useEffect 依赖 open 的教训同款保留） */
  useEffect(() => {
    if (!open) return
    if (modifyRow) {
      form.setFieldsValue({
        areaCode: modifyRow.areaCode ?? '',
        nodeEdgeGroupId: modifyRow.nodeEdgeGroupId ?? undefined,
        isExternalArbitrator: modifyRow.isExternalArbitrator ?? false,
        // 回显时把 extendParam 对象展开为 key-value 行（旧实现 transformJsonList 同语义）
        extendParam: jsonToList(modifyRow.extendParam),
      })
    } else {
      // 新增模式：主动清空，避免上一轮编辑的残留值带入（旧版同语义）
      form.resetFields()
    }
  }, [open, modifyRow, form])

  /** 弹窗确认：校验通过后按模式调用新增 / 更新（旧版 handleOk 同结构） */
  const handleOk = async () => {
    if (submitting) return
    let values: TrafficFormValues
    try {
      values = await form.validateFields()
    } catch {
      // 校验失败：antd 已在字段下方呈现错误，无需额外处理
      return
    }
    // 提交体：编辑=原记录快照 + 表单值 + 展开后的扩展参数（旧实现
    // getFieldsValue(true) 携带回显塞入的原记录字段同边界）；新增=表单值
    const payload: TripartiteTrafficRecord = {
      ...(modifyRow ?? {}),
      areaCode: values.areaCode,
      nodeEdgeGroupId: values.nodeEdgeGroupId,
      isExternalArbitrator: values.isExternalArbitrator ?? false,
      extendParam: listToJson(values.extendParam),
    }
    setSubmitting(true)
    try {
      if (modifyRow) {
        await updateTripartiteTraffic(payload)
        message.success(t('编辑三方交管成功'))
      } else {
        await addTripartiteTraffic(payload)
        message.success(t('新增三方交管成功'))
      }
      onSucceeded()
    } catch (error) {
      // 失败保留输入；取消（弹窗销毁引发的请求中止）不打错误提示
      if (!isCancelledError(error)) {
        message.error(
          modifyRow
            ? t('编辑三方交管失败：{{msg}}', { msg: apiErrorMessage(error) })
            : t('新增三方交管失败：{{msg}}', { msg: apiErrorMessage(error) }),
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={modifyRow ? t('编辑三方交管') : t('新增三方交管')}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      // 关闭即销毁草稿（旧版 resetFields 同语义，等价迁移）
      destroyOnHidden
      confirmLoading={submitting}
      okText={t('确定')}
      cancelText={t('取消')}
    >
      <Form
        form={form}
        // 弹窗内表单参数（AGENTS 第 3 节：labelCol 6 / wrapper 18；旧版 10/14 为
        // 项目内统一前形态，行为等价）
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
      >
        <Form.Item<TrafficFormValues>
          label={t('区域编号')}
          name="areaCode"
          rules={[{ required: true, message: t('请输入区域编号') }]}
        >
          <Input placeholder={t('请输入区域编号')} maxLength={64} />
        </Form.Item>

        <Form.Item<TrafficFormValues>
          label={t('点边组合')}
          name="nodeEdgeGroupId"
          rules={[{ required: true, message: t('请输入点边组合') }]}
        >
          {/* 选项集合经名称过滤、可清空（旧版 showSearch+allowClear 同交互）；
              已删除组合的原值不在选项内时裸显原 id（不可静默替换，见头注） */}
          <Select
            placeholder={t('请选择点边组合')}
            showSearch
            allowClear
            options={edgeGroupOptions}
          />
        </Form.Item>

        <Form.Item<TrafficFormValues>
          label={t('是否外部系统作为仲裁方')}
          name="isExternalArbitrator"
          // 旧版未写 valuePropName 致编辑回显开关不亮（值正确仅显示不受控），
          // 重写按 antd 标准补 checked 绑定（差异登记 P19 交接记录）
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        {/*
         * 扩展参数集合（旧实现 Form.List 同结构）：key/value 行内必填 + 行删除
         * 图标 + 底部「新增扩展参数」虚线按钮；整组校验必须含一个 key=url 的行
         * （旧实现 validator 同文案同语义，错误呈现在列表底部 ErrorList 位）。
         */}
        <Form.List
          name="extendParam"
          rules={[
            {
              validator: async (_, extendParam: ExtendParamRow[] | undefined) => {
                const hasUrl = extendParam?.some((param) => param?.key === 'url')
                if (!hasUrl) {
                  throw new Error(t('必须添加一个URL地址'))
                }
              },
            },
          ]}
        >
          {(fields, { add, remove }, { errors }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Row key={key} gutter={4}>
                  <Col span={11}>
                    <Form.Item<ExtendParamRow>
                      {...restField}
                      name={[name, 'key']}
                      rules={[{ required: true, message: t('Key为必填项') }]}
                    >
                      <Input placeholder={t('扩展key')} />
                    </Form.Item>
                  </Col>
                  <Col span={11}>
                    <Form.Item<ExtendParamRow>
                      {...restField}
                      name={[name, 'value']}
                      rules={[{ required: true, message: t('value为必填项') }]}
                      // 非字符串 value 只转显示：用户改动即存新文本，未改动保留
                      // 原始值（对象/数字）随表单原样提交（P23 同款守恒）
                      getValueProps={(value) => ({ value: toValueDisplayText(value) })}
                    >
                      <Input placeholder={t('扩展value')} />
                    </Form.Item>
                  </Col>
                  <Col span={2} style={{ textAlign: 'center' }}>
                    {/* 行删除（旧实现 MinusCircleOutlined 同语义） */}
                    <CircleMinus
                      size={16}
                      style={{ cursor: 'pointer', marginTop: 8 }}
                      onClick={() => remove(name)}
                    />
                  </Col>
                </Row>
              ))}
              <Form.Item noStyle>
                <Button type="dashed" onClick={() => add()} block icon={<Plus size={14} />}>
                  {t('新增扩展参数')}
                </Button>
              </Form.Item>
              <Form.ErrorList errors={errors} />
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  )
}
