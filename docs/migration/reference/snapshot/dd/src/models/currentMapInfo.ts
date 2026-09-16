/**
 * @description 当前应用的地图
 * @returns get set
 * @date 2025-5-28
 */
import { useState } from "react";
import type { CurrentMapInfo } from "@/utils/typing";

const useCurrentMap = () => {
    const [currentMapInfo, setCurrentMapInfo] = useState<CurrentMapInfo>({ mapId: "", mapLoadedAt: 0 });
    return {
        currentMapInfo,
        setCurrentMapInfo
    };
};

export default useCurrentMap;