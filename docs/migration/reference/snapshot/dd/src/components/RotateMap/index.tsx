/**
 * @description 旋转地图的通用组件
 * @date 2026-4-7
 *
 * 提供 Popover 面板，内含 Slider + InputNumber，
 * 以屏幕视口中心为锚点旋转 Konva Stage，通过 Tween 平滑过渡。
 * 旋转角度按 mapId 缓存到 localStorage，重新打开页面自动回显。
 */
import { useState, useEffect } from "react";
import { Popover, Slider, Button, InputNumber } from "antd";
import Konva from "konva";
import { Icon, useModel } from "@umijs/max";
import { screenToWorld, calcStagePosition, degToRad, radToDeg } from "@/utils/bindStage";
import { useI18n } from "@/hooks/useI18n";

const STORAGE_KEY = "ROTATE_MAP_CACHE";
const ROTATE_DEGREE_MIN = 0;
const ROTATE_DEGREE_MAX = 360;
const ROTATE_DEGREE_PRECISION = 2;
const ROTATE_DEGREE_FACTOR = 10 ** ROTATE_DEGREE_PRECISION;

/**
 * 旋转角度统一只保留两位小数，避免 InputNumber 与 Stage 反读时
 * 因浮点误差或整数化逻辑导致缓存值、界面值和画布值不一致。
 */
const roundRotateDegree = (degree: number) => Math.round(degree * ROTATE_DEGREE_FACTOR) / ROTATE_DEGREE_FACTOR;

/**
 * 输入框和滑块属于用户输入边界，只负责把值裁剪到合法角度范围内，
 * 再交给统一精度函数处理，避免各事件回调重复实现同一套规则。
 */
const normalizeInputDegree = (degree: number) => roundRotateDegree(Math.max(ROTATE_DEGREE_MIN, Math.min(ROTATE_DEGREE_MAX, degree)));

/**
 * Stage 内部保存的是弧度，弹层重新打开时需要转回角度并按 360 归一化，
 * 这里不能取整，否则已经保存的两位小数会在失焦/重开弹层后丢失。
 */
const normalizeStageDegree = (stage: Konva.Stage) => {
    let currentDeg = radToDeg(stage.rotation()) % ROTATE_DEGREE_MAX;
    if (currentDeg < ROTATE_DEGREE_MIN) currentDeg += ROTATE_DEGREE_MAX;
    return roundRotateDegree(currentDeg);
};

export const getRotateCache = (): Record<string, number> => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

/**
 * 缓存读取只暴露已经归一化后的角度值，组件重新挂载或弹层重新打开时
 * 不需要关心 localStorage 里是否存在浮点误差或超过输入范围的值。
 */
const getCachedRotateDegree = (mapId: string) => {
    const cached = getRotateCache()[mapId];
    return typeof cached === "number" ? normalizeInputDegree(cached) : null;
};

/**
 * 缓存写入是旋转角度的持久化边界，必须在这里统一处理两位小数规则，
 * 保证组件内部调用和外部工具栏调用保存出来的数据结构一致。
 */
export const saveRotateCache = (mapId: string, degree: number) => {
    const cache = getRotateCache();
    cache[mapId] = normalizeInputDegree(degree);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
};

export interface RotateMapProps {
    stage: Konva.Stage | null;
    mapId: string;
}

export default (props: RotateMapProps) => {

    const { stage, mapId } = props;

    const { t } = useI18n();
    const { currentMapInfo } = useModel("currentMapInfo");

    const [degree, setDegree] = useState<number>(0);

    const [open, setOpen] = useState(false);

    /**
     * 将指定角度应用到 Konva Stage，以屏幕视口中心为锚点，
     * 通过逆变换保证旋转前后画面中心内容不漂移
     */
    const applyRotation = (newDegree: number) => {
        if (!stage) return;

        const width = stage.width();
        const height = stage.height();
        const centerX = width / 2;
        const centerY = height / 2;

        const worldCenter = screenToWorld(centerX, centerY, stage);

        const newRad = degToRad(newDegree);
        const scaleX = stage.scaleX();
        const scaleY = stage.scaleY();

        const pos = calcStagePosition(worldCenter.x, worldCenter.y, scaleX, scaleY, newRad, centerX, centerY);

        const tween = new Konva.Tween({
            node: stage,
            duration: .25,
            rotation: newRad,
            x: pos.x,
            y: pos.y,
            easing: Konva.Easings.EaseInOut,
        });
        tween.play();
    };

    /**
     * 切换地图时恢复该地图缓存的旋转角度。
     *
     * 关键：依赖 mapLoadedAt（GraphStage 在 getMapInfo 成功、新地图数据就绪后刷新的时间戳），
     * 而非 mapId。若依赖 mapId，会在新数据到达前就基于"切换前的旧 stage 状态"启动 Tween
     * 恢复旋转，该 Tween 会与 GraphStage 的 fit（同步居中）竞态——fit 先写入正确的居中变换，
     * 随后 Tween 的后续帧把 x/y 覆盖回基于旧 stage 算出的位置，导致画面错位、看似没居中。
     * 改依赖 mapLoadedAt 后，恢复旋转推迟到与 fit 同一次渲染触发；组件树顺序保证
     * GraphStage 的 fit effect 先执行、本 effect 后执行，于是 fit 先居中、再在居中基础上恢复旋转。
     */
    useEffect(() => {
        if (!mapId || !stage) return;
        const cached = getCachedRotateDegree(mapId) ?? 0;
        setDegree(cached);
        applyRotation(cached);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentMapInfo.mapLoadedAt, stage]);

    /**
     * 所有交互入口统一走这里更新状态、画布和缓存，避免输入框、滑块、
     * 重置按钮各自处理精度后出现隐式分叉。
     */
    const updateDegree = (newDegree: number) => {
        const normalizedDegree = normalizeInputDegree(newDegree);
        setDegree(normalizedDegree);
        applyRotation(normalizedDegree);
        if (mapId) saveRotateCache(mapId, normalizedDegree);
    };

    const onSliderChange = (value: number) => {
        updateDegree(value);
    };

    const onInputChange = (value: number | null) => {
        const v = value ?? 0;
        updateDegree(v);
    };

    const handleReset = () => {
        updateDegree(0);
    };

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (newOpen && stage) {
            setDegree((mapId ? getCachedRotateDegree(mapId) : null) ?? normalizeStageDegree(stage));
        }
    };

    const content = (
        <div style={{ width: 260 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Slider
                    style={{ flex: 1 }}
                    min={ROTATE_DEGREE_MIN}
                    max={ROTATE_DEGREE_MAX}
                    step={1}
                    value={degree}
                    onChange={onSliderChange}
                    tooltip={{ formatter: (v) => `${v}°` }}
                />
                <InputNumber
                    style={{ width: 100 }}
                    min={ROTATE_DEGREE_MIN}
                    max={ROTATE_DEGREE_MAX}
                    step={0.01}
                    value={degree}
                    onChange={onInputChange}
                    size="small"
                    precision={ROTATE_DEGREE_PRECISION}
                    suffix="°"
                />
            </div>
            <div style={{ textAlign: "right", marginTop: 8 }}>
                <Button size="small" onClick={handleReset}>
                    {t("重置")}
                </Button>
            </div>
        </div>
    );

    return (
        <Popover
            content={content}
            title={t("旋转地图")}
            trigger="click"
            open={open}
            onOpenChange={handleOpenChange}
            placement="topLeft"
        >
            <Icon icon="local:rotate-map" width="20" height="20" style={{ cursor: "pointer" }} />
        </Popover>
    );
};
