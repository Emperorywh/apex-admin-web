/**
 * @description 选择地图
 * @date 2025-6-19
 */
import React, { useEffect, useState } from "react";
import { Select, message } from "antd";
import { useModel } from "@umijs/max";
import { useLocalStorageState } from "ahooks";
import { getSimpleMaps } from "@/api";
import type { SimpleMapList } from "@/types/OverLook";
import { useI18n } from "@/hooks/useI18n";

interface ChangeMapProps {
    setFocusId: (value: React.SetStateAction<string | undefined>) => void;
}

export default (props: ChangeMapProps) => {

    const { setFocusId } = props;

    /* 国际化翻译方法，用于将地图选择器的占位文案和错误提示进行多语言转换 */
    const { t } = useI18n();

    // 当前使用的地图
    const { currentMapInfo, setCurrentMapInfo } = useModel("currentMapInfo");
    const { setTooltip } = useModel("tooltipJson");
    // 地图列表
    const [simpleMapList, setSimpleMapList] = useState<SimpleMapList[]>([]);
    // 存储在localStorage中的当前的地图
    const [localMap, setLocalMap] = useLocalStorageState<string>("currentUseMapId", {
        defaultValue: "",
        listenStorageChange: true
    });

    const handleMapChange = (value: string) => {
        setFocusId("");
        setLocalMap(value);
        setCurrentMapInfo(prev => ({
            ...prev,
            mapId: value
        }));
        setTooltip({ visible: false });
    };

    useEffect(() => {
        getSimpleMaps().then(res => {
            if (res?.code === 200 && res?.message === "success") {
                const data: SimpleMapList[] = res?.data || [];
                setSimpleMapList(data);
                const hasMap = data?.find(map => map?.mapId === localMap);
                if (hasMap) {
                    setCurrentMapInfo(prev => ({ ...prev, mapId: localMap }));
                } else {
                    const [defaultMap] = res?.data || [];
                    setCurrentMapInfo(prev => ({ ...prev, mapId: defaultMap?.mapId }));
                    setLocalMap(defaultMap?.mapId || "");
                }
            } else {
                message.warning(t("获取地图列表出错") + res?.message)
            }
        }).catch(err => {
            if (err) {
                message.error(t("获取地图列表出错") + err?.message)
            }
        });
    }, [])

    return (
        <Select
            style={{
                width: 220,
                position: "absolute",
                left: "1rem",
                top: "1rem"
            }}
            value={currentMapInfo?.mapId}
            placeholder={t("选择地图")}
            showSearch
            onChange={handleMapChange}
            options={simpleMapList}
            fieldNames={{ label: "mapName", value: "mapId" }}
            size="large"
        />
    )
};
