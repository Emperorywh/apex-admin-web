/**
 * @description 节点/路径动作角标的 Canvas 矢量绘制函数（命令式/声明式通用）
 * @date 2026-6-28
 *
 * 渲染「染色圆 + 内嵌数量」通用徽章（SPEC D1/D3）：
 *   - 圆填充色 = 该元素最严重 blockingType（HARD 红 / SOFT 黄 / NONE 灰，D5）
 *   - 圆心数字 = 动作总数（D3，1 个也显示「1」，统一）
 *   - 不旋转（D8），数字始终正立可读（区别于设备图标跟随切线旋转）
 *
 * 与设备 deviceIconSceneFunc 的差异：
 *   设备图标需跟随路径切线旋转，故 translate/rotate/法线偏移在 sceneFunc 内部完成；
 *   动作角标不旋转，故锚点（含节点右上角偏移 / edge 法线+下方偏移）由调用方预算好传入，
 *   sceneFunc 只做「平移到锚点 → 绘制圆 + 数字」，hitFunc 同口径限定为圆形本体。
 *
 * shape.getAttrs().data 需包含：
 *   - anchorX anchorY: number  最终锚点（节点右上角点 / edge 中点下方+法线错开点，canvas 坐标）
 *   - count: number              动作总数（圆心数字）
 *   - severity: ActionSeverity   最严重阻塞等级（决定圆填充色）
 *   - scale: number              视觉倍率（命令式=visualScale，声明式=1）
 *   - isDark: boolean            是否暗黑主题
 *   - isSelected?: boolean       节点/路径选中联动高亮（D19）
 */
import type Konva from "konva";
import { Context } from "konva/lib/Context";
import {
    getSeverityColor,
    actionStrokeColor,
    ACTION_NUMBER_COLOR,
    ACTION_SELECTED_RING,
} from "./actionStyles";
import type { ActionSeverity } from "./index";
import { DEVICE_BASE_RADIUS, DEVICE_NORMAL_OFFSET_RATIO } from "@/plugins/konva/devices";

/**
 * 角标基准半径（地图米）
 * 取值 0.16，小于设备图标 DEVICE_BASE_RADIUS(0.4)，作为「通知徽章」避免喧宾夺主（SPEC §3.3）
 */
export const ACTION_BASE_RADIUS = 0.16;

/**
 * 节点角标右上角偏移（地图米）
 * ≈ nodeStyle.radius(0.1) × 2.2，使角标贴在节点圆轮廓的右上外侧（通知红点位，SPEC §3.1/D6）
 */
export const ACTION_NODE_OFFSET = 0.22;

/**
 * 路径动作角标与三方设备图标之间的视觉间距（地图米）
 * 动作角标落在设备图标的法线外侧，二者之间保留此间距，避免重叠/拥挤
 */
const ACTION_BADGE_GAP = 0.1;

/**
 * 动作角标贴近设备图标的回收系数
 * 仅用基准偏移（设备外缘外侧 + 动作半径 + 间距）时角标会完全脱离设备、离路径过远；
 * 乘此系数整体回收，使角标贴近设备图标边缘（类似应用图标上的数字角标），既不脱离路径、又与设备图标区分。
 * 取 2/3，即在基准偏移基础上靠近 1/3。
 */
const ACTION_EDGE_OFFSET_SCALE = 0;

/**
 * 路径动作角标的法线绝对偏移（地图米，SPEC §3.4/D16）
 *
 * 基准 = 设备图标圆心法线距（DEVICE_BASE_RADIUS × DEVICE_NORMAL_OFFSET_RATIO）
 *        + 设备半径（DEVICE_BASE_RADIUS，到设备外缘）
 *        + 动作半径（ACTION_BASE_RADIUS，外贴设备外缘）
 *        + 视觉间距（ACTION_BADGE_GAP）；
 * 再乘 ACTION_EDGE_OFFSET_SCALE 整体回收，使角标贴近设备图标边缘而非远远分开。
 *
 * 口径与设备偏移同源（均以 labelPoint 为基准沿法线展开）；
 * 命令式乘 visualScale、声明式由 stage 缩放，与设备偏移用法一致。
 */
export const ACTION_EDGE_NORMAL_OFFSET =
    (DEVICE_BASE_RADIUS * DEVICE_NORMAL_OFFSET_RATIO +
        DEVICE_BASE_RADIUS +
        ACTION_BASE_RADIUS +
        ACTION_BADGE_GAP) *
    ACTION_EDGE_OFFSET_SCALE;

/**
 * 路径角标「中点下方」偏移（地图米，canvas 下 = y+）
 * 与 name 标签（中点）、设备图标（法线侧）解耦，避免三者重叠（SPEC §3.1/D16）
 */
export const ACTION_EDGE_OFFSET_Y = 0.22;

/**
 * 动作角标场景绘制函数（命令式/声明式通用）
 * 内部仅做「平移到锚点 → 选中环 → 染色圆 → 中心数字」，不旋转（D8）
 */
export const actionBadgeSceneFunc = (
    context: Context,
    shape: Konva.Shape
) => {
    const {
        anchorX,
        anchorY,
        count,
        severity,
        scale,
        isDark,
        isSelected,
    } = (shape.getAttrs()?.data || {}) as {
        anchorX: number;
        anchorY: number;
        count: number;
        severity: ActionSeverity;
        scale: number;
        isDark: boolean;
        isSelected?: boolean;
    };
    // 实际绘制半径跟随 scale 自适应（SPEC §3.3）
    const R = ACTION_BASE_RADIUS * scale;

    context.save();
    // 平移到最终锚点（节点右上角 / edge 中点下方+法线错开点）
    context.translate(anchorX, anchorY);

    // 选中联动高亮环（D19）：被选中的节点/路径，其角标外加一圈高亮环
    if (isSelected) {
        context.beginPath();
        context.arc(0, 0, R * 1.3, 0, Math.PI * 2);
        context.fillStyle = ACTION_SELECTED_RING;
        context.fill();
    }

    // 染色圆：填充色 = 最严重 blockingType（D5）
    context.beginPath();
    context.arc(0, 0, R, 0, Math.PI * 2);
    context.fillStyle = getSeverityColor(severity, isDark);
    context.fill();
    // 描边保证在彩色路径/节点上可辨
    context.lineWidth = R * 0.14;
    context.strokeStyle = actionStrokeColor(isDark);
    context.stroke();

    // 中心数字：动作总数（D3），白色正立可读
    const text = String(count ?? 0);
    // 两位及以上数字时字号略缩，保证不出圆（SPEC §3.3）
    const fontSize = (text.length > 1 ? R * 0.88 : R * 1.1);
    context.fillStyle = ACTION_NUMBER_COLOR;
    context.font = `bold ${fontSize}px Arial`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 0, R * 0.05);

    context.restore();
    // 收尾：与 nodeSceneFunc/edgeSceneFunc 保持一致，shape 未设 fill/stroke 时为 no-op
    context.fillStrokeShape(shape);
};

/**
 * 动作角标命中区域函数（listening=true 时启用 hover）
 *
 * 命中区域限定为角标圆形本体（半径 R），使 hover/点击只命中徽章本身、
 * 不扩大到 bounding box，从而不影响下层路径/节点选中（SPEC D12）。
 *
 * 角标锚点偏移由调用方预算、sceneFunc 内部 translate 完成（非 Shape 的 x/y 属性），
 * 故 hitFunc 直接在锚点处画圆即可（与 sceneFunc 的 translate 后坐标系一致）。
 */
export const actionBadgeHitFunc = (context: Context, shape: Konva.Shape) => {
    const { anchorX, anchorY, scale } = (shape.getAttrs()?.data || {}) as {
        anchorX: number;
        anchorY: number;
        scale: number;
    };
    const R = ACTION_BASE_RADIUS * scale;
    context.beginPath();
    context.arc(anchorX, anchorY, R, 0, Math.PI * 2);
    context.closePath();
    context.fillStrokeShape(shape);
};
