/**
 * @description 进度条弹窗组件（支持伪进度和真实进度两种模式）
 * 通过 ref 暴露 start / stop / update 方法。
 *
 * 模式说明：
 * - 伪进度模式：调用 start() 后自动模拟进度，适用于无法获取真实进度的场景
 * - 真实进度模式：调用 update() 后自动切换，清除伪进度定时器并显示真实百分比
 *
 * 用法：
 *   const progressRef = useRef<FakeProgressModalRef>(null);
 *   <FakeProgressModal ref={progressRef} title="正在下载" />
 *   progressRef.current.start();                          // 开始伪进度
 *   progressRef.current.update(50, "已下载 2.3 GB / 5 GB"); // 切换到真实进度
 *   progressRef.current.stop(true);                       // 成功
 *   progressRef.current.stop(false);                      // 失败
 */
import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { Progress, Modal } from "antd";
import { useI18n } from "@/hooks/useI18n";

/** ref 暴露的方法 */
export interface FakeProgressModalRef {
    /** 开始伪进度条 */
    start: () => void;
    /** 停止进度条，success=true 跳到100%，否则重置 */
    stop: (success: boolean) => void;
    /**
     * 切换到真实进度模式，清除伪进度定时器
     * @param percent 当前进度百分比（0-100），传 -1 表示未知总大小
     * @param sizeText 附加文字，如 "已下载 2.3 GB / 5.0 GB"
     */
    update: (percent: number, sizeText?: string) => void;
}

interface FakeProgressModalProps {
    /** 弹窗标题 */
    title?: string;
    /** 进行中的提示文字 */
    loadingText?: string;
    /** 完成后的提示文字 */
    successText?: string;
}

const FakeProgressModal = forwardRef<FakeProgressModalRef, FakeProgressModalProps>(
    (
        props,
        ref,
    ) => {
        const { t } = useI18n();

        const {
            title = t("正在下载"),
            loadingText = t("下载中，请勿关闭页面..."),
            successText = t("下载完成！"),
        } = props;

        /* 是否正在下载 */
        const [open, setOpen] = useState(false);
        /* 当前进度百分比 */
        const [percent, setPercent] = useState(0);
        /* 附加文字（如已下载大小） */
        const [subText, setSubText] = useState<string>("");
        /* 定时器引用 */
        const timerRef = useRef<ReturnType<typeof setInterval>>();

        /* 组件卸载时清除定时器，防止内存泄漏 */
        useEffect(() => {
            return () => {
                if (timerRef.current) clearInterval(timerRef.current);
            };
        }, []);

        /**
         * 开始伪进度条
         * 第一阶段（0% → 50%）：固定增量，快速增长（约 10 秒）
         * 第二阶段（50% → 90%）：速度线性递减至接近 0（约 50 秒）
         * 到达 90% 后近乎停滞，等待接口返回后跳到 100%
         */
        const start = useCallback(() => {
            setPercent(0);
            setOpen(true);
            const INTERVAL = 300;                                       // 更新间隔（ms）
            const PHASE1_TARGET = 50;                                   // 第一阶段目标：50%
            const PHASE2_CEILING = 90;                                  // 第二阶段上限：90%
            /* 第一阶段：10 秒到达 50%，每步增量 ≈ 1.5 */
            const PHASE1_INCREMENT = PHASE1_TARGET / (10000 / INTERVAL);
            /* 第二阶段：50 秒从 50% 到 90%，共约 167 步 */
            const PHASE2_STEPS = Math.round(50000 / INTERVAL);
            /* 速度从 v0 线性递减至 0，总进度 = v0 × STEPS / 2 = 40 → v0 ≈ 0.48 */
            const PHASE2_V0 =
                (2 * (PHASE2_CEILING - PHASE1_TARGET)) / PHASE2_STEPS;
            const PHASE2_DECAY = PHASE2_V0 / PHASE2_STEPS;
            const MIN_SPEED = 0.02;
            let current = 0;
            let speed = PHASE2_V0;

            timerRef.current = setInterval(() => {
                if (current < PHASE1_TARGET) {
                    /* 第一阶段：快速推进至 50% */
                    current = Math.min(current + PHASE1_INCREMENT, PHASE1_TARGET);
                } else if (current < PHASE2_CEILING) {
                    /* 第二阶段：速度线性递减，逐步趋近 90% */
                    current = Math.min(current + speed, PHASE2_CEILING);
                    speed = Math.max(MIN_SPEED, speed - PHASE2_DECAY);
                }
                setPercent(Math.round(current));
            }, INTERVAL);
        }, []);

        /**
         * 停止进度条
         * @param success 是否成功，成功时进度跳到100%，失败时重置为0
         */
        const stop = useCallback((success: boolean) => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = undefined;
            }
            if (success) {
                setPercent(100);
                setSubText("");
                setTimeout(() => setOpen(false), 600);
            } else {
                setOpen(false);
                setPercent(0);
                setSubText("");
            }
        }, []);

        /**
         * 切换到真实进度模式
         * 清除伪进度定时器，直接使用传入的百分比和附加文字
         */
        const update = useCallback((pct: number, sizeText?: string) => {
            /* 清除伪进度定时器 */
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = undefined;
            }
            if (pct >= 0) {
                setPercent(Math.min(99, Math.max(0, Math.round(pct))));
            }
            if (sizeText !== undefined) {
                setSubText(sizeText);
            }
        }, []);

        /* 通过 ref 暴露 start / stop / update 方法 */
        useImperativeHandle(ref, () => ({ start, stop, update }), [start, stop, update]);

        return (
            <Modal
                title={title}
                open={open}
                footer={null}
                closable={false}
                maskClosable={false}
                centered
            >
                <div style={{ padding: "20px 0" }}>
                    <Progress
                        percent={percent}
                        status={percent < 100 ? "active" : "success"}
                        strokeColor={{ from: "#108ee9", to: "#87d068" }}
                    />
                    <p style={{ textAlign: "center", marginTop: 12, color: "#999" }}>
                        {percent < 100 ? loadingText : successText}
                    </p>
                    {/* 真实进度模式下显示已下载大小等信息 */}
                    {subText && percent < 100 && (
                        <p style={{ textAlign: "center", marginTop: 4, color: "#bbb", fontSize: 12 }}>
                            {subText}
                        </p>
                    )}
                </div>
            </Modal>
        );
    },
);

export default FakeProgressModal;
