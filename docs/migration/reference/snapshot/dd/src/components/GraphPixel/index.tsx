/**
 * @description 显示地图元素的列表 在首页和地图编辑中一起使用
 * @date 2025-9-3
 */
import { useState, useEffect, useRef, memo } from "react";
import { Icon } from "@umijs/max";
import { List, Input } from "antd";
import type { InputProps } from "antd";
import VirtualList from "rc-virtual-list";
import type { Pixel } from "@/types/OverLook";
import Konva from "konva";
import { NodeType } from "@/utils/enum";
import { useLocalStorageState } from "ahooks";
import { unSelectedShape, updateShapeStyle } from "@/utils/graph";
import { useI18n } from "@/hooks/useI18n";
import { calcStagePosition } from "@/utils/bindStage";

interface GraphPixelProps {
    stage: Konva.Stage | null;
    useMapId?: string;
    /**
     * 刷新键：当 stage 数据就绪时由父组件传入一个新值
     * 两个页面均传入 mapLoadedAt（地图数据加载完成的时间戳）
     * Overlook 通过 currentMapInfo.mapLoadedAt（全局 model）
     * MapNestModify 通过 mapLoadedAt（组件本地 state）
     */
    refreshKey?: any;
    panelHeight: React.MutableRefObject<number>;
    setSelectShapes?: (value: React.SetStateAction<Konva.Shape[]>) => void;
}

export default memo((props: GraphPixelProps) => {

    const { stage, useMapId, refreshKey, panelHeight, setSelectShapes } = props;

    const { t } = useI18n();

    const [pixels, setPixels] = useState<Pixel[]>([]);

    // 保存当前定位动画的 tween 引用，用于连续点击时中断上一个动画
    const positionTweenRef = useRef<Konva.Tween | null>(null);

    // 闪烁定时器引用，用于清除闪烁
    const blinkTimerRef = useRef<NodeJS.Timeout | null>(null);

    // 当前正在闪烁的元素引用，用于恢复 opacity
    const blinkTargetRef = useRef<Konva.Node | null>(null);

    // 存储在首页localStorage中的当前的地图
    const [localMap] = useLocalStorageState<string>("currentUseMapId", {
        defaultValue: "",
        listenStorageChange: true
    });

    // 查询显示列表 可根据搜索名称查询
    const getPixelList = (sName: string = "") => {
        const pixels: Pixel[] = [];
        const layers = stage?.getLayers();
        layers?.forEach(layer => {
            // 这里是显示所有的Shape类型，到后面可能会变
            const children = layer.getChildren(shape => shape.attrs?.enableSelect === "node" || shape.attrs?.enableSelect === "edge");
            if (Array.isArray(children) && children?.length) {
                children.forEach(shape => {
                    const { attrs: { id, x, y, data: { name, type } } } = shape;
                    if (sName) {
                        // 有sName的话说明要按名字查询
                        (name as string).includes(sName) && pixels.push({
                            id,
                            name,
                            type: NodeType[type as "node"] || "路径",
                            visible: shape.isVisible(),
                            x,
                            y: -y
                        })
                    } else {
                        // 没有name的话说明查所有
                        pixels.push({
                            id,
                            name,
                            type: NodeType[type as "node"] || "路径",
                            visible: shape.isVisible(),
                            x,
                            y: -y
                        })
                    }
                })
            }
        })
        setPixels(pixels);
    };

    // 显示隐藏的按钮
    const handleVisibleClick = (item: Pixel) => {
        if (!stage) return;
        const { id } = item;
        const target = stage.findOne(`#${id}`);
        if (!target) return;
        const visible = target.isVisible();
        if (visible) {
            target.hide();
        } else {
            target.show();
        }
        // 更新当前的列表 有可能是搜索出来的列表
        const updateList = pixels.map(pixel => ({
            ...pixel,
            visible: item.id === pixel.id ? !pixel.visible : pixel.visible
        }))
        setPixels(updateList);
    };

    // 根据选中的元素更新样式
    const changeSelectedShape = (target: Konva.Node) => {
        const { attrs } = target;
        if (attrs?.enableSelect === "node" || attrs?.enableSelect === "edge") {
            // 是节点或者路径，设置选中状态
            if (attrs?.state === "selected") return;
            setSelectShapes?.([target as Konva.Shape]);
            updateShapeStyle(target);
        }
    };

    /** 清除正在进行的闪烁，恢复元素 opacity */
    const clearBlink = () => {
        if (blinkTimerRef.current) {
            clearInterval(blinkTimerRef.current);
            blinkTimerRef.current = null;
        }
        // 恢复上一个闪烁元素的 opacity
        if (blinkTargetRef.current) {
            try { blinkTargetRef.current.setAttrs({ opacity: 1 }); } catch {}
            blinkTargetRef.current = null;
        }
    };

    /** 对目标元素执行 3 秒透明度闪烁 */
    const startBlink = (target: Konva.Node) => {
        // 隐藏元素不闪烁
        if (!target.isVisible()) return;

        // 清除可能残留的闪烁
        clearBlink();
        blinkTargetRef.current = target;

        let opacity = 1;
        const BLINK_INTERVAL = 300;    // 300ms 切换一次
        const BLINK_DURATION = 3000;   // 持续 3 秒
        const MIN_OPACITY = 0.2;       // 最暗状态

        const startTime = Date.now();

        blinkTimerRef.current = setInterval(() => {
            // 检查是否到达 3 秒
            if (Date.now() - startTime >= BLINK_DURATION) {
                clearBlink(); // 内部会恢复 opacity: 1
                return;
            }
            // 切换 opacity
            opacity = opacity === 1 ? MIN_OPACITY : 1;
            try { target.setAttrs({ opacity }); } catch {}
        }, BLINK_INTERVAL);
    };

    /**
     * 定位到元素的位置
     * 固定放大到 scale=300 并居中，同时缩放和平移同步动画
     * 动画结束后启动 3 秒闪烁高亮
     * 连续点击时先中断上一个动画和闪烁再开始新动画
     */
    const handlePositionClick = (item: Pixel) => {
        if (!stage) return;

        // 1. 中断可能正在进行的定位动画
        positionTweenRef.current?.destroy();
        positionTweenRef.current = null;

        // 2. 清除可能正在进行的闪烁
        clearBlink();

        // 3. 还原选中样式
        unSelectedShape(stage);

        // 4. 找到目标元素并设为选中
        const { id } = item;
        const target = stage.findOne(`#${id}`);
        if (!target) return;
        changeSelectedShape(target);

        // 5. 计算焦点坐标（节点用 x,y，路径用 labelX,labelY）
        const { x, y, data: { labelX = 0, labelY = 0 } } = target.getAttrs();
        const focusX = x || labelX;
        const focusY = y || labelY;

        // 6. 固定目标缩放级别
        const targetScale = 125;

        // 7. 计算目标 stage 位置（居中，考虑当前旋转）
        // stage 变换为 translate * rotate * scale，居中 position 必须把旋转矩阵算进去，
        // 否则旋转后世界坐标点会偏离视口中心（复用 RotateMap 同款工具函数）
        const focusPos = calcStagePosition(
            focusX,
            focusY,
            targetScale,
            targetScale,
            stage.rotation(),
            stage.width() / 2,
            stage.height() / 2,
        );

        // 8. 同时执行缩放 + 平移动画，动画结束后开始闪烁
        positionTweenRef.current = new Konva.Tween({
            node: stage,
            duration: 1,
            x: focusPos.x,
            y: focusPos.y,
            scaleX: targetScale,
            scaleY: targetScale,
            onFinish: () => {
                startBlink(target);
            },
        });
        positionTweenRef.current.play();
    };

    // 搜索事件
    const onSearchChange: InputProps["onChange"] = (event) => {
        const value = event.target.value;
        getPixelList(value);
    };

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (stage) {
            // 这里执行的很快，数据没更新，加个延时
            timer = setTimeout(() => {
                getPixelList();
            }, 300)
        }
        return () => {
            clearTimeout(timer);
        }
    }, [stage, useMapId, localMap, refreshKey])

    // 组件卸载时清理闪烁定时器
    useEffect(() => {
        return () => clearBlink();
    }, []);

    return (
        <List
            size="small"
            header={<Input placeholder={t("过滤元素")} onChange={onSearchChange} />}
        >
            <VirtualList
                data={pixels}
                height={panelHeight.current}
                itemHeight={65}
                itemKey="id"
            >
                {(item: Pixel) => (
                    <List.Item
                        key={item.id}
                        actions={[
                            <Icon
                                icon={item.visible ? "local:eye" : "local:eye-close"}
                                width="20"
                                height="20"
                                onClick={() => handleVisibleClick(item)}
                                style={{ cursor: "pointer" }}
                            />,
                            <Icon
                                icon="local:position"
                                width="20"
                                height="20"
                                onClick={() => handlePositionClick(item)}
                                style={{ cursor: "pointer" }}
                            />
                        ]}
                    >
                        <List.Item.Meta
                            title={item.name}
                            description={t(item.type)}
                        />
                        {
                            typeof item.x === "number" &&
                            typeof item.y === "number" &&
                            <div style={{ textDecoration: "underline" }}>{item.x.toFixed(5)},{item.y.toFixed(5)}</div>
                        }
                    </List.Item>
                )}
            </VirtualList>
        </List>
    )
});
