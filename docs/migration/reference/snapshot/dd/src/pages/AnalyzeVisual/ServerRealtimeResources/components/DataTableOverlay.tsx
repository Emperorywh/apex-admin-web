/**
 * @description 实时数据表格浮层（复刻 server-monitor-dashboard.html 的表格视图）
 *
 * 当前快照的无障碍等价呈现：以表格形式列出 CPU / 内存 / JVM / 各磁盘分区。
 *   - 点击遮罩空白处或按 Escape 关闭；打开时焦点落到关闭按钮
 *   - 快照为 null（数据降级态）时表格为空，仅底部展示数据源状态
 */
import { useEffect, useRef } from "react";
import type { ServerResourceSnapshot } from "@/types/AnalyzeVisual/ServerResource";
import { useI18n } from "@/hooks/useI18n";
import { normRate, sevOf } from "../model/policy";

export interface DataTableOverlayProps {
    open: boolean;
    /** 当前快照；null 表示数据降级态（表格为空） */
    snapshot: ServerResourceSnapshot | null;
    /** 最近一次成功采集的时间戳；null 表示尚未成功过 */
    lastSuccessAt: number | null;
    /** 数据源说明文案（实时接口 / 连接失败，已国际化） */
    sourceText: string;
    onClose: () => void;
}

export function DataTableOverlay({ open, snapshot, lastSuccessAt, sourceText, onClose }: DataTableOverlayProps) {
    const { t, locale } = useI18n();
    const closeBtnRef = useRef<HTMLButtonElement>(null);

    // 打开时焦点落到关闭按钮（与复刻源的无障碍行为一致）
    useEffect(() => {
        if (open) closeBtnRef.current?.focus();
    }, [open]);

    // Escape 关闭
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    // 组装表格行：[指标, 当前值, 详情]
    const rows: Array<[string, string, string]> = [];
    if (snapshot) {
        const cpu = normRate(snapshot.systemCpuLoad);
        const mem = normRate(snapshot.systemMemoryUsageRate);
        const jvm = normRate(snapshot.jvmHeapUsageRate);
        rows.push([
            t("CPU 使用率"),
            cpu.toFixed(1) + " %",
            t("{cores} 逻辑核心 · 状态 {status}", {
                cores: snapshot.cpuCores ?? "—",
                status: t(sevOf(cpu).t),
            }),
        ]);
        rows.push([
            t("系统内存使用率"),
            mem.toFixed(1) + " %",
            t("总 {total} · 已用 {used} · 空闲 {free}", {
                total: snapshot.systemMemoryTotal ?? "—",
                used: snapshot.systemMemoryUsed ?? "—",
                free: snapshot.systemMemoryFree ?? "—",
            }),
        ]);
        rows.push([
            t("JVM 堆使用率"),
            jvm.toFixed(1) + " %",
            t("最大 {max} · 已用 {used} · 状态 {status}", {
                max: snapshot.jvmHeapMax ?? "—",
                used: snapshot.jvmHeapUsed ?? "—",
                status: t(sevOf(jvm).t),
            }),
        ]);
        for (const d of snapshot.disks ?? []) {
            rows.push([
                t("磁盘 {name}", { name: d.mountPath || d.device || "—" }),
                normRate(d.usageRate).toFixed(1) + " %",
                t("设备 {device} · 总 {total} · 已用 {used} · 空闲 {free}", {
                    device: d.device ?? "—",
                    total: d.total ?? "—",
                    used: d.used ?? "—",
                    free: d.free ?? "—",
                }),
            ]);
        }
    }

    return (
        <div
            className="sm-overlay"
            onClick={(e) => {
                // 仅点击遮罩空白处关闭，点击面板内部不关闭
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="sm-overlay-panel" role="dialog" aria-label={t("实时数据表格")}>
                <div className="sm-overlay-head">
                    <span>{t("实时数据表格")}</span>
                    <button className="sm-ghost-btn" ref={closeBtnRef} onClick={onClose}>
                        {t("关闭")} ✕
                    </button>
                </div>
                <div className="sm-overlay-body">
                    <table>
                        <thead>
                            <tr>
                                <th>{t("指标")}</th>
                                <th>{t("当前值")}</th>
                                <th>{t("详情")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(([a, b, c], i) => (
                                <tr key={i}>
                                    <td>{a}</td>
                                    <td>
                                        <span className="sm-num">{b}</span>
                                    </td>
                                    <td className="sm-dim">{c}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="sm-overlay-foot">
                    {lastSuccessAt
                        ? t("最近更新：{time} · 数据源：{source}", {
                              time: new Date(lastSuccessAt).toLocaleString(locale, { hour12: false }),
                              source: sourceText,
                          })
                        : "—"}
                </div>
            </div>
        </div>
    );
}
