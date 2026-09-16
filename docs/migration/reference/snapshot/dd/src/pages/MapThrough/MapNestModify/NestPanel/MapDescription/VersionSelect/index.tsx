/**
 * @description 地图版本选择器组件
 * @date 2026-6-1
 * @summary 加载版本列表，支持切换版本，自动选中已发布版本（无已发布版本时回退到第一条）
 * 从其他页面跳转时 URL 携带 mapId 和 mapVersionId，直接选中对应版本；
 * 从菜单打开时 URL 无参数，加载版本列表后自动选中已发布版本；
 * 地图切换时自动重置版本选择并重新加载列表；
 * 保存成功后由外部将 useMapVersionId 重置为 undefined，触发重新加载和自动选中
 * 通过比对 getMapInfo 返回的 currentMapInfoVersion.mapVersion 判定是否已发布，
 * 版本号匹配则在下拉选项中显示绿色标签标识
 */
import { useEffect, useState, useRef, memo } from "react";
import { Select, Tag, message, Modal } from "antd";
import { ExclamationCircleFilled } from "@ant-design/icons";
import type Konva from "konva";
import { pageMapInfoVersions } from "@/api";
import type { MapInfoVersion } from "@/types/MapVersion";
import { useI18n } from "@/hooks/useI18n";

const { confirm } = Modal;

interface VersionSelectProps {
    /** 当前选中的地图 ID */
    useMapId: string;
    /** 当前选中的地图版本 ID */
    useMapVersionId: number | undefined;
    /** 是否处于编辑模式 */
    enableModify: boolean;
    /**
     * 当前已发布版本的 mapVersion 字符串
     * 来源：getMapInfo 返回的 currentMapInfoVersion.mapVersion
     * 用于与版本列表中每个版本的 mapVersion 比对，判定是否已发布
     */
    currentPublishedMapVersion: string | undefined;
    /**
     * URL 携带的版本 ID，仅首次加载时优先使用
     * 地图切换后不再使用此值，改为自动选择已发布版本
     */
    urlMapVersionId: number | undefined;
    /** 设置当前版本 ID */
    setUseMapVersionId: (value: React.SetStateAction<number | undefined>) => void;
    /** 设置当前操作项（切换版本时重置） */
    setManualKey: (value: React.SetStateAction<string>) => void;
    /** 设置编辑模式（切换版本时退出编辑） */
    setEnableModify: (value: React.SetStateAction<boolean>) => void;
    /** 设置选中元素（切换版本时清空） */
    setSelectShapes: (value: React.SetStateAction<Konva.Shape[]>) => void;
}

export default memo((props: VersionSelectProps) => {

    const {
        useMapId,
        useMapVersionId,
        enableModify,
        currentPublishedMapVersion,
        urlMapVersionId,
        setUseMapVersionId,
        setManualKey,
        setEnableModify,
        setSelectShapes,
    } = props;

    /* 国际化翻译方法 */
    const { t } = useI18n();

    // 版本列表
    const [versionList, setVersionList] = useState<MapInfoVersion[]>([]);
    // 加载状态
    const [loading, setLoading] = useState<boolean>(false);
    // 记录上一次的地图 ID，用于检测地图切换
    const prevMapIdRef = useRef(useMapId);
    /**
     * 自动选中版本后设置此标记为 true，
     * 跳过因 setUseMapVersionId 导致的 effect 重复执行
     */
    const skipNextReloadRef = useRef(false);
    /**
     * 标记 URL 版本是否已经使用过
     * 仅在首次加载且非地图切换时使用 URL 版本
     * 地图切换后重置为 false，后续不再使用 URL 版本
     */
    const urlVersionUsedRef = useRef(false);

    /**
     * 加载版本列表
     * 触发条件：
     * 1. useMapId 变化（地图切换）
     * 2. useMapVersionId 变为 undefined（保存成功后的刷新）
     *
     * 自动选择策略：
     * - 首次加载（非地图切换）且有 URL 版本 → 使用 URL 版本
     * - 其他情况（地图切换、无 URL 版本、保存后刷新）→ 自动选择已发布版本
     */
    useEffect(() => {
        if (!useMapId) {
            setVersionList([]);
            return;
        }
        // 检测是否为地图切换
        const mapChanged = prevMapIdRef.current !== useMapId;
        prevMapIdRef.current = useMapId;

        // 地图切换时重置 URL 版本使用标记，后续自动选择已发布版本
        if (mapChanged) {
            urlVersionUsedRef.current = false;
        }

        // 如果是自动选中版本触发的重跑，跳过（避免多余 API 调用）
        if (skipNextReloadRef.current) {
            skipNextReloadRef.current = false;
            return;
        }

        setLoading(true);
        pageMapInfoVersions({ mapId: useMapId, pageNo: 1, pageSize: 200 }).then(res => {
            if (res?.code === 200 && res?.message === "success") {
                const data: MapInfoVersion[] = res?.data?.records || [];
                setVersionList(data);
                /**
                 * 需要自动选择版本的条件：
                 * 1. 地图切换（mapChanged） → 始终自动选择已发布版本
                 * 2. 当前无选中版本（useMapVersionId === undefined） → 根据是否有 URL 版本决定
                 */
                if (data.length > 0 && (mapChanged || useMapVersionId === undefined)) {
                    let targetId: number;
                    if (!mapChanged && !urlVersionUsedRef.current && urlMapVersionId) {
                        /**
                         * 首次加载（非地图切换）且 URL 携带了版本 ID
                         * → 使用 URL 指定的版本
                         */
                        targetId = urlMapVersionId;
                        urlVersionUsedRef.current = true;
                    } else {
                        /**
                         * 地图切换、保存后刷新、或无 URL 版本
                         * → 自动选择已发布版本，无已发布版本则选中第一条（最新版本）
                         * 使用 currentMapInfoVersion（truthy）判断是否已发布，
                         * 同时兼容 published 字段
                         */
                        const publishedVersion = data.find(v => v.published === true || !!v.currentMapInfoVersion);
                        targetId = publishedVersion?.id ?? data[0].id;
                    }
                    skipNextReloadRef.current = true;
                    setUseMapVersionId(targetId);
                }
            } else {
                message.warning(t("获取版本列表出错") + res?.message);
            }
            setLoading(false);
        }).catch(err => {
            if (err) {
                message.error(t("获取版本列表出错") + err?.message);
            }
            setLoading(false);
        });
    }, [useMapId, useMapVersionId]);

    /**
     * 版本切换事件处理
     * 编辑模式下切换版本需弹出确认框
     */
    const handleVersionChange = (value: number) => {
        if (enableModify) {
            confirm({
                title: t("确定切换版本吗?"),
                icon: <ExclamationCircleFilled />,
                content: t("系统可能不会保存您所做的更改"),
                onOk() {
                    setUseMapVersionId(value);
                    setManualKey("");
                    setEnableModify(false);
                    setSelectShapes([]);
                },
                onCancel() {
                    // 取消切换
                },
            });
        } else {
            setUseMapVersionId(value);
        }
    };

    /**
     * 获取当前选中版本是否为已发布版本
     * 通过比对 getMapInfo 返回的 currentMapInfoVersion.mapVersion 与版本列表中的 mapVersion 判定
     */
    const isSelectedPublished = versionList.find(v => v.id === useMapVersionId)?.mapVersion === currentPublishedMapVersion;

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Select
                showSearch
                optionFilterProp="label"
                filterOption={(input, option) => {
                    /**
                     * 搜索过滤：根据版本号（mapVersion）模糊匹配用户输入
                     * 从 versionList 中找到对应版本的 mapVersion 进行比对
                     */
                    const version = versionList.find(v => v.id === option?.value);
                    return !!version?.mapVersion?.toLowerCase().includes(input.toLowerCase());
                }}
                value={useMapVersionId}
                size="small"
                style={{ width: 230 }}
                placeholder={t("选择版本")}
                loading={loading}
                disabled={!useMapId}
                popupMatchSelectWidth={false}
                options={versionList.map(v => ({
                    label: (
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <span>{v.mapVersion}</span>
                            {v.mapVersion === currentPublishedMapVersion ? (
                                <Tag
                                    color="green"
                                    style={{
                                        lineHeight: "16px",
                                        fontSize: 10,
                                        padding: "0 4px",
                                        borderRadius: 3,
                                        flexShrink: 0,
                                    }}
                                >
                                    {t("已发布")}
                                </Tag>
                            ) : <Tag
                                color="red"
                                style={{
                                    lineHeight: "16px",
                                    fontSize: 10,
                                    padding: "0 4px",
                                    borderRadius: 3,
                                    flexShrink: 0,
                                }}
                            >
                                {t("未发布")}
                            </Tag>}
                        </span>
                    ),
                    value: v.id,
                }))}
                onChange={handleVersionChange}
                onKeyDown={(e) => {
                    e.stopPropagation();
                }}
            />
        </div>
    );
});
