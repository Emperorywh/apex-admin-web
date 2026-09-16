/**
 * @description 右侧操作栏
 * @date 2025-7-8
 */
import { useState, memo } from "react";
import { Menu, message, Modal } from "antd";
import type { MenuProps } from "antd";
import { GatewayOutlined, ColumnWidthOutlined, CopyOutlined, PlusCircleOutlined, AlignRightOutlined, AlignLeftOutlined, LineOutlined, Loading3QuartersOutlined, VerticalAlignTopOutlined, VerticalAlignBottomOutlined, AlignCenterOutlined, ColumnHeightOutlined, ShareAltOutlined } from "@ant-design/icons";
import type Konva from "konva";
import TranslateModal from "./TranslateModal";
import CopyModal from "./CopyModal";
import { setNodeDraggable } from "@/utils/graph";
import { alignSelectLeft, alignSelectRight, alignSelectTop, alignSelectBottom, alignVerticalCenter, alignHorizontalCenter, horizontalUniformSpacingDistribution, verticalEquidistantDistribution, straightenSelectedCurves } from "@/utils/align";
import { snapNearRightAngles } from "@/utils/angle";
import AlignModal from "./AlignModal";
import { saveSnapshot } from "@/utils/undoHistory";
import { useI18n } from "@/hooks/useI18n";
import EdgeDrawingMenuLabel from "./EdgeDrawingMenuLabel";
import BrushSelectMenuLabel from "./BrushSelectMenuLabel";

type MenuItem = Required<MenuProps>["items"][number];

/**
 * 生成菜单项（国际化）
 * 将 items 从静态数组改为函数，接收 t 翻译方法动态生成 label
 */
const buildItems = (t: (id: string) => string): MenuItem[] => [
    {
        key: "mapRelated",
        label: t("地图相关"),
        type: "group"
    },
    {
        label: t("框选"),
        key: "select",
        icon: <GatewayOutlined />,
        /**
         * 三种框选模式共用独立的提示组件，菜单层只声明命中范围。
         * 框选交互（mousedown→mouseup 瞬时选区）由 BrushSelect 组件统一管理，
         * 避免提示功能反向侵入 Konva 框选逻辑（同路径绘制的处理思路）。
         * 「同向路径」入口已迁移到画布右键菜单（显式基准，SPEC brush_same_direction_contextmenu v2 §4.12）。
         */
        children: [
            {
                key: "brushSelect",
                label: <BrushSelectMenuLabel labelKey="默认" mode="default" />,
            },
            {
                key: "brushSelectNode",
                label: <BrushSelectMenuLabel labelKey="节点" mode="node" />
            },
            {
                key: "brushSelectEdge",
                label: <BrushSelectMenuLabel labelKey="路径" mode="edge" />
            }
        ]
    },
    {
        key: "translate",
        label: t("平移"),
        icon: <ColumnWidthOutlined />
    },
    {
        key: "copy",
        label: t("复制"),
        icon: <CopyOutlined />
    },
    {
        key: "ranging",
        label: t("测距"),
        icon: <ShareAltOutlined />
    },
    {
        label: t("节点相关"),
        key: "nodes",
        type: "group"
    },
    {
        key: "addNode",
        label: t("添加节点"),
        icon: <PlusCircleOutlined />,
        children: [
            {
                key: "node",
                label: t("节点")
            },
            {
                key: "work",
                label: t("工作站点")
            },
            {
                key: "park",
                label: t("停靠站点")
            },
            {
                key: "charge",
                label: t("充电站点")
            },
            {
                key: "warehouse",
                label: t("库区站点")
            }
        ]
    },
    {
        key: "align",
        label: t("对齐"),
        icon: <AlignLeftOutlined />,
        children: [
            {
                key: "alignLeft",
                label: t("左对齐"),
                icon: <AlignLeftOutlined />
            },
            {
                key: "alignRight",
                label: t("右对齐"),
                icon: <AlignRightOutlined />
            },
            {
                key: "alignTop",
                label: t("顶部对齐"),
                icon: <VerticalAlignTopOutlined />
            },
            {
                key: "alignBottom",
                label: t("底部对齐"),
                icon: <VerticalAlignBottomOutlined />
            },
            {
                key: "alignVerticalCenter",
                label: t("垂直居中对齐"),
                icon: <AlignCenterOutlined />
            },
            {
                key: "alignHorizontalCenter",
                label: t("水平居中对齐"),
                icon: <AlignCenterOutlined rotate={90} />
            },
            {
                key: "horizontalUniformSpacingDistribution",
                label: t("水平等间距分布"),
                icon: <ColumnWidthOutlined />
            },
            {
                key: "verticalEquidistantDistribution",
                label: t("垂直等间距分布"),
                icon: <ColumnHeightOutlined />
            },
            {
                key: "alignTwoPointsLine",
                label: t("两点连线对齐"),
                icon: <LineOutlined />
            }
        ]
    },
    {
        key: "lines",
        label: t("路径相关"),
        type: "group"
    },
    /**
     * 四种路径绘制入口共用独立的提示组件，菜单层只声明路径类型。
     * 鼠标状态流仍由 AddEdge 统一管理，避免提示功能反向侵入 Konva 绘制逻辑。
     */
    {
        key: "addLines",
        label: t("添加直线"),
        icon: <LineOutlined />,
        children: [
            {
                key: "forwardLine",
                label: <EdgeDrawingMenuLabel labelKey="正走直线" />
            },
            {
                key: "reverseLine",
                label: <EdgeDrawingMenuLabel labelKey="倒走直线" />
            }
        ]
    },
    {
        key: "addCubic",
        label: t("添加曲线"),
        icon: <Loading3QuartersOutlined />,
        children: [
            {
                key: "forwardBezier",
                label: <EdgeDrawingMenuLabel labelKey="正走曲线" isBezier />
            },
            {
                key: "reverseBezier",
                label: <EdgeDrawingMenuLabel labelKey="倒走曲线" isBezier />
            }
        ]
    }
];

export interface ManualPaneProps {
    stage: Konva.Stage | null;
    manualKey: string;
    selectShapes: Konva.Shape[];
    enableModify: boolean;
    setManualKey: (value: React.SetStateAction<string>) => void;
}

export default memo((props: ManualPaneProps) => {
    /**
     * 菜单、反馈消息和弹窗统一使用同一个翻译入口。
     * 路径绘制说明由 EdgeDrawingMenuLabel 在自身展示边界内完成翻译。
     */
    const { t } = useI18n();

    const { stage, manualKey, selectShapes, enableModify, setManualKey } = props;

    // 平移的弹窗
    const [openTranslate, setOpenTranslate] = useState<boolean>(false);
    // 复制的弹窗
    const [openCopy, setOpenCopy] = useState<boolean>(false);
    // 连线对齐的弹窗
    const [openAlign, setOpenAlign] = useState(false);

    // 对选中的Shape进行平移
    const translateSelectShapes = (shapes: Konva.Shape[]) => {
        if (!shapes?.length) {
            message.warning(t("请选择元素进行平移"));
            return;
        }
        /**
         * 与复制功能检查逻辑一致：检测选中路径的端点节点是否都在选中集合中。
         * 平移时悬挂路径（至少一端节点未选中）不会整体平移，
         * 其端点会跟随选中节点自动同步，这里仅做信息提示，不阻止平移操作。
         */
        const selectNodes = shapes.filter(shape => shape.attrs?.enableSelect === "node");
        const selectEdges = shapes.filter(shape => shape.attrs?.enableSelect === "edge");
        if (selectEdges?.length) {
            const selectNodeIds = new Set(selectNodes.map(node => node.id()));
            // 建立全图节点 id→name 映射，用于报出未选中端点的节点名称
            const allNodes = stage?.find((n: Konva.Shape) => n.attrs?.enableSelect === "node") || [];
            const nodeNames = new Map<string, string>();
            allNodes.forEach(n => {
                nodeNames.set(n.attrs?.id, n.attrs?.name);
            });
            // 收集悬挂路径信息：路径名 + 缺失的端点节点名
            const missingInfo = selectEdges.reduce((accu: string[], edge) => {
                const { snodeId, enodeId, name: edgeName } = edge.attrs?.data || {};
                const sSelected = selectNodeIds.has(snodeId);
                const eSelected = selectNodeIds.has(enodeId);
                // 起点或终点只要有一个没在已选的节点里面就报出来
                if (!sSelected || !eSelected) {
                    const parts: string[] = [];
                    if (!sSelected) {
                        parts.push(t("起始点节点{name}", { name: nodeNames.get(snodeId) || snodeId }));
                    }
                    if (!eSelected) {
                        parts.push(t("终止点节点{name}", { name: nodeNames.get(enodeId) || enodeId }));
                    }
                    accu.push(`${edgeName || ""}（${parts.join("、")}）`);
                }
                return accu;
            }, []);
            if (missingInfo?.length) {
                message.warning(t("以下路径的端点节点未选中，将不会被平移：{info}", { info: missingInfo.join("、") }));
            }
        }
        setOpenTranslate(true);
    };

    // 对选中的元素复制
    const copySelectShapes = (shapes: Konva.Shape[]) => {
        if (!shapes?.length) {
            message.warning(t("请选择元素复制"));
            return;
        }
        // 检查路径的起始点是不是在已选择的节点中
        const selectNodes = selectShapes.filter(shape => shape.attrs?.enableSelect === "node");
        if (!selectNodes?.length) {
            message.warning(t("没有选择目标路径的起始点和终止点"));
            return;
        }
        const selectEdges = selectShapes.filter(shape => shape.attrs?.enableSelect === "edge");
        // 起点或者终点没在已选的节点里面的路径
        const extremeEdges = selectEdges.reduce((accu: string[], curr) => {
            const snodeId = curr.attrs?.data?.snodeId || "";
            const enodeId = curr.attrs?.data?.enodeId || "";
            // 当前路径的起点有没有在已选节点里
            const fs = selectNodes.find(node => node.id() === snodeId);
            // 当前路径的终点有没有在已选的节点里
            const fe = selectNodes.find(node => node.id() === enodeId);
            // 起点或者终点只要有一个没在已选的节点里面就push
            if (!fs || !fe) {
                accu.push(curr.attrs?.data?.name || "");
            }
            return accu;
        }, []);
        if (extremeEdges?.length) {
            // 有路径的起始点和终止点没在已选的节点中
            Modal.info({
                title: t("请检查"),
                content: t("请确认已选择路径的起始点和终止点：{edges}", { edges: extremeEdges.join("、") }),
                okText: t("确定"),
                onOk() {},
              });
        } else {
            setOpenCopy(true); 
        }
    };

    // 对选中的元素进行对齐
    const alignSelectShapes = (shapes: Konva.Shape[], align: string) => {
        /**
         * 对齐功能的实际移动对象只有节点，路径只是跟随节点端点同步更新。
         * 这里按节点数量做入口校验，避免选中多个路径但没有节点时，
         * 进入视觉对齐计算后出现空数组或无效几何状态。
         */
        const nodeShapes = shapes.filter(shape => shape.attrs?.enableSelect === "node");
        if (!nodeShapes?.length || nodeShapes?.length < 2) {
            setManualKey("");
            message.warning(t("请选择至少两个节点"));
            return;
        }
        saveSnapshot();
        // 对齐之后会做两步收尾，alignTwoPointsLine 走 Modal 异步流程，先不在这里处理：
        // 1) straightenSelectedCurves：把"两端节点都在选区里"的贝塞尔曲线拉直，避免对齐后曲线还有弧度
        // 2) snapNearRightAngles：选中节点上"一条边连选区内、一条连选区外"的近 90°（±5°）夹角
        //    自动吸附到 90°；只旋转选区外那条边，选区内节点保持对齐结果不动
        let shouldPostProcess = true;
        switch (align) {
            case "alignLeft":
                alignSelectLeft(shapes);
                break;
            case "alignRight":
                alignSelectRight(shapes);
                break;
            case "alignTop":
                alignSelectTop(shapes);
                break;
            case "alignBottom":
                alignSelectBottom(shapes);
                break;
            case "alignVerticalCenter":
                alignVerticalCenter(shapes);
                break;
            case "alignHorizontalCenter":
                alignHorizontalCenter(shapes);
                break;
            case "horizontalUniformSpacingDistribution":
                horizontalUniformSpacingDistribution(shapes);
                break;
            case "verticalEquidistantDistribution":
                verticalEquidistantDistribution(shapes);
                break;
            case "alignTwoPointsLine":
                setOpenAlign(true);
                shouldPostProcess = false;
                break;
            default:
                shouldPostProcess = false;
                break;
        }
        if (shouldPostProcess) {
            // 注意顺序：先拉直曲线再做 90° 吸附，避免吸附基于曲线的虚拟离开角做出错误旋转
            straightenSelectedCurves(shapes);
            snapNearRightAngles(shapes);
        }
        // 对齐路径全程都是直接 setAttrs，不会触发 Konva drag/mouse 事件，
        // AnglesLayer 监听不到几何变化；这里主动派发一次 angles:refresh 让夹角层立刻重算。
        // alignTwoPointsLine 走 Modal 异步流程，由 AlignModal.handleOk 自行派发。
        if (shouldPostProcess) {
            stage?.fire("angles:refresh", {} as any);
        }
    };

    // 菜单选中的时候调用的方法
    const onManualSelect: MenuProps["onSelect"] = ({ key }) => {
        if ([
            "forwardLine",
            "reverseLine",
            "forwardBezier",
            "reverseBezier"
        ].includes(key)) {
            // 这些条件下，设置节点不可拖动
            setNodeDraggable(stage, false);
        }
        switch (key) {
            case "translate":
                translateSelectShapes(selectShapes);
                break;
            case "copy":
                copySelectShapes(selectShapes);
                break;
            case "alignLeft":
            case "alignRight":
            case "alignTop":
            case "alignBottom":
            case "alignVerticalCenter":
            case "alignHorizontalCenter":
            case "horizontalUniformSpacingDistribution":
            case "verticalEquidistantDistribution":
            case "alignTwoPointsLine":
                alignSelectShapes(selectShapes, key);
                break;
            default:
                setManualKey(key);
                break;
        }
    };

    // 带单取消选中时调用的方法
    const onManualDeselect: MenuProps["onDeselect"] = ({ key }) => {
        setManualKey("");
        if ([
            "forwardLine",
            "reverseLine",
            "forwardBezier",
            "reverseBezier"
        ].includes(key)) {
            // 这些条件下，设置节点可拖动
            setNodeDraggable(stage);
        }
    };

    return (
        <>
            <Menu
                style={{ maxHeight: "calc(100vh - 300px)", overflow: "auto" }}
                disabled={!enableModify}
                selectedKeys={[manualKey]}
                mode="vertical"
                items={buildItems(t)}
                triggerSubMenuAction="hover"
                onSelect={onManualSelect}
                onDeselect={onManualDeselect}
            />
            {/* 平移的弹窗 */}
            <TranslateModal
                open={openTranslate}
                stage={stage}
                selectShapes={selectShapes}
                setOpenTranslate={setOpenTranslate}
            />
            {/* 复制的弹窗 */}
            <CopyModal
                open={openCopy}
                stage={stage}
                selectShapes={selectShapes}
                setOpenCopy={setOpenCopy}
            />
            {/* 对齐的弹窗 */}
            <AlignModal
                open={openAlign}
                selectShapes={selectShapes}
                setOpenAlign={setOpenAlign}
            />
        </>
    )
});
