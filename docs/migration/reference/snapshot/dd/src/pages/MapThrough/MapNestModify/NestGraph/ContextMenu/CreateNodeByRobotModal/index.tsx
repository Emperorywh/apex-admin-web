/**
 * @description 根据车体坐标创建节点 的 Modal（合并自原「生成站点」+「延伸生成站点」两个入口）
 *              布局采用「精密工程仪表」风格：
 *              - 统一的参数表 label（强调色竖条 + 文字 + 图标）
 *              - 落点用卡片式二选一（车体当前位置 / 沿朝向偏移），比 Radio 更具层次
 *              - 偏移模式下提供「十字方向盘」（3×3 网格，中心车体，四向可选）+ 距离输入，
 *                把抽象的「前/后/左/右」空间化，贴合「沿车体朝向偏移」的语义。
 *              确认时用 agvKey 重查车体，读取其最新坐标与朝向（沿用原决策 6，不缓存右键瞬间值）。
 * @date 2026-6-15
 *
 * 几何（画布世界坐标、米；R = robot.rotation() = -theta，弧度，因 Konva.angleDeg=false）：
 *   前  D·( cos R,  sin R)
 *   后  D·(-cos R, -sin R)
 *   左  D·( sin R, -cos R)   // 相对车头：画布 y 朝下时左侧
 *   右  D·(-sin R,  cos R)
 * 手性以"车头朝右(R≈0) + 左方 1m → 屏幕上方"为准；若实测相反，翻转 left/right 符号。
 *
 * 关键决策（见 docs/SPEC_create_node_from_robot.md）：
 * - 决策 4：节点类型下拉（nodeTypeOptions 7 种），默认 work。
 * - 决策 2：统一弹窗 + 落点模式开关，「当前位置」隐藏方向/距离。
 * - 决策 5：默认 work、不记忆，每次打开重置。
 * - 决策 6：所有类型 angle=null，不画方向箭头。
 * - 决策 14：成功文案 `已生成【${typeLabel}】节点：${name}`。
 * - 决策 15：切换模式不清空已填的方向/距离，仅控制显隐。
 * - 决策 16：每次打开重置为 落点=当前位置、类型=work、方向=前、距离=1。
 * - 决策 9：校验/判重失败均 message.warning 并 return（不关闭）。
 *
 * 注：本次仅优化弹窗内部布局与视觉，未改动任何功能逻辑（上述决策几何与校验全部保留）。
 */
import { memo, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Modal, InputNumber, Select, message } from "antd";
import {
    RobotOutlined,
    ApartmentOutlined,
    AimOutlined,
    EnvironmentOutlined,
    ArrowsAltOutlined
} from "@ant-design/icons";
import type Konva from "konva";
import type { NodeType } from "@/plugins/konva/nodes";
import { findDuplicateNodeName } from "@/utils/graph";
import { saveSnapshot } from "@/utils/undoHistory";
import { nodeTypeOptions } from "@/constants/mapThrough";
import { createNodeShape } from "../createNodeShape";
import { useI18n } from "@/hooks/useI18n";

/** 落点模式：车体当前位置 / 沿朝向偏移 */
type LandingMode = "current" | "offset";

/** 延伸方向：相对车头的前/后/左/右 */
type ExtendDirection = "front" | "back" | "left" | "right";

/**
 * 方向盘配置：箭头符号 + 在 3×3 网格中的位置（gridArea: 行 / 列）。
 * 中心格(2/2)留作车体图标，四角留空，构成十字布局。
 */
const DIRECTION_PAD: {
    value: ExtendDirection;
    label: string;
    arrow: string;
    gridArea: string;
}[] = [
    { value: "front", label: "前", arrow: "↑", gridArea: "1 / 2" },
    { value: "left", label: "左", arrow: "←", gridArea: "2 / 1" },
    { value: "right", label: "右", arrow: "→", gridArea: "2 / 3" },
    { value: "back", label: "后", arrow: "↓", gridArea: "3 / 2" }
];

/** 距离约束（米）：默认 1，范围 0.1~50，步进 0.1 */
const DISTANCE_MIN = 0.1;
const DISTANCE_MAX = 50;
const DISTANCE_STEP = 0.1;
const DISTANCE_DEFAULT = 1;

/**
 * 配色（精密工程仪表：克制的工程蓝 + 中性灰，与 antd5 协调）
 * - accent：交互主色；accentDeep：选中态深色；accentBg：选中态浅底
 * - text/textSub：主/次文字；border/panel：边框与面板背景
 */
const COLOR = {
    accent: "#1677ff",
    accentDeep: "#0958d9",
    accentBg: "#e6f4ff",
    text: "#1f2329",
    textSub: "#6b7280",
    textFaint: "#9ca3af",
    border: "#e5e7eb",
    panel: "#f9fafb",
    panelBorder: "#eef0f3"
};

/* ---------- 样式常量（静态，定义于模块顶层以避免重渲染时重建） ---------- */

/** 参数表标签：强调色竖条 + 图标 + 文字，统一的「工程参数表」标签样式 */
const sectionLabelStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    color: COLOR.textSub,
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "0.03em",
    userSelect: "none"
};
/** 标签前的强调色小竖条 */
const sectionBarStyle: CSSProperties = {
    width: 3,
    height: 12,
    borderRadius: 2,
    background: COLOR.accent
};

/** 落点卡片：未选中态（白底 + 浅边框，可点击） */
const landingCardStyle: CSSProperties = {
    flex: 1,
    border: `1px solid ${COLOR.border}`,
    borderRadius: 10,
    padding: "12px 14px",
    cursor: "pointer",
    transition: "all .18s ease",
    background: "#fff"
};
/** 落点卡片：选中态（强调色边框 + 浅强调底 + 微阴影） */
const landingCardActiveStyle: CSSProperties = {
    ...landingCardStyle,
    border: `1px solid ${COLOR.accent}`,
    background: COLOR.accentBg,
    boxShadow: "0 1px 2px rgba(22,119,255,.10)"
};
const cardTitleStyle: CSSProperties = { fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 };
const cardDescStyle: CSSProperties = { fontSize: 11.5, color: COLOR.textSub, marginTop: 3 };

/** 偏移参数面板：浅灰圆角容器，与上方落点卡片形成分组层次 */
const offsetPanelStyle: CSSProperties = {
    background: COLOR.panel,
    border: `1px solid ${COLOR.panelBorder}`,
    borderRadius: 12,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 16
};

/** 十字方向盘：3×3 网格（前/中心车体/后 + 左/右），四角留空 */
const padGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, 58px)",
    gridTemplateRows: "repeat(3, 58px)",
    gap: 8,
    width: "fit-content"
};
/** 方向盘中心：车体图标示意位（不可点击） */
const padCenterStyle: CSSProperties = {
    gridArea: "2 / 2",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    background: "#eef1f5",
    color: COLOR.textFaint,
    fontSize: 20
};
/** 方向按钮：未选中态（白底 + 浅边框） */
const padBtnStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    borderRadius: 12,
    cursor: "pointer",
    transition: "all .15s ease",
    border: `1px solid ${COLOR.border}`,
    background: "#fff",
    color: COLOR.textSub,
    userSelect: "none"
};
/** 方向按钮：选中态（强调色填充 + 白字 + 投影） */
const padBtnActiveStyle: CSSProperties = {
    ...padBtnStyle,
    border: `1px solid ${COLOR.accent}`,
    background: COLOR.accent,
    color: "#fff",
    boxShadow: "0 2px 8px rgba(22,119,255,.30)"
};

/** 面板底部说明文字 */
const hintStyle: CSSProperties = {
    fontSize: 11.5,
    color: COLOR.textFaint,
    lineHeight: 1.6
};

/**
 * @description 参数表字段标签（左侧强调色竖条 + 图标 + 文字）
 */
const SectionLabel = ({ icon, children }: { icon?: ReactNode; children: ReactNode }) => (
    <div style={sectionLabelStyle}>
        <span style={sectionBarStyle} />
        {icon}
        <span>{children}</span>
    </div>
);

interface CreateNodeByRobotModalProps {
    /** 是否打开 */
    open: boolean;
    /** 右键时记录的车体 id，确认时用于重查车体 */
    agvKey?: string;
    /** 当前地图 id */
    useMapId: string;
    /** 画布舞台，由 event.target.getStage() 传入 */
    stage: Konva.Stage | null;
    /** 关闭回调 */
    onClose: () => void;
}

/**
 * @description 按方向计算相对车体的偏移向量（画布世界坐标、米）
 * @param direction 延伸方向
 * @param R 车体渲染旋转（弧度）= -theta
 * @param distance 距离（米）
 * @returns [dx, dy]
 */
const computeOffset = (direction: ExtendDirection, R: number, distance: number): [number, number] => {
    const cosR = Math.cos(R);
    const sinR = Math.sin(R);
    switch (direction) {
        case "front":
            return [distance * cosR, distance * sinR];
        case "back":
            return [-distance * cosR, -distance * sinR];
        case "left":
            return [distance * sinR, -distance * cosR];
        case "right":
            return [-distance * sinR, distance * cosR];
        default:
            return [distance * cosR, distance * sinR];
    }
};

/**
 * @description 在 stage 上按 agvKey 重查车体 Shape（决策 6）
 * @returns 车体 Shape 或 undefined（车体已驶离画布/被移除）
 */
const findRobot = (stage: Konva.Stage | null, agvKey?: string): Konva.Shape | undefined => {
    if (!stage || !agvKey) return;
    return stage.findOne(
        (n: Konva.Node) => n.attrs?.isRobot === true && n.attrs?.id === agvKey
    ) as Konva.Shape | undefined;
};

const CreateNodeByRobotModal = memo((props: CreateNodeByRobotModalProps) => {
    const { open, agvKey, useMapId, stage, onClose } = props;
    /* 国际化翻译方法，用于节点类型等文案的多语言转换 */
    const { t } = useI18n();
    // 决策 5/16：默认 work、不记忆；每次打开重置为默认
    const [nodeType, setNodeType] = useState<NodeType>("work");
    const [landing, setLanding] = useState<LandingMode>("current");
    const [direction, setDirection] = useState<ExtendDirection>("front");
    const [distance, setDistance] = useState<number>(DISTANCE_DEFAULT);

    // 每次打开重置为默认（落点=当前位置、类型=work、方向=前、距离=1），避免上次选择残留
    useEffect(() => {
        if (open) {
            setNodeType("work");
            setLanding("current");
            setDirection("front");
            setDistance(DISTANCE_DEFAULT);
        }
    }, [open]);

    // 决策 14：成功文案按类型动态（typeLabel 取自 nodeTypeOptions）
    const typeLabel = t(nodeTypeOptions.find(opt => opt.value === nodeType)?.label ?? "");

    /**
     * 确认生成（决策 9：校验/判重失败均 message.warning 并 return，不关闭）：
     * 1. 重查车体 2. 按落点模式算坐标 3. 判重 4. 快照+建点 5. 提示+关闭
     */
    const handleOk = () => {
        // 1. 重查车体（两模式都需要，沿用决策 6：确认时实时读取，不缓存右键瞬间坐标）
        const robot = findRobot(stage, agvKey);
        if (!robot) {
            message.warning(t("未找到车体（可能已驶离画布或被移除）"));
            return;
        }
        // 2. 按落点模式算目标坐标
        let nx = robot.x();
        let ny = robot.y();
        if (landing === "offset") {
            // 偏移模式：先校验距离，再按方向偏移
            if (typeof distance !== "number" || isNaN(distance) || distance < DISTANCE_MIN || distance > DISTANCE_MAX) {
                message.warning(t("距离需在 {min} ~ {max} 之间", { min: DISTANCE_MIN, max: DISTANCE_MAX }));
                return;
            }
            const R = robot.rotation();
            const [dx, dy] = computeOffset(direction, R, distance);
            nx = nx + dx;
            ny = ny + dy;
        }
        // 3. 判重（沿用 findDuplicateNodeName，所有类型一起判）
        const dupName = findDuplicateNodeName(stage, nx, ny);
        if (dupName !== null) {
            message.warning(t("该坐标已存在节点：{name}", { name: dupName }));
            return;
        }
        // 4. 快照 + 建点（type 由用户选择，默认 work）
        saveSnapshot();
        const shape = createNodeShape(stage, useMapId, nx, ny, nodeType);
        // 5. 提示 + 关闭（决策 14）
        if (shape) {
            message.success(t("已生成【{type}】节点：{name}", { type: typeLabel, name: shape.attrs?.data?.name }));
            onClose();
        } else {
            message.warning(t("节点生成失败（未找到节点图层）"));
        }
    };

    return (
        <Modal
            title={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <RobotOutlined style={{ color: COLOR.accent }} />
                    <span>{t("根据车体坐标创建节点")}</span>
                </div>
            }
            open={open}
            okText={t("生成")}
            cancelText={t("取消")}
            onOk={handleOk}
            onCancel={onClose}
            centered
            width={460}
            bodyStyle={{ paddingTop: 18 }}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* 节点类型（决策 4：复用 nodeTypeOptions，默认 work） */}
                <div>
                    <SectionLabel icon={<ApartmentOutlined />}>{t("节点类型")}</SectionLabel>
                    <Select
                        options={nodeTypeOptions?.map(o => ({ ...o, label: t(o.label) }))}
                        value={nodeType}
                        onChange={value => setNodeType(value as NodeType)}
                        style={{ width: "100%" }}
                    />
                </div>

                {/* 落点模式（决策 2：车体当前位置 / 沿朝向偏移）—— 卡片式二选一 */}
                <div>
                    <SectionLabel icon={<AimOutlined />}>{t("落点")}</SectionLabel>
                    <div style={{ display: "flex", gap: 12 }}>
                        {/* 卡片：车体当前位置 */}
                        <div
                            style={landing === "current" ? landingCardActiveStyle : landingCardStyle}
                            onClick={() => setLanding("current")}
                        >
                            <EnvironmentOutlined
                                style={{
                                    fontSize: 18,
                                    color: landing === "current" ? COLOR.accentDeep : COLOR.textFaint
                                }}
                            />
                            <div style={{ marginTop: 8 }}>
                                <div
                                    style={{
                                        ...cardTitleStyle,
                                        color: landing === "current" ? COLOR.accentDeep : COLOR.text
                                    }}
                                >
                                    {t("车体当前位置")}
                                </div>
                                <div style={cardDescStyle}>{t("在车体正下方生成节点")}</div>
                            </div>
                        </div>
                        {/* 卡片：沿朝向偏移 */}
                        <div
                            style={landing === "offset" ? landingCardActiveStyle : landingCardStyle}
                            onClick={() => setLanding("offset")}
                        >
                            <ArrowsAltOutlined
                                style={{
                                    fontSize: 18,
                                    color: landing === "offset" ? COLOR.accentDeep : COLOR.textFaint
                                }}
                            />
                            <div style={{ marginTop: 8 }}>
                                <div
                                    style={{
                                        ...cardTitleStyle,
                                        color: landing === "offset" ? COLOR.accentDeep : COLOR.text
                                    }}
                                >
                                    {t("沿朝向偏移")}
                                </div>
                                <div style={cardDescStyle}>{t("按方向与距离外推")}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 偏移参数：仅偏移模式显示（决策 15：切换模式不清空已填参数，仅控制显隐） */}
                {landing === "offset" && (
                    <div style={offsetPanelStyle}>
                        {/* 方向：十字方向盘，把「前/后/左/右」空间化 */}
                        <div>
                            <SectionLabel icon={<ArrowsAltOutlined />}>{t("方向（相对车头）")}</SectionLabel>
                            <div style={padGridStyle}>
                                {DIRECTION_PAD.map(item => (
                                    <div
                                        key={item.value}
                                        style={{
                                            ...(direction === item.value ? padBtnActiveStyle : padBtnStyle),
                                            gridArea: item.gridArea
                                        }}
                                        onClick={() => setDirection(item.value)}
                                    >
                                        <span style={{ fontSize: 15, lineHeight: 1 }}>{item.arrow}</span>
                                        <span style={{ fontSize: 12 }}>{t(item.label)}</span>
                                    </div>
                                ))}
                                {/* 中心：车体图标示意 */}
                                <div style={padCenterStyle}>
                                    <RobotOutlined />
                                </div>
                            </div>
                        </div>

                        {/* 延伸距离 */}
                        <div>
                            <SectionLabel>{t("延伸距离")}</SectionLabel>
                            <InputNumber
                                value={distance}
                                min={DISTANCE_MIN}
                                max={DISTANCE_MAX}
                                step={DISTANCE_STEP}
                                addonAfter="m"
                                onChange={value =>
                                    setDistance(typeof value === "number" ? value : DISTANCE_DEFAULT)
                                }
                                style={{ width: "100%" }}
                            />
                        </div>

                        {/* 说明：澄清方向以车体实时朝向为准 */}
                        <div style={hintStyle}>
                            {t("方向相对车头，距离相对车体当前位置；朝向以车体实时姿态为准。")}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
});

export default CreateNodeByRobotModal;
