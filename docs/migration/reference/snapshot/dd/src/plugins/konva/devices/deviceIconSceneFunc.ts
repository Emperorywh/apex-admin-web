/**
 * @description 路径三方设备图标的 Canvas 矢量绘制函数（命令式/声明式通用）
 * @date 2026-6-27
 *
 * 设计理念（辨识度优先）：五种设备采用五种截然不同的外轮廓，
 * 配合既有 Material 语义色，使图标在地图缩放后仅凭外形即可区分：
 *   - 电梯    正圆角方框 + 加粗上下双箭头（外轮廓=正方形）
 *   - 自动门   横向门洞 + 双扇门片 + 门片上的张开箭头（外轮廓=横向扁矩形，宽:高≈1.7:1）
 *   - 风淋门   门框+双扇门片+门片波浪风线（外轮廓=横向扁矩形，靠紫色配色与风标识区别于自动门）
 *   - 交通灯   圆形灯罩 + 纵向红黄绿三灯（外轮廓=圆形）
 *   - 占位    菱形 + 中央问号（外轮廓=菱形）
 *
 * 与节点 sceneFunc 风格一致：所有图标以原点为中心、半径 R 范围内绘制。
 * 本函数内部完成「平移到锚点 → 旋转到切线方向 → 沿法线偏移 → 绘制」全套变换，
 * 这样 Shape 自身无需设置 x/y/rotation，命令式画布 visualScale 变化时只需更新 data.scale。
 *
 * shape.getAttrs().data 需包含：
 *   - deviceType: DeviceIconType  设备类型，决定画哪种图标
 *   - anchorX anchorY: number     锚点（路径标签点，canvas 坐标即 y 已取反）
 *   - angle: number               切线角度（弧度，来自 computeEdgeTangentAngle）
 *   - isBackEdge: boolean         是否反向边（决定法线偏移正负侧）
 *   - scale: number               视觉倍率（命令式=visualScale，声明式=edgeScale）
 *   - isDark: boolean             是否暗黑主题，决定取哪套配色
 *   - isSelected?: boolean        路径选中联动高亮（D19，仅命令式画布会设置）
 *
 * state 参数为本期预留的实时状态接口（D3），Konva 调用时不传入，恒为 undefined。
 */
import type Konva from "konva";
import { Context } from "konva/lib/Context";
import { deviceStyles } from "./deviceStyles";
import type { DeviceIconType, DeviceState } from "./index";

/**
 * 设备图标基准半径（地图米）
 * 取值 0.22，大于工作站/充电/停靠/货架等节点半径(0.15)，
 * 使设备图标在视觉上明显大于节点（圆/六边形/菱形等外轮廓外接半径 ≈ 0.85 × R）
 */
export const DEVICE_BASE_RADIUS = 0.4;

/**
 * 图标法线偏移系数（相对基准半径 R）：正向/反向图标沿法线错开的距离（SPEC D5/§3.6）
 * 标签让位也复用同一系数，保证标签与图标分离
 */
export const DEVICE_NORMAL_OFFSET_RATIO = 1.1;

/**
 * 绘制圆角矩形路径（用 arc 拼接四角，兼容性优于 roundRect）
 * 坐标系：以 (x, y) 为左上角，宽 w、高 h，圆角半径 r
 */
const roundRectPath = (
    context: Context,
    x: number, y: number, w: number, h: number, r: number
) => {
    context.beginPath();
    context.moveTo(x + r, y);
    // 上边
    context.lineTo(x + w - r, y);
    // 右上角
    context.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    // 右边
    context.lineTo(x + w, y + h - r);
    // 右下角
    context.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    // 下边
    context.lineTo(x + r, y + h);
    // 左下角
    context.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    // 左边
    context.lineTo(x, y + r);
    // 左上角
    context.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
    context.closePath();
};

/**
 * 电梯：正圆角方框（轿厢）+ 框内加粗白色上下双箭头（表示升降）
 * 外轮廓为正方形，与横向的自动门、六边形的风淋门明显区分
 */
const drawElevator = (context: Context, R: number, fill: string, stroke: string) => {
    // 外框：圆角正方形
    roundRectPath(context, -0.8 * R, -0.8 * R, 1.6 * R, 1.6 * R, 0.24 * R);
    context.fillStyle = fill;
    context.fill();
    context.lineWidth = R * 0.14;
    context.strokeStyle = stroke;
    context.stroke();
    // 框内白色双箭头（加大加粗，保证小尺寸下仍清晰可见）
    context.fillStyle = "#FFFFFF";
    // 上箭头 ▲
    context.beginPath();
    context.moveTo(0, -0.52 * R);
    context.lineTo(-0.32 * R, -0.08 * R);
    context.lineTo(0.32 * R, -0.08 * R);
    context.closePath();
    context.fill();
    // 下箭头 ▼
    context.beginPath();
    context.moveTo(0, 0.52 * R);
    context.lineTo(-0.32 * R, 0.08 * R);
    context.lineTo(0.32 * R, 0.08 * R);
    context.closePath();
    context.fill();
};

/**
 * 自动门：横向门洞（顶部轨道横梁）+ 双扇对开门片 + 中缝张开箭头
 * 外轮廓横向铺开（宽:高≈1.7:1），与正方形的电梯、六边形的风淋门明显区分
 */
const drawAutoDoor = (context: Context, R: number, fill: string, stroke: string) => {
    // 顶部轨道横梁（门楣），横向贯穿
    context.beginPath();
    context.moveTo(-0.9 * R, -0.6 * R);
    context.lineTo(0.9 * R, -0.6 * R);
    context.lineWidth = R * 0.14;
    context.strokeStyle = stroke;
    context.lineCap = "round";
    context.stroke();
    // 两扇门片（绿色填充），中间留出开启缝隙
    const doorH = 1.0 * R;
    const doorW = 0.74 * R;
    // 左门片
    roundRectPath(context, -0.82 * R, -0.5 * R, doorW, doorH, 0.08 * R);
    context.fillStyle = fill;
    context.fill();
    context.lineWidth = R * 0.07;
    context.strokeStyle = stroke;
    context.stroke();
    // 右门片
    roundRectPath(context, 0.08 * R, -0.5 * R, doorW, doorH, 0.08 * R);
    context.fill();
    context.stroke();
    // 两扇门片上各绘制一个朝外的张开箭头（左门片朝左 <，右门片朝右 >，表示两扇门向两侧滑动打开）
    context.strokeStyle = "#FFFFFF";
    context.lineWidth = R * 0.1;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    // 左门片上的朝左箭头 <（左门片中心约 -0.45R）
    const lx = -0.45 * R;
    context.moveTo(lx + 0.11 * R, -0.2 * R);
    context.lineTo(lx - 0.11 * R, 0);
    context.lineTo(lx + 0.11 * R, 0.2 * R);
    // 右门片上的朝右箭头 >（右门片中心约 0.45R）
    const rx = 0.45 * R;
    context.moveTo(rx - 0.11 * R, -0.2 * R);
    context.lineTo(rx + 0.11 * R, 0);
    context.lineTo(rx - 0.11 * R, 0.2 * R);
    context.stroke();
};

/**
 * 风淋门：门框（顶部门楣横梁）+ 双扇门片 + 每扇门片上的白色波浪风线
 *
 * 设计取舍（与自动门的区分）：
 *   风淋门本质上也是一种门（带风淋功能的通道门），故外轮廓采用与自动门一致的门形，
 *   提升门的语义可读性；再通过两点与自动门区分——
 *     1) 配色：风淋门紫色 vs 自动门绿色；
 *     2) 门片标识：风淋门画波浪风线（表示风淋气流）vs 自动门画中缝张开箭头。
 *   "风的标识"绘制在两扇门片上各一组，直观表达风淋门向内吹淋气流的语义。
 */
const drawAirShowerDoor = (context: Context, R: number, fill: string, stroke: string) => {
    // 顶部门楣横梁（门框上沿），横向贯穿，与自动门保持一致的门框结构
    context.beginPath();
    context.moveTo(-0.9 * R, -0.6 * R);
    context.lineTo(0.9 * R, -0.6 * R);
    context.lineWidth = R * 0.14;
    context.strokeStyle = stroke;
    context.lineCap = "round";
    context.stroke();
    // 两扇门片（紫色填充），中间留出闭合缝隙
    const doorH = 1.0 * R;
    const doorW = 0.74 * R;
    // 左门片
    roundRectPath(context, -0.82 * R, -0.5 * R, doorW, doorH, 0.08 * R);
    context.fillStyle = fill;
    context.fill();
    context.lineWidth = R * 0.07;
    context.strokeStyle = stroke;
    context.stroke();
    // 右门片
    roundRectPath(context, 0.08 * R, -0.5 * R, doorW, doorH, 0.08 * R);
    context.fill();
    context.stroke();
    // 两扇门片上各绘制一组风的标识（白色波浪线，表示风淋喷出的气流）
    context.strokeStyle = "#FFFFFF";
    context.lineWidth = R * 0.08;
    context.lineCap = "round";
    context.lineJoin = "round";
    /**
     * 在单扇门片中心绘制风的标识：两条平行波浪线（正弦形气流线 ~）
     * @param cx 门片中心 x 坐标
     */
    const drawWind = (cx: number) => {
        [-0.2, 0.2].forEach((dy) => {
            const y = dy * R;
            context.beginPath();
            context.moveTo(cx - 0.2 * R, y);
            // 贝塞尔正弦波浪：起平→下凸→上凸→止平，形成 ~ 形气流线
            context.bezierCurveTo(
                cx - 0.07 * R,
                y - 0.1 * R,
                cx + 0.07 * R,
                y + 0.1 * R,
                cx + 0.2 * R,
                y
            );
            context.stroke();
        });
    };
    drawWind(-0.45 * R); // 左门片上的风
    drawWind(0.45 * R); // 右门片上的风
};

/**
 * 交通灯：圆形灯罩 + 纵向红黄绿三盏信号灯（带光晕，本期静态不随状态变化）
 * 外轮廓为圆形，区别于方框类设备；圆形 + 三色灯辨识度高
 */
const drawTrafficLight = (
    context: Context,
    R: number,
    colors: { red: string; yellow: string; green: string; frame: string },
    stroke: string
) => {
    // 圆形灯罩
    const rr = 0.85 * R;
    context.beginPath();
    context.arc(0, 0, rr, 0, Math.PI * 2);
    context.fillStyle = colors.frame;
    context.fill();
    context.lineWidth = R * 0.12;
    context.strokeStyle = stroke;
    context.stroke();
    // 纵向红黄绿三盏灯（带光晕，更醒目）
    const lampR = 0.17 * R;
    /**
     * 绘制单盏灯：外圈半透明光晕 + 实心灯心
     */
    const drawLamp = (y: number, color: string) => {
        // 光晕（半透明同色大圆）
        context.beginPath();
        context.arc(0, y, lampR * 1.6, 0, Math.PI * 2);
        context.fillStyle = color;
        context.globalAlpha = 0.25;
        context.fill();
        context.globalAlpha = 1;
        // 灯心
        context.beginPath();
        context.arc(0, y, lampR, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
    };
    drawLamp(-0.4 * R, colors.red);
    drawLamp(0, colors.yellow);
    drawLamp(0.4 * R, colors.green);
};

/**
 * 占位 unknown：菱形 + 中央问号
 * 外轮廓为菱形，与方框/六边形/圆形均不同，未知设备一眼可辨
 */
const drawUnknown = (context: Context, R: number, fill: string, stroke: string) => {
    // 菱形（正方形旋转 45°）
    const rr = 0.85 * R;
    context.beginPath();
    context.moveTo(0, -rr);
    context.lineTo(rr, 0);
    context.lineTo(0, rr);
    context.lineTo(-rr, 0);
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.lineWidth = R * 0.12;
    context.strokeStyle = stroke;
    context.stroke();
    // 中央白色问号
    context.fillStyle = "#FFFFFF";
    context.font = `bold ${1.3 * R}px Arial`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("?", 0, 0.05 * R);
};

/**
 * 设备图标场景绘制函数（命令式/声明式通用）
 * 内部完成 平移→旋转→法线偏移→绘制，Shape 自身无需 x/y/rotation
 * state 为预留的实时状态接口（D3），本期 Konva 不传入，恒为 undefined
 */
export const deviceIconSceneFunc = (
    context: Context,
    shape: Konva.Shape,
    _state?: DeviceState
) => {
    const {
        deviceType, anchorX, anchorY, angle, isBackEdge, scale, isDark, isSelected
    } = (shape.getAttrs()?.data || {}) as {
        deviceType: DeviceIconType;
        anchorX: number;
        anchorY: number;
        angle: number;
        isBackEdge: boolean;
        scale: number;
        isDark: boolean;
        isSelected?: boolean;
    };
    // 实际绘制半径与法线偏移均跟随 scale 自适应（SPEC D7）
    const R = DEVICE_BASE_RADIUS * scale;
    const offset = R * DEVICE_NORMAL_OFFSET_RATIO;
    const colors = isDark ? deviceStyles.dark : deviceStyles.light;
    // 描边统一半透明白（亮）/黑（暗），保证图标在彩色路径上可辨（SPEC §3.4）
    const strokeColor = isDark ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.85)";
    // 正向边沿法线 +n 侧、反向边沿 -n 侧（局部 y 轴即旋转后的法线方向）
    const iconSign = isBackEdge ? -1 : 1;

    context.save();
    // 1. 平移到锚点（路径标签点）
    context.translate(anchorX, anchorY);
    // 2. 绕锚点旋转到切线方向（图标朝向跟随路径，D10）
    context.rotate(angle);
    // 3. 沿局部 y 轴（法线方向）偏移到图标一侧（D5 双向错开）
    context.translate(0, iconSign * offset);
    context.lineJoin = "round";
    context.lineCap = "round";

    // 选中联动高亮（D19）：图标背后绘制一圈高亮环
    if (isSelected) {
        context.beginPath();
        context.arc(0, 0, R * 1.15, 0, Math.PI * 2);
        context.fillStyle = "rgba(255, 235, 59, 0.55)";
        context.fill();
    }

    switch (deviceType) {
        case "elevator":
            drawElevator(context, R, colors.elevator, strokeColor);
            break;
        case "autoDoor":
            drawAutoDoor(context, R, colors.autoDoor, strokeColor);
            break;
        case "airShowerDoor":
            drawAirShowerDoor(context, R, colors.airShowerDoor, strokeColor);
            break;
        case "trafficLight":
            drawTrafficLight(context, R, colors.trafficLight, strokeColor);
            break;
        default:
            drawUnknown(context, R, colors.unknown, strokeColor);
    }

    context.restore();
    // 收尾：与 nodeSceneFunc/edgeSceneFunc 保持一致，shape 未设 fill/stroke 时为 no-op
    context.fillStrokeShape(shape);
};

/**
 * 设备图标命中区域函数（listening=true 时启用点击/hover）
 *
 * 注意：设备图标的锚点偏移与朝向是在 sceneFunc 内部用 context.translate/rotate 完成的
 * （非 Shape 的 x/y/rotation 属性），因此 hitFunc 必须重复完全相同的变换，
 * 否则命中圆与图标实际位置会错位。
 *
 * 以图标中心为圆心、半径 R 的整圆作为命中范围，统一覆盖五种轮廓，
 * 保证点击图标任意位置（含内部细线条区域）都能命中。
 */
export const deviceIconHitFunc = (context: Context, shape: Konva.Shape) => {
    const {
        anchorX, anchorY, angle, isBackEdge, scale
    } = (shape.getAttrs()?.data || {}) as {
        anchorX: number;
        anchorY: number;
        angle: number;
        isBackEdge: boolean;
        scale: number;
    };
    const R = DEVICE_BASE_RADIUS * scale;
    const offset = R * DEVICE_NORMAL_OFFSET_RATIO;
    const iconSign = isBackEdge ? -1 : 1;
    context.save();
    // 与 sceneFunc 完全一致的变换，保证命中区域与图标实际位置/朝向对齐
    context.translate(anchorX, anchorY);
    context.rotate(angle);
    context.translate(0, iconSign * offset);
    context.beginPath();
    context.arc(0, 0, R, 0, Math.PI * 2);
    context.closePath();
    context.fillStrokeShape(shape);
    context.restore();
};
