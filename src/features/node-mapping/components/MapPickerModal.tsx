/**
 * 地图选点二级弹窗（P07；迁移自旧 MappingModal/MapPickerModal，
 * 决策依据 docs/SPEC_node_mapping_map_picker.md §3，地图画布复用 T00 ReadOnlyMap）。
 *
 * 交互契约：
 * - 单选节点：onChange 取 [0]（selectMode="node" 下路径只可定位不可选中）；
 * - 确定禁用态：当前无选中即禁用（含点空白清除选中、回显节点已失效等场景）；
 * - 回显与定位：initialSelectedIds + defaultFocus 打开即定位当前节点（不闪烁）；
 *   initialSelectedIds 按 echoNodeId 记忆化——引用不稳定会被组件误判为
 *   「回显变化」而重置用户改选（旧实现实证过的坑）；
 * - 失效节点：ReadOnlyMap 静默忽略不存在的 ID（地图无高亮、确定禁用）；
 *   上层以 nodeIdSet（下拉框节点缓存）判定，仅在该集合已加载且不含该 ID 时
 *   红色标注「已不在地图上」，未加载不标注避免误标；
 * - 每次打开独立拉图（ReadOnlyMap 内部 fetchMapGraph；destroyOnHidden 保证
 *   视角/选中态不残留）；加载/失败/空态由组件内闭环，本层不重复处理。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from 'antd'
import { useTranslation } from 'react-i18next'
import { ReadOnlyMap } from '@/components/ReadOnlyMap/ReadOnlyMap'
import type { MapSelectedItem } from '@/components/ReadOnlyMap/ReadOnlyMap.types'
import type {
  MapGroupDraft,
  MappingRowDraft,
} from '@/features/node-mapping/types'
import type { MappingNodeDto } from '@/services/vehicle/node-mapping.service.types'
import styles from './MapPickerModal.module.css'

/** 选点目标：外层按 pickerTarget 解析出的组与行（弹窗打开期间外层被遮罩阻隔，行数据不变） */
export interface MapPickerTarget {
  group: MapGroupDraft
  row: MappingRowDraft
}

interface MapPickerModalProps {
  /** 选点目标；null 表示弹窗关闭 */
  target: MapPickerTarget | null
  /** 目标地图已加载的节点 ID 集合（失效标注用；undefined = 尚未加载，不标注） */
  nodeIdSet?: Set<string>
  /** 确定回填（外层复用行内下拉选节点的回填语义：映射点仅未手填时跟随） */
  onOk: (node: MappingNodeDto) => void
  /** 关闭弹窗（取消路径；确定由外层回填后自行关闭） */
  onClose: () => void
}

export function MapPickerModal({ target, nodeIdSet, onOk, onClose }: MapPickerModalProps) {
  const { t } = useTranslation('nodeMapping')

  /**
   * 弹窗内实时选中的节点；null = 无选中 → 确定按钮禁用。
   * MapNodeDto 整体持有，确定时转换为 MappingNodeDto（nodeId/nodeName/x/y）。
   */
  const [picked, setPicked] = useState<MapSelectedItem | null>(null)

  /**
   * 缓存最后一次非空目标：关闭动画期间 target 已置 null，
   * Modal 内容（销毁前）仍需最后一帧数据渲染（旧实现同处理）。
   */
  const lastTargetRef = useRef<MapPickerTarget | null>(null)
  useEffect(() => {
    if (target) lastTargetRef.current = target
  }, [target])
  const activeTarget = target ?? lastTargetRef.current

  // 换行/换组打开时重置弹窗内选中：本组件自身的 state 会跨次打开残留
  const targetKey = target ? `${target.group.groupKey}/${target.row.rowKey}` : ''
  useEffect(() => {
    if (!targetKey) return
    setPicked(null)
  }, [targetKey])

  // 回显选中按 echoNodeId 记忆化保证引用稳定（见文件头「不闪烁/不覆盖改选」说明）
  const echoNodeId = activeTarget?.row.mapNode?.nodeId
  const initialSelectedIds = useMemo(
    () => (echoNodeId ? [echoNodeId] : undefined),
    [echoNodeId],
  )
  // defaultFocus 是字符串，值相等即依赖相等，天然不会重复触发定位
  const defaultFocus = echoNodeId ? `node:${echoNodeId}` : undefined

  // 选中变化：单选模式取 [0]，仅接受节点（selectMode="node" 下路径不可选中）
  const handlePickedChange = useCallback((items: MapSelectedItem[]) => {
    const first = items[0]
    setPicked(first && first.type === 'node' ? first : null)
  }, [])

  /** 确定：MapNodeDto → MappingNodeDto 转换交给外层回填 */
  const handleOk = () => {
    if (!picked || picked.type !== 'node') return
    onOk({
      nodeId: picked.data.id,
      nodeName: picked.data.name,
      x: picked.data.x,
      y: picked.data.y,
    })
  }

  // 当前行节点信息：无论是否失效都显示，用户始终知道在改哪一行
  const rowNode = activeTarget?.row.mapNode
  const rowNodeLabel = rowNode?.nodeId
    ? `${rowNode.nodeName ?? ''}（${rowNode.nodeId}）`
    : '-'
  // 失效判定：idSet 已加载且不含该 nodeId 才标注；加载中/失败不标注，避免误标
  const rowNodeInvalid = !!(rowNode?.nodeId && nodeIdSet && !nodeIdSet.has(rowNode.nodeId))

  return (
    <Modal
      title={`${t('地图选点')}（${activeTarget?.group.mapName ?? ''}）`}
      open={!!target}
      onOk={handleOk}
      onCancel={onClose}
      width="80vw"
      // 当前无选中时禁用确定；有回显选中时加载完成即可点（等价于不改）
      okButtonProps={{ disabled: !picked }}
      okText={t('确定')}
      cancelText={t('取消')}
      // 与外层弹窗一致，避免误点遮罩丢失正在进行的点选
      maskClosable={false}
      // 每次打开重新拉图，视角/选中态不残留
      destroyOnHidden
    >
      <div className={styles.mapContainer}>
        {activeTarget?.group.mapId ? (
          <ReadOnlyMap
            mapId={activeTarget.group.mapId}
            selectMode="node"
            multiple={false}
            showNodeLabels
            showEdgeLabels={false}
            showArrows
            initialSelectedIds={initialSelectedIds}
            defaultFocus={defaultFocus}
            onChange={handlePickedChange}
          />
        ) : null}
      </div>
      {/* footer 信息行：当前行回显 + 实时选中，位于 body 底部、按钮行之上 */}
      <div className={styles.footerInfo}>
        <span>
          {t('当前行')}：{rowNodeLabel}
          {rowNodeInvalid ? <span className={styles.invalidTag}>{t('已不在地图上')}</span> : null}
        </span>
        <span>
          {t('已选')}：
          {picked && picked.type === 'node'
            ? `${picked.data.name}（${picked.data.id}）　X: ${picked.data.x.toFixed(2)}　Y: ${picked.data.y.toFixed(2)}`
            : '-'}
        </span>
      </div>
    </Modal>
  )
}
