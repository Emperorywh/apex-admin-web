/**
 * @description 磁盘分区列表（复刻 server-monitor-dashboard.html 的 renderDisks）
 *
 *   - 每行：严重程度状态点 + 挂载路径/设备名 + 使用率 + 渐变进度条 + 用量明细
 *   - 进度条宽度带 CSS transition，轮询更新时平滑变化（按挂载路径作 key 稳定复用行）
 *   - 行悬停时通过 onTip 上抛悬浮提示（使用率 / 已用·总量 / 空闲）
 *   - disks 为 null（数据降级态）或无分区时展示空态文案
 */
import type { MouseEvent } from "react";
import type { DiskInfo } from "@/types/AnalyzeVisual/ServerResource";
import { useI18n } from "@/hooks/useI18n";
import type { TipRow } from "../model/policy";
import { hexA, normRate, sevOf } from "../model/policy";

export interface DiskListProps {
    /** 磁盘分区列表；null 表示无数据（降级态） */
    disks: DiskInfo[] | null;
    onTip: (x: number, y: number, title: string, rows: TipRow[]) => void;
    onTipHide: () => void;
}

export function DiskList({ disks, onTip, onTipHide }: DiskListProps) {
    const { t } = useI18n();

    if (!disks || disks.length === 0) {
        return (
            <div className="sm-disk-list">
                <div className="sm-disk-empty">{t("暂无磁盘数据")}</div>
            </div>
        );
    }

    return (
        <div className="sm-disk-list">
            {disks.map((d, idx) => {
                const rate = normRate(d.usageRate);
                const sev = sevOf(rate);
                const title = `${d.device ?? ""}  ${d.mountPath ?? ""}`.trim() || t("磁盘分区");
                const handleMove = (e: MouseEvent) =>
                    onTip(e.clientX, e.clientY, title, [
                        { color: sev.c, name: t("使用率"), value: rate.toFixed(1) + " %" },
                        { color: "#3987e5", name: t("已用 / 总量"), value: `${d.used ?? "—"} / ${d.total ?? "—"}` },
                        { color: "#199e70", name: t("空闲"), value: d.free ?? "—" },
                    ]);
                return (
                    <div
                        className="sm-disk-row"
                        key={d.mountPath || d.device || idx}
                        onMouseMove={handleMove}
                        onMouseLeave={onTipHide}
                    >
                        <div className="sm-dr-top">
                            <span className="sm-dr-dot" style={{ background: sev.dot, boxShadow: `0 0 6px ${sev.dot}` }} />
                            <span className="sm-dr-name">{d.mountPath || d.device || "—"}</span>
                            {/* 设备名与挂载路径相同时不重复展示 */}
                            <span className="sm-dr-dev">
                                {d.device && d.device !== d.mountPath ? d.device : ""}
                            </span>
                            <span className="sm-dr-pct sm-num">{rate.toFixed(1)} %</span>
                        </div>
                        <div className="sm-dr-bar">
                            <div
                                className="sm-dr-fill"
                                style={{
                                    width: `${rate}%`,
                                    background: `linear-gradient(90deg, ${hexA(sev.c, 0.8)}, ${sev.c})`,
                                    boxShadow: `0 0 8px ${hexA(sev.c, 0.5)}`,
                                }}
                            />
                        </div>
                        <div className="sm-dr-sub">
                            {t("已用 {used} / 共 {total} · 空闲 {free}", {
                                used: d.used ?? "—",
                                total: d.total ?? "—",
                                free: d.free ?? "—",
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
