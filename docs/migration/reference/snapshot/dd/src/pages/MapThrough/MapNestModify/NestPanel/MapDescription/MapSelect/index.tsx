/**
 * @description 地图选择
 * @date 2025-7-8
 */
import { useEffect, useState, memo } from "react";
import { Select, message, Modal } from "antd";
import { ExclamationCircleFilled } from "@ant-design/icons";
import { getSimpleMaps } from "@/api";
import { useLocalStorageState } from "ahooks";
import type { SimpleMapList } from "@/types/OverLook";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

const { confirm } = Modal;

interface MapSelectProps {
    useMapId: string;
    enableModify: boolean;
    setUseMapId: (value: React.SetStateAction<string>) => void;
    /** 切换地图时重置版本选择 */
    setUseMapVersionId: (value: React.SetStateAction<number | undefined>) => void;
    setManualKey: (value: React.SetStateAction<string>) => void;
    setEnableModify: (value: React.SetStateAction<boolean>) => void;
    setSelectShapes: (value: React.SetStateAction<Konva.Shape[]>) => void;
}

export default memo((props: MapSelectProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { useMapId, enableModify, setUseMapId, setUseMapVersionId, setManualKey, setEnableModify, setSelectShapes } = props;

    // 当前地图的列表
    const [simpleMapList, setSimpleMapList] = useState<SimpleMapList[]>([]);
    // 存储在本地的地图id
    const [localUseMapId, setLocalUseMapId] = useLocalStorageState<string>("mapModifyId", {
        defaultValue: ""
    });

    // 地图改变事件
    const handleMapChange = (value: string) => {
        if (enableModify) {
            confirm({
                title: t("确定切换当前地图吗?"),
                icon: <ExclamationCircleFilled />,
                content: t("系统可能不会保存您所做的更改"),
                onOk() {
                    setUseMapId(value);
                    // 切换地图时重置版本选择，VersionSelect 会自动选中新地图的最新版本
                    setUseMapVersionId(undefined);
                    setManualKey("");
                    setEnableModify(false);
                    setSelectShapes([]);
                    setLocalUseMapId(value);
                },
                onCancel() {
                    // .
                },
            });
        } else {
            setUseMapId(value);
            // 切换地图时重置版本选择，VersionSelect 会自动选中新地图的最新版本
            setUseMapVersionId(undefined);
            setManualKey("");
            setEnableModify(false);
            setSelectShapes([]);
            setLocalUseMapId(value);
        }
    };

    useEffect(() => {
        getSimpleMaps().then(res => {
            if (res?.code === 200 && res?.message === "success") {
                const data: SimpleMapList[] = res?.data || [];
                setSimpleMapList(data);
                // URL 参数优先：如果当前已有选中的地图（来自 URL），验证其有效性后保持不变
                if (useMapId) {
                    const hasUrlMap = data.find(map => map.mapId === useMapId);
                    if (hasUrlMap) return; // URL 设置的地图 ID 有效，不覆盖
                }
                // URL 无效或未设置时，从 localStorage 恢复
                const hasMap = data.find(map => map.mapId === localUseMapId);
                if (hasMap) {
                    setUseMapId(localUseMapId);
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
            value={useMapId}
            size="small"
            showSearch={true}
            style={{ width: 230 }}
            placeholder={t("选择当前地图")}
            options={simpleMapList}
            defaultValue={useMapId}
            fieldNames={{ label: "mapName", value: "mapId" }}
            onChange={handleMapChange}
            onKeyDown={(e) => {
                e.stopPropagation();
            }}
        />
    )
});
