/**
 * 新增/编辑跨地图关联弹窗（P10 整页重写，旧 CrossMapModal 等价迁移）。
 *
 * 交互与契约要点：
 * - 双模式：新增（editTarget=null）/编辑（按行记录重填，全字段可改——旧实现同边界，
 *   updateCrossMap 按 int64 主键 id 定位、crossMaps 整体替换）；
 * - 关联行（地图+站点）至少两条（旧实现 Form.List 校验同边界）；同一地图不可在
 *   多行重复选择（旧实现同校验；修复旧版空值误报——未选行不参与查重）；
 * - 站点选项按「行」独立加载（旧实现全局一份会在多行不同地图时串选项，属
 *   正确性修复，与 P03 创建任务行级站点同模式）：行内按当前地图请求、
 *   AbortController 防乱序、地图变更清空站点并按新地图重载（切换地图重新
 *   校验站点）、下拉展开时幂等重查（失败后的可见恢复路径，P03 同语义）；
 * - 失效关联保留原标识（DoD 10）：编辑回显时已选地图/站点/电梯若不在当前
 *   选项集合中，以「原名称（已不在当前选项中）」合成选项保显示（common 公共词），
 *   不静默替换、不静默选第一项；名称缺失退回原始标识；
 * - 必要关联缺失不允许提交：名称/电梯/行地图/行站点必填 + 至少两行（旧实现
 *   同边界）；失效值本身不阻止提交（后端为最终业务裁决，P07 判例同）；
 * - 草稿保留（A13/DoD 7）：关闭弹窗不清空输入（页签内存），显式「清空」入口；
 *   失败留稿；写操作不自动重试；useTabDirtyGuard 登记脏页签；
 * - 提交防重复（submitting 早退 + 按钮 loading）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Card, Form, Input, Modal, Select } from 'antd'
import { X as CloseIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStaticOptions } from '@/hooks/useStaticOptions'
import { useTabDirtyGuard } from '@/hooks/useTabDirtyGuard'
import { missingOptionLabel } from '@/utils/options/optionFallback'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import {
  createCrossMap,
  fetchCrossMapStations,
  fetchElevatorOptions,
  updateCrossMap,
} from '@/services/cross-map/cross-map.service'
import type { CrossMapDto, SimpleStationDto } from '@/services/cross-map/cross-map.service.types'
import { fetchSimpleMaps } from '@/services/map/map.service'
import type { SimpleMapDto } from '@/services/map/map.service.types'
import type { ElevatorOptionDto } from '@/services/cross-map/cross-map.service.types'

/** 表单值形状（字段名与协议 DTO 同名；行集合与 Form.List 对应） */
interface CrossMapFormValues {
  crossMapName: string
  deviceKey?: string
  crossMaps?: {
    mapId?: string
    nodeId?: string
  }[]
}

/** 行内站点选项状态：按行独立加载，互不串选项 */
interface RowStationState {
  options: SimpleStationDto[]
  loading: boolean
  error: boolean
}

interface CrossMapModalProps {
  open: boolean
  /** 编辑目标行；null = 新增模式 */
  editTarget: CrossMapDto | null
  onClose: () => void
  /** 提交成功后回调（页面刷新列表；本组件已自行复位草稿） */
  onSucceeded: () => void
}

export function CrossMapModal({ open, editTarget, onClose, onSucceeded }: CrossMapModalProps) {
  const { t } = useTranslation('crossMap')
  const { t: tCommon } = useTranslation('common')
  const { message } = App.useApp()
  const [form] = Form.useForm<CrossMapFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const isEdit = editTarget !== null

  // 草稿脏标记：任何输入即登记到页签（关页/刷新统一确认、LRU 豁免）
  const [dirty, setDirty] = useState(false)
  useTabDirtyGuard(dirty, isEdit ? t('编辑跨地图关联') : t('创建跨地图关联'))

  // 共享只读选项：地图/电梯（一次性全量；失败清空并呈现状态文本，不冒充成功）
  const simpleMaps = useStaticOptions<SimpleMapDto>((signal) => fetchSimpleMaps({ signal }))
  const elevators = useStaticOptions<ElevatorOptionDto>((signal) =>
    fetchElevatorOptions({ signal }),
  )

  // 订阅关联行集合值：行值（地图/站点）变化驱动本组件重渲染，
  // 行下拉的失效合成项与按行站点状态随之重算（shouldUpdate 无法感知组件 state，
  // useWatch 是行值联动与站点状态联动的统一重渲染入口）
  const crossMapsWatch = Form.useWatch(['crossMaps'], form)

  // 站点选项按行缓存：行索引 → 状态；在途请求经 AbortController 防旧响应覆盖
  const [siteOptions, setSiteOptions] = useState<Record<number, RowStationState>>({})
  const siteAbortRef = useRef(new Map<number, AbortController>())

  /** 清空全部行站点缓存并中止在途请求（复位基线/编辑目标切换/删行共用） */
  const clearAllSiteCaches = useCallback(() => {
    siteAbortRef.current.forEach((controller) => controller.abort())
    siteAbortRef.current.clear()
    setSiteOptions({})
  }, [])

  /**
   * 加载指定行的站点选项：以传入地图为准（缺省从表单读该行当前值），
   * 仅接受最后一次请求结果（行内防乱序）。
   */
  const loadSiteOptions = useCallback(
    (rowIndex: number, mapId?: string) => {
      const effectiveMapId = mapId ?? form.getFieldValue(['crossMaps', rowIndex, 'mapId'])
      if (!effectiveMapId) return
      // 取消该行在途请求：仅保留最后一次触发的结果
      siteAbortRef.current.get(rowIndex)?.abort()
      const controller = new AbortController()
      siteAbortRef.current.set(rowIndex, controller)

      setSiteOptions((prev) => ({
        ...prev,
        [rowIndex]: { options: [], loading: true, error: false },
      }))
      fetchCrossMapStations(effectiveMapId, { signal: controller.signal })
        .then((list) => {
          if (controller.signal.aborted) return
          // 站点按名称自然排序（P03 同口径），便于长列表定位
          const sorted = [...list].sort((a, b) =>
            (a.name ?? '').localeCompare(b.name ?? '', undefined, { numeric: true }),
          )
          setSiteOptions((prev) => ({
            ...prev,
            [rowIndex]: { options: sorted, loading: false, error: false },
          }))
        })
        .catch((error) => {
          // 主动取消静默；真实失败清空该行选项并标错（不残留旧地图站点冒充）
          if (controller.signal.aborted || isCancelledError(error)) return
          setSiteOptions((prev) => ({
            ...prev,
            [rowIndex]: { options: [], loading: false, error: true },
          }))
        })
    },
    [form],
  )

  // 目标切换语义：编辑目标出现时按行记录重填并逐行重新加载站点（切换地图
  // 重新校验站点）；编辑目标清除（转新增）时复位干净基线。新增模式自身的
  // 草稿保留不受影响（新增期间 editTarget 恒为 null）。
  useEffect(() => {
    if (editTarget) {
      form.setFieldsValue({
        crossMapName: editTarget.crossMapName ?? '',
        deviceKey: editTarget.deviceKey,
        crossMaps: (editTarget.crossMaps ?? []).map((item) => ({
          mapId: item.mapId,
          nodeId: item.nodeId,
        })),
      })
      // 逐行按编辑数据加载站点选项（在途旧请求先由 clearAllSiteCaches 中止）
      clearAllSiteCaches()
      ;(editTarget.crossMaps ?? []).forEach((item, index) => {
        if (item.mapId) loadSiteOptions(index, item.mapId)
      })
    } else {
      form.resetFields()
      clearAllSiteCaches()
    }
    setDirty(false)
  }, [editTarget, form, loadSiteOptions, clearAllSiteCaches])

  const handleValuesChange = useCallback(() => setDirty(true), [])

  /** 清空草稿：显式用户动作；提交成功后也走这里复位到干净基线 */
  const handleResetDraft = useCallback(() => {
    clearAllSiteCaches()
    form.resetFields()
    setDirty(false)
  }, [clearAllSiteCaches, form])

  const handleClose = useCallback(() => {
    // 关闭保留草稿（DoD 7）；丢弃路径是显式「清空」按钮
    onClose()
  }, [onClose])

  /**
   * 行地图变更：清空该行站点值（父条件变化重置依赖字段，A17），并按新地图
   * 重新加载站点选项（切换地图重新校验站点）；清空地图时丢弃该行站点缓存。
   */
  const handleRowMapChange = useCallback(
    (rowIndex: number, mapId?: string) => {
      form.setFieldValue(['crossMaps', rowIndex, 'nodeId'], undefined)
      if (mapId) {
        loadSiteOptions(rowIndex, mapId)
      } else {
        siteAbortRef.current.get(rowIndex)?.abort()
        siteAbortRef.current.delete(rowIndex)
        setSiteOptions((prev) => {
          const next = { ...prev }
          delete next[rowIndex]
          return next
        })
      }
    },
    [form, loadSiteOptions],
  )

  /**
   * 移除关联行：Form.List 索引前移会让按索引缓存的站点选项整体错位，
   * 这里直接受控改值并按剩余行的地图全量重建缓存（幂等只读查询，
   * 正确性优先于重复请求开销）。
   */
  const handleRemoveRow = useCallback(
    (rowIndex: number) => {
      const rows = (form.getFieldValue('crossMaps') ??
        []) as NonNullable<CrossMapFormValues['crossMaps']>
      const remaining = rows.filter((_, index) => index !== rowIndex)
      clearAllSiteCaches()
      form.setFieldValue('crossMaps', remaining)
      remaining.forEach((row, index) => {
        if (row?.mapId) loadSiteOptions(index, row.mapId)
      })
    },
    [form, clearAllSiteCaches, loadSiteOptions],
  )

  /** 提交：编辑按 id 定位整体替换；创建提交名称/电梯/行集合（协议原样） */
  const handleOk = async () => {
    let values: CrossMapFormValues
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      const items = (values.crossMaps ?? []).map((row) => ({
        mapId: row.mapId as string,
        nodeId: row.nodeId as string,
      }))
      if (isEdit && editTarget) {
        await updateCrossMap({
          id: editTarget.id as number,
          crossMapName: values.crossMapName.trim(),
          deviceKey: values.deviceKey as string,
          crossMaps: items,
        })
        message.success(t('编辑跨地图关联成功'))
      } else {
        await createCrossMap({
          crossMapName: values.crossMapName.trim(),
          deviceKey: values.deviceKey as string,
          crossMaps: items,
        })
        message.success(t('创建关联地图成功'))
      }
      // 成功才清空草稿并复位；失败路径保留输入（写操作不自动重试）
      handleResetDraft()
      onSucceeded()
    } catch (error) {
      if (!isCancelledError(error)) {
        const reason = t(isEdit ? '编辑跨地图关联出错：{{msg}}' : '创建关联地图出错：{{msg}}', {
          msg: apiErrorMessage(error),
        })
        message.error(reason)
      }
    } finally {
      setSubmitting(false)
    }
  }

  /* ------------------------------ 失效选项合成（DoD 10） ------------------------------ */

  /** 电梯下拉选项：当前选项集合 + 编辑行已选电梯失效时的合成项（保留原标识） */
  const elevatorOptions = useMemo(() => {
    const base = (elevators.options ?? []).map((item) => ({
      value: item.deviceKey as string,
      label: item.deviceName ?? (item.deviceKey as string),
    }))
    const current = editTarget?.deviceKey
    if (current && !(elevators.options ?? []).some((item) => item.deviceKey === current)) {
      // 失效电梯：显示原名称 + 不可用说明；名称缺失退回原始 key
      return [
        { value: current, label: missingOptionLabel(editTarget?.deviceName || current) },
        ...base,
      ]
    }
    return base
  }, [elevators.options, editTarget])

  /**
   * 行地图下拉选项：当前选项集合 + 该行已选地图失效时的合成项。
   * 合成依据 = 编辑行原始数据中同 mapId 的地图名称（新增行不会出现失效值）。
   */
  const mapOptionsForRow = (currentMapId?: string) => {
    const base = (simpleMaps.options ?? []).map((item) => ({
      value: item.mapId as string,
      label: item.mapName ?? (item.mapId as string),
    }))
    if (currentMapId && !(simpleMaps.options ?? []).some((item) => item.mapId === currentMapId)) {
      const raw = editTarget?.crossMaps?.find((item) => item.mapId === currentMapId)
      return [{ value: currentMapId, label: missingOptionLabel(raw?.mapName || currentMapId) }, ...base]
    }
    return base
  }

  /**
   * 行站点下拉选项：该行已加载集合 + 行已选站点失效时的合成项。
   * 合成依据 = 编辑行原始数据中同地图、同 nodeId 的站点名称；站点请求在途
   * 或失败期间同样生效（值有原始名称时始终显示名称而非裸 ID）。
   */
  const stationOptionsForRow = (rowIndex: number, currentNodeId?: string) => {
    const mapId = crossMapsWatch?.[rowIndex]?.mapId
    const loaded = siteOptions[rowIndex]?.options ?? []
    const base = loaded.map((item) => ({
      value: item.id as string,
      label: item.name ?? (item.id as string),
    }))
    if (currentNodeId && !loaded.some((item) => item.id === currentNodeId)) {
      const raw = editTarget?.crossMaps?.find(
        (item) => item.nodeId === currentNodeId && (!mapId || item.mapId === mapId),
      )
      return [
        { value: currentNodeId, label: missingOptionLabel(raw?.nodeName || currentNodeId) },
        ...base,
      ]
    }
    return base
  }

  /** 下拉选项区失败的统一呈现：仅状态文本，不设重试按钮（非表格区域按钮纪律） */
  const failedNotFound = (error: boolean | undefined) =>
    error ? (
      <span style={{ color: 'var(--app-text-secondary, rgba(0, 0, 0, 0.45))', fontSize: 12 }}>
        {tCommon('加载失败')}
      </span>
    ) : undefined

  return (
    <Modal
      title={isEdit ? t('编辑跨地图关联') : t('创建跨地图关联')}
      open={open}
      onOk={handleOk}
      onCancel={handleClose}
      // 草稿弹窗：关闭不销毁内容（新增草稿保留在页签内存）
      destroyOnHidden={false}
      width={640}
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
      {/* 标签横排居左（视觉规范）：6/18 分栏（Modal 内表单既定参数） */}
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
        onValuesChange={handleValuesChange}
        initialValues={{ crossMapName: '' }}
      >
        <Form.Item
          label={t('跨地图名称')}
          name="crossMapName"
          rules={[{ required: true, message: t('请输入跨地图名称') }]}
        >
          {/* 名称上限 64 字（旧实现 maxLength 同边界） */}
          <Input maxLength={64} showCount placeholder={t('请输入跨地图名称')} allowClear />
        </Form.Item>

        <Form.Item
          label={t('跨地图电梯')}
          name="deviceKey"
          rules={[{ required: true, message: t('请选择跨地图电梯') }]}
        >
          <Select
            placeholder={t('请选择跨地图电梯')}
            allowClear
            showSearch
            optionFilterProp="label"
            loading={elevators.loading}
            options={elevatorOptions}
            notFoundContent={failedNotFound(elevators.error)}
          />
        </Form.Item>

        {/*
          关联行集合：至少两条（旧实现同校验）；行地图查重按「恰好一行命中」
          判定，空值跳过查重（required 单独报错，修复旧版多空行误报）。
        */}
        <Form.List
          name="crossMaps"
          rules={[
            {
              validator: async (_, value) => {
                if (!value || value.length < 2) {
                  return Promise.reject(new Error(t('至少关联两张地图')))
                }
                return Promise.resolve()
              },
            },
          ]}
        >
          {(fields, { add }, { errors }) => (
            <div style={{ display: 'flex', rowGap: 12, flexDirection: 'column' }}>
              {fields.map((field) => {
                // 行当前值经 useWatch 驱动（失效合成项/站点联动输入）
                const rowValue = crossMapsWatch?.[field.name]
                return (
                  <Card
                    size="small"
                    /* 行标题：地图 {index}（旧实现同形态，1 起计数） */
                    title={t('地图 {{index}}', { index: field.name + 1 })}
                    key={field.key}
                    extra={
                      <CloseIcon
                        size={14}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleRemoveRow(field.name)}
                      />
                    }
                  >
                    <Form.Item
                      label={t('地图名称')}
                      name={[field.name, 'mapId']}
                      validateFirst
                      rules={[
                        { required: true, message: t('请选择地图名称') },
                        {
                          validator: (_, value) => {
                            // 空值交给 required 报错；非空时要求全表恰好一行命中
                            if (!value) return Promise.resolve()
                            const rows = (form.getFieldValue('crossMaps') ??
                              []) as NonNullable<CrossMapFormValues['crossMaps']>
                            const hits = rows.filter((row) => row?.mapId === value)
                            return hits.length === 1
                              ? Promise.resolve()
                              : Promise.reject(new Error(t('不能重复选择相同的地图')))
                          },
                        },
                      ]}
                    >
                      <Select
                        placeholder={t('请选择地图名称')}
                        showSearch
                        allowClear
                        optionFilterProp="label"
                        loading={simpleMaps.loading}
                        options={mapOptionsForRow(rowValue?.mapId)}
                        onChange={(value?: string) => handleRowMapChange(field.name, value)}
                        notFoundContent={failedNotFound(simpleMaps.error)}
                      />
                    </Form.Item>

                    <Form.Item
                      label={t('节点名称')}
                      name={[field.name, 'nodeId']}
                      rules={[{ required: true, message: t('请选择节点名称') }]}
                    >
                      <Select
                        placeholder={t('请选择节点名称')}
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        loading={siteOptions[field.name]?.loading === true}
                        options={stationOptionsForRow(field.name, rowValue?.nodeId)}
                        notFoundContent={failedNotFound(siteOptions[field.name]?.error === true)}
                        onOpenChange={(isOpen) => {
                          // 展开下拉时按该行当前地图幂等重查（失败后的可见恢复路径）
                          if (isOpen && rowValue?.mapId) loadSiteOptions(field.name, rowValue.mapId)
                        }}
                      />
                    </Form.Item>
                  </Card>
                )
              })}
              <Button type="dashed" onClick={() => add()} block>
                {t('+ 添加关联地图')}
              </Button>
              {/* Form.List 顶层校验错误（至少两条）走官方 ErrorList 呈现 */}
              <Form.ErrorList errors={errors} />
            </div>
          )}
        </Form.List>
      </Form>
    </Modal>
  )
}
