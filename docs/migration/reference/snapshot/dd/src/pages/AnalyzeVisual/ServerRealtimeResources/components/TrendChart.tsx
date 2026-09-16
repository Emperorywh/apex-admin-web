/**
 * @description 资源使用趋势图（复刻 server-monitor-dashboard.html 的 Canvas 趋势图）
 *
 *   - Canvas 手绘：Y 轴 0/25/50/75/100% 网格、三条序列（面积洗色 + 发光折线 + 端点圆点）
 *   - 窗口右对齐：不足 MAX_HIST 个点时从右侧开始填充；X 轴时间标签按像素间距自适应数量
 *   - ResizeObserver 跟踪容器尺寸并按 devicePixelRatio 缩放，保证高分屏清晰
 *   - canvas 绝对定位脱离文档流，避免「容器量 canvas、canvas 撑容器」的尺寸反馈循环
 *   - 悬停显示十字线与三序列圆点，悬浮提示内容通过 onTip 回调上抛给页面级 tooltip 渲染
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { SeriesKey, TipRow, TrendPoint } from "../model/policy";
import { MAX_HIST, hexA, pad2 } from "../model/policy";

/** 单条趋势序列的展示定义（颜色固定，名称由页面按语言注入） */
export interface TrendSeries {
    key: SeriesKey;
    name: string;
    color: string;
}

export interface TrendChartProps {
    /** 历史采样点（最多 MAX_HIST 个，新点追加在末尾） */
    points: TrendPoint[];
    series: TrendSeries[];
    /** 数据不足两点时的占位文案（已国际化） */
    collectingText: string;
    /** 悬停时上抛提示内容与鼠标视口坐标 */
    onTip: (x: number, y: number, title: string, rows: TipRow[]) => void;
    onTipHide: () => void;
}

/* 图表内边距与 canvas 偏移（与复刻源一致） */
const PAD = { l: 36, r: 14, t: 12, b: 24 };
const CV_LEFT = 6;
const CV_TOP = 2;

export function TrendChart({ points, series, collectingText, onTip, onTipHide }: TrendChartProps) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // 容器内容尺寸（CSS 像素），由 ResizeObserver 写入
    const [size, setSize] = useState({ w: 0, h: 0 });
    // 当前悬停的采样点下标；null 表示未悬停
    const [hover, setHover] = useState<number | null>(null);

    /*
     * 事件回调与绘制函数通过 ref 读最新 props，
     * 避免每次轮询都重绑 canvas 事件监听
     */
    const pointsRef = useRef(points);
    pointsRef.current = points;
    const seriesRef = useRef(series);
    seriesRef.current = series;
    const collectingTextRef = useRef(collectingText);
    collectingTextRef.current = collectingText;
    const onTipRef = useRef(onTip);
    onTipRef.current = onTip;
    const onTipHideRef = useRef(onTipHide);
    onTipHideRef.current = onTipHide;
    const hoverRef = useRef(hover);
    hoverRef.current = hover;

    /** 完整重绘（读 ref 中的最新数据；size 由参数传入以便 RO 回调直接调用） */
    const draw = useCallback((w: number, h: number) => {
        const cv = canvasRef.current;
        const ctx = cv?.getContext("2d");
        if (!cv || !ctx || w < 10 || h < 10) return;
        const pts = pointsRef.current;
        const srs = seriesRef.current;
        const hv = hoverRef.current;

        ctx.clearRect(0, 0, w, h);
        const pw = w - PAD.l - PAD.r;
        const ph = h - PAD.t - PAD.b;
        const yAt = (v: number) => PAD.t + ph * (1 - Math.min(100, Math.max(0, v)) / 100);

        // Y 轴网格线（内凹细实线）+ 百分比标签
        ctx.font = "10px Bahnschrift, sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        for (const v of [0, 25, 50, 75, 100]) {
            const y = yAt(v);
            ctx.strokeStyle = "rgba(140,170,220,.12)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(PAD.l, y);
            ctx.lineTo(PAD.l + pw, y);
            ctx.stroke();
            ctx.fillStyle = "#66779c";
            ctx.fillText(v + "%", PAD.l - 6, y);
        }

        const n = pts.length;
        if (n < 2) {
            ctx.fillStyle = "#66779c";
            ctx.textAlign = "center";
            ctx.fillText(collectingTextRef.current, PAD.l + pw / 2, PAD.t + ph / 2);
            return;
        }
        // 窗口右对齐：不足 MAX_HIST 个点时从右侧开始填充
        const xAt = (i: number) => PAD.l + (pw * (MAX_HIST - n + i)) / (MAX_HIST - 1);

        // X 轴时间标签：按像素间距自适应数量，数据点少、挤在右侧时不重叠
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const span = xAt(n - 1) - xAt(0);
        let cnt = Math.min(5, n);
        while (cnt > 1 && span / (cnt - 1) < 70) cnt--;
        const idxs =
            cnt === 1 ? [n - 1] : Array.from({ length: cnt }, (_, k) => Math.round((k * (n - 1)) / (cnt - 1)));
        for (const i of idxs) {
            const d = new Date(pts[i].t);
            const lx = Math.max(PAD.l + 26, Math.min(PAD.l + pw - 26, xAt(i)));
            ctx.fillStyle = "#66779c";
            ctx.fillText(`${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`, lx, PAD.t + ph + 7);
        }

        // 三条序列：10% 面积洗色 + 2px 发光线 + 端点圆点（带 2px 底色环）
        for (const s of srs) {
            const grad = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + ph);
            grad.addColorStop(0, hexA(s.color, 0.14));
            grad.addColorStop(1, hexA(s.color, 0));
            ctx.beginPath();
            pts.forEach((p, i) => {
                const x = xAt(i);
                const y = yAt(p[s.key]);
                if (i) ctx.lineTo(x, y);
                else ctx.moveTo(x, y);
            });
            ctx.lineTo(xAt(n - 1), PAD.t + ph);
            ctx.lineTo(xAt(0), PAD.t + ph);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.beginPath();
            pts.forEach((p, i) => {
                const x = xAt(i);
                const y = yAt(p[s.key]);
                if (i) ctx.lineTo(x, y);
                else ctx.moveTo(x, y);
            });
            ctx.strokeStyle = s.color;
            ctx.lineWidth = 2;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.shadowColor = s.color;
            ctx.shadowBlur = 6;
            ctx.stroke();
            ctx.shadowBlur = 0;

            const ex = xAt(n - 1);
            const ey = yAt(pts[n - 1][s.key]);
            ctx.beginPath();
            ctx.arc(ex, ey, 4, 0, 7);
            ctx.fillStyle = s.color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#0a1830";
            ctx.stroke();
        }

        // 悬停十字线 + 三序列圆点
        if (hv != null && hv < n) {
            const x = xAt(hv);
            ctx.strokeStyle = "rgba(220,235,255,.35)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, PAD.t);
            ctx.lineTo(x, PAD.t + ph);
            ctx.stroke();
            for (const s of srs) {
                const y = yAt(pts[hv][s.key]);
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, 7);
                ctx.fillStyle = s.color;
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = "#0a1830";
                ctx.stroke();
            }
        }
    }, []);

    // 数据 / 尺寸 / 悬停变化时重绘
    useEffect(() => {
        draw(size.w, size.h);
    }, [points, series, collectingText, size, hover, draw]);

    // 挂载时测量一次并监听容器尺寸变化；按 DPR 设置画布物理分辨率
    useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const applySize = () => {
            const box = wrap.getBoundingClientRect();
            const cw = box.width - CV_LEFT * 2;
            const ch = box.height - CV_TOP;
            if (cw < 10 || ch < 10) return;
            const dpr = window.devicePixelRatio || 1;
            const cv = canvasRef.current;
            if (cv) {
                cv.width = Math.round(cw * dpr);
                cv.height = Math.round(ch * dpr);
                cv.style.width = cw + "px";
                cv.style.height = ch + "px";
                cv.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
            setSize({ w: cw, h: ch });
        };
        applySize();
        const ro = new ResizeObserver(applySize);
        ro.observe(wrap);
        return () => ro.disconnect();
    }, []);

    // 悬停交互：命中最近采样点，重绘十字线并上抛悬浮提示
    useEffect(() => {
        const cv = canvasRef.current;
        if (!cv) return;
        const onMove = (e: MouseEvent) => {
            const pts = pointsRef.current;
            const n = pts.length;
            if (n < 2) return;
            const rect = cv.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const pw = rect.width - PAD.l - PAD.r;
            let i = Math.round(((mx - PAD.l) / pw) * (MAX_HIST - 1)) - (MAX_HIST - n);
            i = Math.max(0, Math.min(n - 1, i));
            setHover(i);
            const d = new Date(pts[i].t);
            onTipRef.current(
                e.clientX,
                e.clientY,
                `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`,
                seriesRef.current.map((s) => ({
                    color: s.color,
                    name: s.name,
                    value: pts[i][s.key].toFixed(1) + " %",
                })),
            );
        };
        const onLeave = () => {
            setHover(null);
            onTipHideRef.current();
        };
        cv.addEventListener("mousemove", onMove);
        cv.addEventListener("mouseleave", onLeave);
        return () => {
            cv.removeEventListener("mousemove", onMove);
            cv.removeEventListener("mouseleave", onLeave);
        };
    }, []);

    return (
        <div className="sm-trend-body" ref={wrapRef}>
            <canvas ref={canvasRef} />
        </div>
    );
}
