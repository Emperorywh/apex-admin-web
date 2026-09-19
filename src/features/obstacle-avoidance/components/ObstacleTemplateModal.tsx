/**
 * 新增/编辑避障模板弹窗（P22 整页重写，旧 ObstacleTemplateModal 等价迁移）。
 *
 * 交互与契约要点：
 * - 双模式：新增（editTarget=null）/编辑（按行记录重填；updateObstacleAvoidance
 *   按 int64 主键 id 定位、parameters 整体替换——旧实现同边界：编辑时名称与
 *   参数集合均可改，协议仅提交 id/名称/参数三字段）；
 * - 模板选择：Transfer 穿梭框（数据源为前端预置 14 模板项，见
 *   obstacleTemplateData.ts），titles/actions/搜索占位与旧版逐项一致；
 * - 参数配置：已选模板逐行配置避障参数类型（avoid）与启用状态（enable）——
 *   行表格基座按「业务表格统一 Apex」纪律改 ApexTableReact data 模式
 *   （P07/P13 同款：真实草稿数据的编辑载体）；类型下拉选项 label 以
 *   `${文案} (${value})` 形式识别具体标识，下拉底部支持自定义添加
 *   （popupRender 为 antd v6 对旧 dropdownRender 的替代；value 按
 *   `${key}_index_${nextIndex}` 规则生成，历史数据回显依赖该规则）；
 * - 编辑回填算法（与旧实现逐分支一致）：parameter 先按 avoid 精确/前缀匹配
 *   模板 key，回退按 name 匹配模板名；历史自定义项按 `${key}_index_${n}` 还原；
 *   完全无法识别归属的 parameter 旧实现静默丢弃——本实现保留该提交语义
 *   （保存按已选模板重建 parameters），但丢弃计数以状态文本可见化（P22 专项
 *   「未知值按契约处理」：不静默伪装），不发明旧版没有的编辑控件；
 * - 文案翻译时机：avoid 选项 label（「默认」/「自定义N」形态）在渲染侧统一
 *   翻译（label 为待翻译简中 key，数字拼死形态经正则反解），回填 effect 不经
 *   t()，语言切换实时生效且不触发回填重跑（防草稿被重置）；
 * - 失败留稿（A13/DoD 7）：关闭弹窗不清空输入，提交失败输入保留；
 *   useTabDirtyGuard 登记脏页签；提交防重复（submitting 早退 + 按钮 loading）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Divider, Form, Input, Modal, Select, Switch, Transfer } from 'antd'
import type { InputRef, TransferProps } from 'antd'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ApexTableReact } from 'apex-table-react'
import type { ApexColumnDef } from 'apex-table-react'
import { useApexLocale } from '@/hooks/useApexLocale'
import { useTabDirtyGuard } from '@/hooks/useTabDirtyGuard'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import {
  createObstacleAvoidance,
  updateObstacleAvoidance,
} from '@/services/obstacle-avoidance/obstacle-avoidance.service'
import type {
  ObstacleAvoidanceDto,
  ObstacleAvoidanceParameterDto,
} from '@/services/obstacle-avoidance/obstacle-avoidance.service.types'
import {
  ObstacleAvoidanceTemplateData,
  type AvoidItem,
  type ObstacleTemplateItem,
} from '@/features/obstacle-avoidance/components/obstacleTemplateData'

/** 穿梭框条目（key 为模板 key；title 为模板名当前语言文案） */
interface TransferItem {
  key: string
  title: string
}

/** 已选模板行的参数配置（以模板 key 为索引） */
interface ParamConfig {
  avoid?: string
  enable: boolean
}

/** 参数配置表行（Apex data 行记录：key 为模板 key，行标识稳定） */
interface ParamRow {
  key: string
}

interface AvoidParamSelectProps {
  baseList: AvoidItem[]
  extraList: AvoidItem[]
  value?: string
  onChange: (value: string) => void
  onAddItem: (label: string) => void
}

/**
 * 避障参数类型选项 label 翻译（渲染侧统一入口）：
 * 数据源 label 为简中待翻译形态——「默认」/「自定义N」（数字拼死，与旧实现
 * 一致），命中形态经 t() 翻译；用户自定义添加的任意文本原文展示。
 */
function translateAvoidLabel(label: string, t: TFunction<'obstacleTemplate'>): string {
  const custom = /^自定义(\d+)$/.exec(label)
  if (label === '默认') {
    return t('默认')
  }
  if (custom) {
    return t('自定义{{index}}', { index: Number(custom[1]) })
  }
  return label
}

/**
 * 避障参数类型选择器（旧 AvoidParamSelect 等价迁移）：
 * - option label 以 `${文案} (${value})` 形式显示，便于识别具体标识；
 * - 下拉底部支持用户自定义添加（空输入早退；添加后清空输入框并回焦）。
 */
function AvoidParamSelect({
  baseList,
  extraList,
  value,
  onChange,
  onAddItem,
}: AvoidParamSelectProps) {
  const { t } = useTranslation('obstacleTemplate')
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<InputRef>(null)

  const options = useMemo(
    () => [
      ...baseList.map((item) => ({
        value: item.value,
        label: `${translateAvoidLabel(item.label, t)} (${item.value})`,
      })),
      ...extraList.map((item) => ({
        value: item.value,
        label: `${translateAvoidLabel(item.label, t)} (${item.value})`,
      })),
    ],
    [baseList, extraList, t],
  )

  /** 添加自定义项（空输入早退；旧实现同交互） */
  const handleAdd = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    const label = inputValue.trim()
    if (!label) return
    onAddItem(label)
    setInputValue('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <Select
      style={{ width: '100%' }}
      size="small"
      value={value}
      options={options}
      placeholder={t('请选择避障参数类型')}
      onChange={onChange}
      showSearch
      optionFilterProp="label"
      popupRender={(menu) => (
        <>
          {menu}
          <Divider style={{ margin: '4px 0' }} />
          <div
            style={{ padding: '0 8px 4px' }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Input
              ref={inputRef}
              size="small"
              placeholder={t('请输入自定义名称')}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd(e)
              }}
              maxLength={32}
            />
            <Button type="text" size="small" icon={<Plus size={12} />} onClick={handleAdd}>
              {t('添加')}
            </Button>
          </div>
        </>
      )}
    />
  )
}

interface ObstacleTemplateModalProps {
  open: boolean
  /** 编辑目标行；null = 新增模式 */
  editTarget: ObstacleAvoidanceDto | null
  onClose: () => void
  /** 提交成功后回调（页面刷新列表；本组件已自行复位草稿） */
  onSucceeded: () => void
}

export function ObstacleTemplateModal({
  open,
  editTarget,
  onClose,
  onSucceeded,
}: ObstacleTemplateModalProps) {
  const { t } = useTranslation('obstacleTemplate')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()
  const [form] = Form.useForm<{ obstacleAvoidanceName: string }>()
  const [submitting, setSubmitting] = useState(false)
  const isEdit = editTarget !== null

  // Transfer 已选模板 key 列表（保持用户添加/回填顺序，保存按此顺序重建参数集合）
  const [targetKeys, setTargetKeys] = useState<string[]>([])
  // Transfer 当前勾选（待移动）的 key：与已选集合分离，勾选后取消不污染已选
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  // 每个已选模板对应的参数配置（以模板 key 为索引）
  const [paramConfigs, setParamConfigs] = useState<Record<string, ParamConfig>>({})
  // 用户为每个模板额外添加的自定义避障项（以模板 key 为索引）
  const [customAvoidItems, setCustomAvoidItems] = useState<Record<string, AvoidItem[]>>({})
  // 无法识别归属、保存后将不保留的参数计数（状态文本可见化，无按钮）
  const [unrecognizedCount, setUnrecognizedCount] = useState(0)

  // 草稿脏标记：任何输入即登记到页签（关页/刷新统一确认、LRU 豁免）
  const [dirty, setDirty] = useState(false)
  useTabDirtyGuard(dirty, isEdit ? t('编辑避障模板') : t('新增避障模板'))

  // 以 key 为索引的模板表（预置数据，模块级常量）
  const templateMap = useMemo(() => {
    const map: Record<string, ObstacleTemplateItem> = {}
    ObstacleAvoidanceTemplateData.forEach((item) => {
      map[item.key] = item
    })
    return map
  }, [])

  // 穿梭框数据源（key 使用模板 key，title 展示模板名的当前语言文案）
  const transferData = useMemo<TransferItem[]>(
    () =>
      ObstacleAvoidanceTemplateData.map((item) => ({ key: item.key, title: t(item.name) })),
    [t],
  )

  /**
   * 将历史 parameter 匹配到模板（旧 findTemplate 逐分支一致）：
   * 优先按 avoid 精确等于模板 key 或以 `${key}_` 为前缀匹配，回退按 name 匹配模板名。
   */
  const findTemplate = useCallback(
    (p: ObstacleAvoidanceParameterDto): ObstacleTemplateItem | undefined => {
      const avoid = p.avoid
      if (avoid) {
        const byAvoid = ObstacleAvoidanceTemplateData.find(
          (item) => avoid === item.key || avoid.startsWith(`${item.key}_`),
        )
        if (byAvoid) return byAvoid
      }
      if (p.name) {
        return ObstacleAvoidanceTemplateData.find((item) => item.name === p.name)
      }
      return undefined
    },
    [],
  )

  /** 编辑态回填 / 新增态复位（编辑目标出现时重填；转新增时复位干净基线）。
   * 自定义项 label 保存简中待翻译形态，翻译推迟到渲染侧（本 effect 不经 t） */
  useEffect(() => {
    if (!open) return
    if (editTarget) {
      form.setFieldsValue({ obstacleAvoidanceName: editTarget.obstacleAvoidanceName ?? '' })
      const keys: string[] = []
      const configs: Record<string, ParamConfig> = {}
      const customs: Record<string, AvoidItem[]> = {}
      let unrecognized = 0
      editTarget.parameters?.forEach((p) => {
        const tpl = findTemplate(p)
        // 无法识别归属的参数：旧实现静默丢弃；此处仅计数，弹窗内状态文本可见化
        if (!tpl) {
          unrecognized += 1
          return
        }
        if (keys.includes(tpl.key)) return
        keys.push(tpl.key)

        let avoidValue: string | undefined
        const avoidValid = tpl.avoidList.some((a) => a.value === p.avoid)
        if (avoidValid) {
          avoidValue = p.avoid
        } else if (p.avoid && p.avoid.startsWith(`${tpl.key}_index_`)) {
          // 历史保存的自定义项：按 `${key}_index_${n}` 规则还原待翻译 label
          const idx = Number(p.avoid.slice(`${tpl.key}_index_`.length))
          if (Number.isFinite(idx) && idx >= 0) {
            if (!customs[tpl.key]) customs[tpl.key] = []
            if (!customs[tpl.key].some((i) => i.value === p.avoid)) {
              customs[tpl.key].push({
                value: p.avoid,
                label: idx === 0 ? '默认' : `自定义${idx}`,
              })
            }
            avoidValue = p.avoid
          }
        }
        configs[tpl.key] = {
          avoid: avoidValue ?? tpl.avoidList[0]?.value,
          enable: !!p.enable,
        }
      })
      setTargetKeys(keys)
      setParamConfigs(configs)
      setCustomAvoidItems(customs)
      setUnrecognizedCount(unrecognized)
    } else {
      form.resetFields()
      setTargetKeys([])
      setParamConfigs({})
      setCustomAvoidItems({})
      setUnrecognizedCount(0)
    }
    setSelectedKeys([])
    setDirty(false)
  }, [open, editTarget, form, findTemplate])

  /** 有任何输入即视为脏（名称输入/穿梭框移动/配置修改统一走这里） */
  const markDirty = useCallback(() => setDirty(true), [])

  /** 穿梭框移动：右移为新项初始化默认配置，左移清理配置与自定义项（旧实现同语义） */
  const handleTransferChange: TransferProps<TransferItem>['onChange'] = (
    nextTargetKeys,
    direction,
    moveKeys,
  ) => {
    const keys = (nextTargetKeys ?? []).map(String)
    const movedKeys = moveKeys.map(String)
    setTargetKeys(keys)
    markDirty()
    if (direction === 'right') {
      setParamConfigs((prev) => {
        const next = { ...prev }
        movedKeys.forEach((key) => {
          if (!next[key]) {
            next[key] = {
              avoid: templateMap[key]?.avoidList?.[0]?.value,
              enable: false,
            }
          }
        })
        return next
      })
    } else if (direction === 'left') {
      setParamConfigs((prev) => {
        const next = { ...prev }
        movedKeys.forEach((key) => {
          delete next[key]
        })
        return next
      })
      setCustomAvoidItems((prev) => {
        const next = { ...prev }
        movedKeys.forEach((key) => {
          delete next[key]
        })
        return next
      })
    }
  }

  /** 两侧条目勾选态：勾选不等于移动，单独受控（取消勾选不污染已选集合） */
  const handleSelectChange: TransferProps<TransferItem>['onSelectChange'] = (
    sourceKeys,
    targetSelected,
  ) => {
    setSelectedKeys([...sourceKeys.map(String), ...targetSelected.map(String)])
  }

  /** 更新指定模板的参数配置（类型/启用开关共用） */
  const updateParamConfig = useCallback(
    (key: string, patch: Partial<ParamConfig>) => {
      markDirty()
      setParamConfigs((prev) => ({
        ...prev,
        [key]: { ...prev[key], enable: prev[key]?.enable ?? false, ...patch },
      }))
    },
    [markDirty],
  )

  /** 从已选模板中移除一项：等同 Transfer 左移（配置与自定义项一并清理） */
  const removeTemplate = useCallback(
    (key: string) => {
      markDirty()
      setTargetKeys((prev) => prev.filter((k) => k !== key))
      setSelectedKeys((prev) => prev.filter((k) => k !== key))
      setParamConfigs((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      setCustomAvoidItems((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    [markDirty],
  )

  /** 为指定模板追加自定义避障项：value = `${key}_index_${base+extra}`（数据源规则） */
  const addCustomAvoidItem = useCallback(
    (templateKey: string, label: string) => {
      const trimmed = label.trim()
      if (!trimmed) return
      setCustomAvoidItems((prev) => {
        const extra = prev[templateKey] || []
        const nextIndex = (templateMap[templateKey]?.avoidList || []).length + extra.length
        const value = `${templateKey}_index_${nextIndex}`
        return { ...prev, [templateKey]: [...extra, { value, label: trimmed }] }
      })
    },
    [templateMap],
  )

  /**
   * 提交：编辑按 id 定位整体替换；创建提交名称与参数集合（协议原样，顺序即
   * 已选模板顺序）。校验链与旧实现一致：名称必填 → 至少一项模板 → 逐项必有类型。
   */
  const handleOk = async () => {
    let values: { obstacleAvoidanceName: string }
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    if (submitting) return
    if (targetKeys.length === 0) {
      message.warning(t('请至少选择一项避障模板'))
      return
    }
    for (const key of targetKeys) {
      const tpl = templateMap[key]
      if (!paramConfigs[key]?.avoid) {
        message.warning(t('请为"{{name}}"选择避障参数类型', { name: t(tpl?.name || key) }))
        return
      }
    }
    const parameters: ObstacleAvoidanceParameterDto[] = targetKeys.map((key) => ({
      name: templateMap[key]?.name || key,
      avoid: paramConfigs[key].avoid as string,
      enable: !!paramConfigs[key].enable,
    }))
    setSubmitting(true)
    try {
      if (isEdit && editTarget) {
        await updateObstacleAvoidance({
          id: editTarget.id as number,
          obstacleAvoidanceName: values.obstacleAvoidanceName.trim(),
          parameters,
        })
        message.success(t('更新避障数据成功'))
      } else {
        await createObstacleAvoidance({
          obstacleAvoidanceName: values.obstacleAvoidanceName.trim(),
          parameters,
        })
        message.success(t('创建避障数据成功'))
      }
      // 成功才复位并刷新列表；失败路径保留输入（写操作不自动重试）
      form.resetFields()
      setTargetKeys([])
      setSelectedKeys([])
      setParamConfigs({})
      setCustomAvoidItems({})
      setUnrecognizedCount(0)
      setDirty(false)
      onSucceeded()
    } catch (error) {
      if (!isCancelledError(error)) {
        const reason = t(isEdit ? '更新避障数据出错：{{msg}}' : '创建避障数据出错：{{msg}}', {
          msg: apiErrorMessage(error),
        })
        message.error(reason)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = useCallback(() => {
    // 关闭保留草稿（DoD 7）；丢弃路径是显式「清空」按钮
    onClose()
  }, [onClose])

  /** 清空草稿：显式用户动作（复位到干净基线） */
  const handleResetDraft = useCallback(() => {
    form.resetFields()
    setTargetKeys([])
    setSelectedKeys([])
    setParamConfigs({})
    setCustomAvoidItems({})
    setUnrecognizedCount(0)
    setDirty(false)
  }, [form])

  // 参数配置表行（已选模板顺序；Apex 行 ID=模板 key，主子表行标识稳定）
  const tableData = useMemo<ParamRow[]>(
    () => targetKeys.map((key) => ({ key })),
    [targetKeys],
  )

  /** 参数配置表列：模板名/类型下拉/启用开关/移除（旧 paramColumns 逐列核对） */
  const paramColumns = useMemo<ApexColumnDef<ParamRow>[]>(
    () => [
      {
        // 避障名称：模板名当前语言文案（width 200 同旧）
        id: 'name',
        accessorKey: 'key',
        header: t('避障名称'),
        enableSorting: false,
        size: 200,
        cell: ({ row }) => t(templateMap[row.original.key]?.name || row.original.key),
      },
      {
        // 避障参数类型：AvoidParamSelect（含自定义添加；width 200 同旧）
        id: 'avoid',
        header: t('避障参数类型'),
        enableSorting: false,
        size: 200,
        cell: ({ row }) => {
          const key = row.original.key
          return (
            <AvoidParamSelect
              baseList={templateMap[key]?.avoidList || []}
              extraList={customAvoidItems[key] || []}
              value={paramConfigs[key]?.avoid}
              onChange={(value) => updateParamConfig(key, { avoid: value })}
              onAddItem={(label) => addCustomAvoidItem(key, label)}
            />
          )
        },
      },
      {
        // 是否启用：受控 Switch（width 100 同旧）
        id: 'enable',
        header: t('是否启用'),
        enableSorting: false,
        size: 100,
        cell: ({ row }) => {
          const key = row.original.key
          return (
            <Switch
              size="small"
              checked={!!paramConfigs[key]?.enable}
              onChange={(checked) => updateParamConfig(key, { enable: checked })}
            />
          )
        },
      },
      {
        // 操作：移除（link danger，等同 Transfer 左移）
        id: 'action',
        header: t('操作'),
        enableSorting: false,
        size: 80,
        cell: ({ row }) => (
          <Button
            type="link"
            danger
            size="small"
            onClick={() => removeTemplate(row.original.key)}
          >
            {t('移除')}
          </Button>
        ),
      },
    ],
    [
      t,
      templateMap,
      customAvoidItems,
      paramConfigs,
      updateParamConfig,
      addCustomAvoidItem,
      removeTemplate,
    ],
  )

  /** 穿梭框搜索：本地过滤（旧实现同语义，按展示名匹配） */
  const filterOption: TransferProps<TransferItem>['filterOption'] = (inputValue, item) => {
    return String(item?.title ?? '')
      .toLowerCase()
      .includes(String(inputValue).toLowerCase())
  }

  return (
    <Modal
      title={isEdit ? t('编辑避障模板') : t('新增避障模板')}
      open={open}
      width={1000}
      onOk={handleOk}
      onCancel={handleClose}
      // 草稿弹窗：关闭不销毁内容（新增草稿保留在页签内存）
      destroyOnHidden={false}
      footer={[
        <Button key="reset" onClick={handleResetDraft} disabled={submitting}>
          {t('清空')}
        </Button>,
        <Button key="cancel" onClick={handleClose} disabled={submitting}>
          {t('取消')}
        </Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleOk}>
          {t('确定')}
        </Button>,
      ]}
    >
      {/* 标签横排居左（视觉规范）：6/18 分栏（Modal 内表单既定参数）；
          名称输入经 onValuesChange 统一登记脏标记 */}
      <Form
        name="obstacle-template-form"
        form={form}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
        onValuesChange={markDirty}
      >
        <Form.Item
          label={t('避障名称')}
          name="obstacleAvoidanceName"
          rules={[{ required: true, message: t('请输入避障名称') }]}
        >
          {/* 名称上限 64 字（旧实现 maxLength 同边界） */}
          <Input maxLength={64} showCount placeholder={t('请输入避障名称')} />
        </Form.Item>

        {/* 已选模板实际值以受控 targetKeys 为准（穿梭框移动时同步，顺序即添加
            顺序原样提交）；表单字段承担「至少一项」的必填形态（required 标记） */}
        <Form.Item label={t('选择模板')} required>
          <Transfer<TransferItem>
            dataSource={transferData}
            targetKeys={targetKeys}
            selectedKeys={selectedKeys}
            onChange={handleTransferChange}
            onSelectChange={handleSelectChange}
            filterOption={filterOption}
            render={(item) => item.title}
            titles={[t('可选模板'), t('已选模板')]}
            actions={[t('添加'), t('移除')]}
            showSearch={{ placeholder: t('搜索模板名称') }}
            styles={{ section: { width: 400, height: 320 } }}
          />
        </Form.Item>

        {/* 参数配置表：Apex data 模式（业务表格统一 Apex 纪律；P07/P13 同款——
            已选模板的编辑载体，真实草稿数据非 mock）；行数=已选模板数（≤14），
            虚拟化关闭防编辑控件失焦 */}
        <Form.Item label={t('参数配置')}>
          <ApexTableReact
            columns={paramColumns}
            data={tableData}
            getRowId={(row) => row.key}
            locale={apexLocale}
            density="compact"
            pagination={false}
            virtualization={false}
            height={260}
            columnSettingsEnabled={false}
          />
        </Form.Item>
      </Form>

      {/* 无法识别参数可见化（P22 专项「未知值按契约处理」）：状态文本，无按钮，
          不伪装这些数据会被保留；移除路径即旧实现（保存按已选模板重建集合） */}
      {unrecognizedCount > 0 ? (
        <span style={{ color: 'var(--app-warning-color, #d46b08)', fontSize: 12 }}>
          {t('{{count}} 条避障参数无法识别所属模板，保存后这些参数不会保留', {
            count: unrecognizedCount,
          })}
        </span>
      ) : null}
    </Modal>
  )
}
