/**
 * @description 地图数据请求 hook
 * 封装 getMapInfo + 加载/错误状态管理
 */
import { getMapInfo } from "@/api";
import { useI18n } from "@/hooks/useI18n";
import { message } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MapEdge, MapNode } from "../KonvaMap.types";

export interface MapDataState {
  nodes: MapNode[];
  edges: MapEdge[];
  loading: boolean;
  /** 最近一次加载是否失败（供上层渲染错误态/重试） */
  error: boolean;
  /** 重新加载当前地图 */
  reload: () => void;
}

/**
 * 地图数据请求 hook
 * @param mapId 地图 ID，为空时不发起请求
 */
export const useMapData = (mapId: string | undefined): MapDataState => {
  const { t } = useI18n();
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [edges, setEdges] = useState<MapEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // 记录上一次请求的 mapId，防止重复请求
  const lastMapIdRef = useRef<string>("");

  const fetchMapData = useCallback(
    async (id: string) => {
      if (!id) return;

      setLoading(true);
      setError(false);
      try {
        const res = await getMapInfo({ mapId: id });
        if (res?.code === 200 && res?.message === "success" && res.data) {
          const { currentMapInfoVersion } = res.data;
          if (currentMapInfoVersion) {
            const { nodes: n = [], edges: e = [] } =
              currentMapInfoVersion?.mapJson || {};
            setNodes(n);
            setEdges(e);
          } else {
            message.warning(t("地图数据为空"));
            setNodes([]);
            setEdges([]);
            setError(true);
          }
        } else {
          message.warning(
            `${t("地图数据加载失败")}: ${res?.message ?? t("未知错误")}`,
          );
          setNodes([]);
          setEdges([]);
          setError(true);
        }
      } catch (err: any) {
        message.error(
          `${t("地图数据加载失败")}: ${err?.message ?? t("网络错误")}`,
        );
        setNodes([]);
        setEdges([]);
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!mapId) {
      setNodes([]);
      setEdges([]);
      setLoading(false);
      setError(false);
      lastMapIdRef.current = "";
      return;
    }
    // mapId 变化时重新请求
    if (mapId !== lastMapIdRef.current) {
      lastMapIdRef.current = mapId;
      fetchMapData(mapId);
    }
  }, [mapId, fetchMapData]);

  /** 重新加载当前地图（mapId 未变时 useEffect 不会重发，故提供命令式入口） */
  const reload = useCallback(() => {
    if (lastMapIdRef.current) {
      fetchMapData(lastMapIdRef.current);
    }
  }, [fetchMapData]);

  return { nodes, edges, loading, error, reload };
};
