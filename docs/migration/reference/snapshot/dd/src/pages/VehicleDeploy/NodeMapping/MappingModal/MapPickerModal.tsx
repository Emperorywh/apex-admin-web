/**
 * @description 地图选点二级弹窗
 * 在地图上点选节点回填映射行，与行内下拉框选节点的语义完全一致
 * （设计决策见 docs/SPEC_node_mapping_map_picker.md §3）
 * @date 2026-08-18
 */
import type { KonvaMapRef, MapNode, SelectedItem } from "@/components/KonvaMap";
import KonvaMap from "@/components/KonvaMap";
import { useI18n } from "@/hooks/useI18n";
import type { MappingNode } from "@/types/VehicleDeploy/NodeMappingType";
import { Button, Modal } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapGroupDraft, MappingRowDraft } from "./index";
import styles from "./MapPickerModal.less";

/**
 * 选点目标：MappingModal 按 pickerTarget 解析出的组与行
 * 弹窗打开期间外层 Modal 被遮罩阻隔，组/行数据不会变化
 */
export interface MapPickerTarget {
  group: MapGroupDraft;
  row: MappingRowDraft;
}

interface MapPickerModalProps {
  /** 选点目标；null 表示弹窗关闭 */
  target: MapPickerTarget | null;
  /** 目标地图已加载的节点 ID 集合（失效节点标注用；undefined = 尚未加载，不标注） */
  nodeIdSet?: Set<string>;
  /** 确定回填（外层复用行内下拉选节点的 onRowNodeChange 语义） */
  onOk: (node: MappingNode) => void;
  /** 关闭弹窗（取消时；确定由外层回填后自行关闭） */
  onClose: () => void;
}

export default (props: MapPickerModalProps) => {
  const { target, nodeIdSet, onOk, onClose } = props;
  /* 国际化翻译方法 */ const { t } = useI18n();

  const mapRef = useRef<KonvaMapRef>(null);
  /**
   * 弹窗内实时选中的节点（KonvaMap onChange 驱动）
   * null = 无选中 → 确定按钮禁用（含点空白清除选中、失效节点无高亮等场景）
   */
  const [picked, setPicked] = useState<MapNode | null>(null);
  /**
   * 地图加载失败标记：useMapData 内建 message 提示后，这里渲染错误占位与重试按钮
   */
  const [loadFailed, setLoadFailed] = useState(false);

  /**
   * 缓存最后一次非空目标：关闭动画期间 target 已置空，
   * Modal 内容（destroyOnHidden 销毁前）仍需最后一帧数据渲染
   */
  const lastTargetRef = useRef<MapPickerTarget | null>(null);
  useEffect(() => {
    if (target) lastTargetRef.current = target;
  }, [target]);
  const activeTarget = target ?? lastTargetRef.current;

  /**
   * 换行/换组打开时重置弹窗内选中与错误态：
   * destroyOnHidden 只销毁 Modal 内容（KonvaMap），本组件自身的 state 会跨次打开残留
   */
  const targetKey = target
    ? `${target.group.groupKey}/${target.row.rowKey}`
    : "";
  useEffect(() => {
    if (!targetKey) return;
    setPicked(null);
    setLoadFailed(false);
  }, [targetKey]);

  /**
   * 回显选中必须按 echoNodeId 记忆化保证引用稳定：
   * KonvaMap 应用 initialSelectedIds 的 effect 以其为依赖，
   * 若每次渲染传入新数组，用户改选后会被误判为「回显变化」而重置回初始节点
   */
  const echoNodeId = activeTarget?.row.mapNode?.nodeId;
  const initialSelectedIds = useMemo(
    () => (echoNodeId ? [echoNodeId] : undefined),
    [echoNodeId],
  );
  /* defaultFocus 是字符串，值相等即依赖相等，天然不会重复触发定位（首次定位不闪烁） */
  const defaultFocus = echoNodeId ? `node:${echoNodeId}` : undefined;

  /**
   * 选中变化：单选模式取 [0]，仅接受节点（selectMode="node" 下路径只可定位不可选中）
   */
  const handlePickedChange = useCallback((items: SelectedItem[]) => {
    const first = items[0];
    setPicked(first?.type === "node" ? first.data : null);
  }, []);

  /**
   * 加载失败上报：useMapData 已内建 message 提示，这里只切到错误占位
   */
  const handleLoadError = useCallback(() => setLoadFailed(true), []);

  /**
   * 重试：先收起占位露出加载态；再次失败会重新触发 onLoadError 回到占位
   */
  const handleRetry = () => {
    setLoadFailed(false);
    mapRef.current?.reload();
  };

  /**
   * 确定：MapNode 整体转换为 MappingNode（nodeId/nodeName/x/y）交给外层回填，
   * 映射点 X/Y 是否跟随回填由外层 onRowNodeChange 按「未手填才回填」处理（D3）
   */
  const handleOk = () => {
    if (!picked) return;
    onOk({
      nodeId: picked.id,
      nodeName: picked.name,
      x: picked.x,
      y: picked.y,
    });
  };

  /* 当前行节点信息：无论是否失效都显示，用户始终知道在改哪一行（D10） */
  const rowNode = activeTarget?.row.mapNode;
  const rowNodeLabel = rowNode?.nodeId
    ? `${rowNode.nodeName}（${rowNode.nodeId}）`
    : "-";
  /* 失效判定：idSet 已加载且不含该 nodeId 才标注；idSet 未加载（加载中/失败）不标注，避免误标 */
  const rowNodeInvalid = !!(
    rowNode?.nodeId &&
    nodeIdSet &&
    !nodeIdSet.has(rowNode.nodeId)
  );

  return (
    <Modal
      title={`${t("地图选点")}（${activeTarget?.group.mapName ?? ""}）`}
      open={!!target}
      onOk={handleOk}
      onCancel={onClose}
      okText={t("确定")}
      cancelText={t("取消")}
      width="80vw"
      /* 当前无选中时禁用确定（D6）；有回显选中时加载完成即可点（等价于不改） */
      okButtonProps={{ disabled: !picked }}
      /* 与外层 MappingModal 一致，避免误点遮罩丢失正在进行的点选 */
      maskClosable={false}
      /* 每次打开重新拉图（D4），视角/选中态不残留 */
      destroyOnHidden
    >
      <div className={styles.map_container}>
        {activeTarget && (
          <KonvaMap
            ref={mapRef}
            mapId={activeTarget.group.mapId!}
            selectMode="node"
            multiple={false}
            showNodeLabels
            showEdgeLabels={false}
            showArrows
            initialSelectedIds={initialSelectedIds}
            defaultFocus={defaultFocus}
            onChange={handlePickedChange}
            onLoadError={handleLoadError}
          />
        )}
        {/* 加载失败占位：覆盖而非卸载 KonvaMap，重试需要调 mapRef.reload */}
        {loadFailed && (
          <div className={styles.error_overlay}>
            <span>{t("地图数据加载失败")}</span>
            <Button onClick={handleRetry}>{t("重试")}</Button>
          </div>
        )}
      </div>
      {/* footer 信息行：当前行回显 + 实时选中，位于 body 底部、按钮行之上 */}
      <div className={styles.footer_info}>
        <span>
          {t("当前行")}：{rowNodeLabel}
          {rowNodeInvalid && (
            <span className={styles.invalid_tag}>{t("已不在地图上")}</span>
          )}
        </span>
        <span>
          {t("已选")}：{picked ? `${picked.name}（${picked.id}）` : "-"}
          {picked && `　X: ${picked.x.toFixed(2)}　Y: ${picked.y.toFixed(2)}`}
        </span>
      </div>
    </Modal>
  );
};
