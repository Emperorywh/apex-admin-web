/**
 * 推送地图版本弹窗（P09）：真实 pushMapInfoVersion 接入（旧 PushVersionModal 等价迁移）。
 *
 * 交互与契约要点：
 * - 车辆多选复用共享契约 getSimpleVehicles（fetchSimpleVehicles，P03 代建、
 *   P04/P20 消费者同一数据源）；缺 key 的条目过滤（无标识无法作为选项值）；
 * - 推送目标至少一辆（旧实现同校验），vehicleKeys 提交选项 key 原样；
 * - SLAM 底图开关默认关（旧实现同默认），随版本是否推送由用户显式选择；
 * - 命令受理 ≠ 最终结果：成功提示按「后端受理」语义（推送记录页 P12 核实状态），
 *   不伪造逐车成功（A14/A15）；
 * - 关闭即重置选择与开关（旧 destroyOnClose 同语义；命令弹窗不做草稿保留）；
 * - 提交防重复（confirmLoading + pushing 早退）。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Form, Modal, Switch, Transfer } from 'antd'
import type { TransferProps } from 'antd'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { fetchSimpleVehicles } from '@/services/vehicle/vehicle.service'
import { pushMapVersion } from '@/services/map/map-admin.service'

/** 穿梭框选项形状（Transfer 要求 key 为 string） */
interface VehicleOption {
  key: string
  name: string
}

interface PushVersionModalProps {
  open: boolean
  /** 待推送的地图版本 id（int64；调用方保证非空才打开） */
  mapVersionId: number | null
  onClose: () => void
  /** 推送成功后的回调（版本弹窗刷新列表） */
  onSucceeded: () => void
}

export function PushVersionModal({ open, mapVersionId, onClose, onSucceeded }: PushVersionModalProps) {
  const { t } = useTranslation('mapList')
  const { message } = App.useApp()

  // 车辆选项与已选集合（每次打开重新加载，关闭重置——旧实现同语义）
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [targetKeys, setTargetKeys] = useState<string[]>([])
  const [slamEnabled, setSlamEnabled] = useState(false)
  const [loadingVehicles, setLoadingVehicles] = useState(false)
  const [pushing, setPushing] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingVehicles(true)
    setTargetKeys([])
    setSlamEnabled(false)
    fetchSimpleVehicles()
      .then((list) => {
        if (cancelled) return
        // 缺 key 条目过滤：无标识车辆无法作为推送目标回显/提交
        setVehicles(
          list
            .filter((item) => typeof item?.key === 'string' && item.key !== '')
            .map((item) => ({ key: item.key as string, name: item.name || (item.key as string) })),
        )
      })
      .catch((error: unknown) => {
        if (cancelled || isCancelledError(error)) return
        // 加载失败：选项区呈现真实空集合 + 错误提示，不冒充成功（A11）
        setVehicles([])
        message.error(t('获取车辆列表出错：{{msg}}', { msg: apiErrorMessage(error) }))
      })
      .finally(() => {
        if (!cancelled) setLoadingVehicles(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, message, t])

  const handleTransferChange: TransferProps['onChange'] = (nextTargetKeys) => {
    setTargetKeys(nextTargetKeys as string[])
  }

  const handleClose = useCallback(() => {
    setTargetKeys([])
    setSlamEnabled(false)
    onClose()
  }, [onClose])

  const handleOk = async () => {
    if (targetKeys.length === 0) {
      message.warning(t('请至少选择一辆车辆'))
      return
    }
    if (pushing || mapVersionId === null) return
    setPushing(true)
    try {
      await pushMapVersion({
        mapVersionId,
        vehicleKeys: targetKeys,
        enabledPushSlamMap: slamEnabled,
      })
      message.success(t('推送版本成功'))
      onSucceeded()
      handleClose()
    } catch (error) {
      if (!isCancelledError(error)) {
        message.error(t('推送版本出错：{{msg}}', { msg: apiErrorMessage(error) }))
      }
    } finally {
      setPushing(false)
    }
  }

  // 穿梭框搜索：按展示名/ key 不区分大小写过滤（旧实现同规则）
  const filterOption = useMemo(
    () => (inputValue: string, item: VehicleOption) =>
      (item.name || item.key).toLowerCase().includes(inputValue.toLowerCase()),
    [],
  )

  return (
    <Modal
      title={t('推送地图版本')}
      open={open}
      onOk={handleOk}
      onCancel={handleClose}
      confirmLoading={pushing}
      // 车辆选项加载中禁止提交（无选项可选时推送无意义）
      okButtonProps={{ disabled: loadingVehicles }}
      okText={t('确认推送')}
      cancelText={t('取消')}
      width={1000}
      destroyOnHidden
    >
      {/* 标签横排居左（视觉规范）：6/18 分栏（Modal 内表单既定参数） */}
      <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }} autoComplete="off">
        <Form.Item label={t('选择车辆')}>
          {/* antd 5.6+ 车辆列表加载态由 rows 渲染体现；Transfer 一页全量选项 */}
          <Transfer
            dataSource={vehicles}
            titles={[t('未选车辆'), t('已选车辆')]}
            targetKeys={targetKeys}
            onChange={handleTransferChange}
            render={(item) => item.name || item.key}
            rowKey={(item) => item.key}
            listStyle={{ width: 450, height: 400 }}
            showSearch
            filterOption={filterOption}
          />
        </Form.Item>
        <Form.Item label={t('推送SLAM底图')}>
          <Switch
            checked={slamEnabled}
            onChange={setSlamEnabled}
            checkedChildren={t('开')}
            unCheckedChildren={t('关')}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
