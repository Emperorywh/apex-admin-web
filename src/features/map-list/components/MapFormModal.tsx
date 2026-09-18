/**
 * 新增/编辑地图弹窗（P09）：真实 createMap/updateMap 接入（旧 MapModal 等价迁移）。
 *
 * 交互与契约要点：
 * - 新增模式（editTarget=null）：草稿保留（A13/DoD 7）——关闭弹窗不清空输入，
 *   草稿留页签内存（Activity 缓存切页不丢），提交成功才清空；显式「清空」入口；
 * - 编辑模式（editTarget 非 null）：打开时按行记录重填（旧实现同语义）；
 *   旧实现编辑时地图名称禁用、提交不含 mapName（updateMap 按 mapKey 定位，
 *   只提交 mapState/floor），本重写保持同边界；
 * - 失败留稿：提交失败保留全部输入并提示，写操作不自动重试；
 * - 楼层为 -200~200 整数（旧 InputNumber min/max/precision=0 同边界）；
 * - 提交防重复（confirmLoading + submitting 早退）。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Form, Input, InputNumber, Modal, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { useTabDirtyGuard } from '@/hooks/useTabDirtyGuard'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { createMap, updateMap } from '@/services/map/map-admin.service'
import type { MapInfoDto } from '@/services/map/map-admin.service.types'

/** 表单值形状（字段名与协议 DTO 同名） */
interface MapFormValues {
  mapName: string
  mapState?: string
  floor?: number
}

interface MapFormModalProps {
  open: boolean
  /** 编辑目标行；null = 新增模式 */
  editTarget: MapInfoDto | null
  onClose: () => void
  /** 提交成功后回调（页面刷新列表；本组件已自行复位表单） */
  onSucceeded: () => void
}

export function MapFormModal({ open, editTarget, onClose, onSucceeded }: MapFormModalProps) {
  const { t } = useTranslation('mapList')
  const { message } = App.useApp()
  const [form] = Form.useForm<MapFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const isEdit = editTarget !== null

  // 地图状态选项（协议枚举 ENABLED/DISABLED 原值提交；标签走 i18n）
  const mapStateOptions = useMemo(
    () => [
      { value: 'ENABLED', label: t('启用') },
      { value: 'DISABLED', label: t('禁用') },
    ],
    [t],
  )

  // 草稿脏标记：任何输入即登记到页签（关页/刷新统一确认、LRU 豁免）
  const [dirty, setDirty] = useState(false)
  useTabDirtyGuard(dirty, isEdit ? t('编辑地图') : t('创建地图'))

  // 目标切换语义：编辑目标出现时按行记录重填；编辑目标清除（转新增）时复位
  // 干净基线。新增模式自身的草稿保留不受影响（新增期间 editTarget 恒为 null）。
  useEffect(() => {
    if (editTarget) {
      form.setFieldsValue({
        mapName: editTarget.mapName ?? '',
        mapState: editTarget.mapState,
        floor: editTarget.floor,
      })
    } else {
      form.resetFields()
    }
    setDirty(false)
  }, [editTarget, form])

  const handleValuesChange = useCallback(() => setDirty(true), [])

  /** 清空表单：显式用户动作；提交成功后也走这里复位干净基线 */
  const handleResetDraft = () => {
    form.resetFields()
    setDirty(false)
  }

  const handleClose = () => {
    // 关闭保留草稿（DoD 7）；丢弃路径是显式「清空」按钮
    onClose()
  }

  const handleOk = async () => {
    const values = await form.validateFields()
    if (submitting) return
    setSubmitting(true)
    try {
      if (isEdit && editTarget) {
        // 编辑按 mapKey 定位（协议原样），名称不可改（旧实现同边界）
        await updateMap({
          mapKey: editTarget.mapId ?? '',
          mapState: values.mapState ?? '',
          floor: values.floor as number,
        })
        message.success(t('更新地图信息成功'))
      } else {
        await createMap({
          mapName: values.mapName.trim(),
          mapState: values.mapState ?? '',
          floor: values.floor as number,
        })
        message.success(t('创建地图成功'))
      }
      // 成功才清空草稿并复位；失败路径保留输入（写操作不自动重试）
      handleResetDraft()
      onSucceeded()
    } catch (error) {
      if (!isCancelledError(error)) {
        const reason = t(isEdit ? '更新地图信息出错：{{msg}}' : '创建地图出错：{{msg}}', {
          msg: apiErrorMessage(error),
        })
        message.error(reason)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={isEdit ? t('编辑地图') : t('创建地图')}
      open={open}
      onOk={handleOk}
      onCancel={handleClose}
      // 草稿弹窗：关闭不销毁内容（新增草稿保留在页签内存）
      destroyOnHidden={false}
      width={520}
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
      {/* 标签横排居左（视觉规范）：6/18 分栏（Modal/Drawer 内表单既定参数） */}
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
        onValuesChange={handleValuesChange}
        initialValues={{ mapName: '' }}
      >
        <Form.Item
          label={t('地图名称')}
          name="mapName"
          rules={[{ required: true, message: t('请输入地图名称!') }]}
        >
          {/* 名称上限 64 字（旧实现 maxLength 同边界）；编辑模式禁用（旧实现同语义） */}
          <Input maxLength={64} showCount placeholder={t('请输入地图名称')} disabled={isEdit} />
        </Form.Item>

        <Form.Item
          label={t('地图状态')}
          name="mapState"
          rules={[{ required: true, message: t('请选择地图状态!') }]}
        >
          <Select placeholder={t('请选择地图状态')} options={mapStateOptions} />
        </Form.Item>

        <Form.Item
          label={t('楼层')}
          name="floor"
          rules={[{ required: true, message: t('请输入地图所属楼层!') }]}
        >
          {/* 楼层整数 -200~200（旧实现 min/max/precision 同边界） */}
          <InputNumber
            placeholder={t('请输入地图所属楼层')}
            style={{ width: '100%' }}
            min={-200}
            max={200}
            precision={0}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
