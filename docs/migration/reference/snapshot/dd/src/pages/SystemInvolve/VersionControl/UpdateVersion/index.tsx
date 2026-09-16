/**
 * @description 更新版本包（仅上传版本包到待升级列表，不自动重启；真实上传进度）
 * @date 2025-11-4
 *
 * 合并说明：v2_dev 将本页改为「仅上传版本包 + onSuccess 刷新列表 + 权限/国际化」，
 * v1_dev 将本页改为「基于 XMLHttpRequest 的真实上传进度（百分比/速度/ETA/取消/停滞检测）」。
 * 二者正交，此处融合：业务语义取 v2_dev（仅上传、不重启、不跳登录），上传通道取 v1_dev
 * （uploadWithProgress），重启仍由版本列表页独立按钮负责，功能项无丢失。
 *
 * v2.0.0 合并增量：ETA 单位文案接入国际化（t("{n} 秒")），随语言切换；
 * 上传成功后延迟 800ms 关闭弹窗，让用户看到「上传完成」绿条再关闭，体验更顺滑。
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Button, Upload, message, Modal, Progress } from "antd";
import type { UploadProps } from "antd";
import { CloudUploadOutlined } from "@ant-design/icons";
import { UPLOADSYSTEMVERSION_URL } from "@/api";
import { uploadWithProgress } from "@/api/uploadWithProgress";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

/**
 * 组件属性类型定义
 * onSuccess：更新成功后的回调，由父组件传入，用于刷新版本列表等后续操作
 */
interface UpdateVersionProps {
    onSuccess?: () => void;
}

/** 字节转 MB 字符串（保留两位） */
const fmtMB = (bytes: number) => {
    if (!bytes || bytes <= 0) return "0 MB";
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

/**
 * 上传阶段状态机：
 * - uploading          上传字节中（含连接建立阶段）
 * - awaiting-response  请求体发完、等待服务器处理（停用停滞检测，仅可被取消/网络/HTTP 错终止）
 * - success            拿到成功响应，准备关闭弹窗并刷新版本列表
 */
type Phase = "uploading" | "awaiting-response" | "success";

export default ({ onSuccess }: UpdateVersionProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();
    /*
     * 按钮级权限判定
     * 无权限的动作触发型按钮条件渲染隐藏（root 短路全开）
     * 详见 docs/SPEC_button_permission.md §7
     */
    const { hasPerm } = useAccess();

    /** ETA 秒转可读（秒/分），无效则显示 --；单位文案需随语言切换，故置于组件内 */
    const fmtETA = (sec: number) => {
        if (!isFinite(sec) || sec <= 0) return "--";
        if (sec < 60) return t("{n} 秒", { n: Math.ceil(sec) });
        return t("{n} 分", { n: Math.ceil(sec / 60) });
    };

    const [uploading, setUploading] = useState(false);
    // 上传阶段（控制文案与取消按钮可见性）
    const [phase, setPhase] = useState<Phase>("uploading");
    // 进度数值（来自 xhr.upload.onprogress）
    const [loaded, setLoaded] = useState(0);
    const [total, setTotal] = useState(0);
    const [lengthComputable, setLengthComputable] = useState(true);
    // 速度（MB/s）与 ETA（秒），由调用方基于采样序列计算
    const [speed, setSpeed] = useState(0);
    const [eta, setEta] = useState(0);
    // 取消用控制器
    const abortControllerRef = useRef<AbortController | null>(null);
    // 速度采样序列（仅保留最近 3 秒，平滑抖动）
    const samplesRef = useRef<{ loaded: number; ts: number }[]>([]);

    // beforeunload：仅上传中拦截关闭/刷新；响应回来 setUploading(false) 即解除
    useEffect(() => {
        if (!uploading) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = ""; // 触发浏览器原生提示
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [uploading]);

    /** 重置上传相关状态（每次开始上传前调用） */
    const resetState = useCallback(() => {
        setPhase("uploading");
        setLoaded(0);
        setTotal(0);
        setLengthComputable(true);
        setSpeed(0);
        setEta(0);
        samplesRef.current = [];
        abortControllerRef.current = null;
    }, []);

    /**
     * 基于采样序列计算速度与 ETA（3 秒滑动窗口）。
     * 仅在 lengthComputable=true 时计算 ETA（否则 total 不可信）。
     * 节流已在工具层做 100ms，此处无需再节流。
     */
    const calcSpeedAndETA = useCallback(
        (curLoaded: number, curTotal: number, curLengthComputable: boolean) => {
            const now = Date.now();
            const samples = samplesRef.current;
            samples.push({ loaded: curLoaded, ts: now });
            // 滑动窗口：丢弃 3 秒之前的样本
            const windowMs = 3000;
            const cutoff = now - windowMs;
            while (samples.length > 1 && samples[0].ts < cutoff) {
                samples.shift();
            }
            if (samples.length >= 2 && curLengthComputable) {
                const first = samples[0];
                const dt = (now - first.ts) / 1000;
                if (dt > 0) {
                    const bytesPerSec = (curLoaded - first.loaded) / dt;
                    setSpeed(bytesPerSec / 1024 / 1024);
                    // 速度 <=0 时不显示有效 ETA（fmtETA 会输出 --）
                    setEta(bytesPerSec > 0 ? (curTotal - curLoaded) / bytesPerSec : 0);
                }
            }
        },
        []
    );

    /*
     * 上传版本包：仅上传版本包到「待升级」列表，不自动重启系统。
     * 真实进度走 uploadWithProgress（XHR），不走 umi request（fetch 无法提供上传进度）。
     * 鉴权头与业务码路由由 uploadWithProgress 内部复刻拦截器处理（见 httpShared）。
     */
    const beforeUpload: UploadProps["beforeUpload"] = (file) => {
        // 限制仅允许上传 .zip 文件（accept 仅过滤选择器，此处再做一次扩展名校验）
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith(".zip")) {
            message.warning(t("仅支持上传 .zip 格式的版本包"));
            return false;
        }
        const formData = new FormData();
        formData.append("file", file);

        // 顺序很重要：resetState() 内部会把 abortControllerRef.current 置 null，
        // 故必须先 reset 再创建并赋值新 controller，否则 handleCancel 取到的是 null，
        // ?.abort() 直接短路、根本不会中止请求（表现为取消按钮无效）
        resetState();
        setUploading(true);

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        uploadWithProgress(UPLOADSYSTEMVERSION_URL, formData, {
            signal: abortController.signal,
            stallTimeoutMs: 60000,
            onProgress: ({ loaded: l, total: tt, lengthComputable: lc }) => {
                setLoaded(l);
                setTotal(tt);
                setLengthComputable(lc);
                calcSpeedAndETA(l, tt, lc);
                // 字节发完即切到「等待响应」阶段（工具层在 upload.onload 时会 flush
                // 最后一次进度并停用停滞检测）。lengthComputable=false 时 loaded
                // 可能到不了 total，此处不切 phase、走马灯保持到 success——可接受
                if (lc && tt > 0 && l >= tt) {
                    setPhase("awaiting-response");
                }
            }
        }).then(res => {
            // 严格判定：code===200 且 message==='success' 才算成功
            if (res.code === 200 && res.message === "success") {
                setPhase("success");
                message.success(t("更新版本包成功"));
                // 仅上传不重启：更新成功后通知父组件刷新版本列表
                onSuccess?.();
                // 短暂展示「上传完成」绿条后关闭弹窗，体验更顺滑
                setTimeout(() => setUploading(false), 800);
            } else {
                setUploading(false);
                message.warning(t("更新版本包出错") + res?.message);
            }
        }).catch(err => {
            setUploading(false);
            // 区分原因给不同文案（reason 由 uploadWithProgress 结构化 reject 提供）
            switch (err?.reason) {
                case "ABORTED":
                    message.info(t("已取消上传"));
                    break;
                case "STALL":
                    // phase 区分连接超时 / 上传停滞
                    if (err?.phase === "connecting") {
                        message.error(t("连接服务器超时，请检查网络/服务后重试"));
                    } else {
                        message.error(t("上传长时间无进展，已中止，请重试"));
                    }
                    break;
                case "NETWORK":
                    message.error(t("网络错误，请检查后重试"));
                    break;
                case "PARSE_FAIL":
                case "HTTP_ERROR":
                    message.error(`${t("更新版本包出错")}（HTTP ${err?.status}）：${err?.snippet || ""}`);
                    break;
                default:
                    message.error(t("更新版本包出错") + (err?.message || ""));
            }
        });
        return false;
    };

    /** 取消上传：二次确认后中止 */
    const handleCancel = () => {
        Modal.confirm({
            title: t("确认取消上传？"),
            content: t("已上传的部分将被丢弃，需要重新选择文件上传。"),
            okText: t("取消上传"),
            okButtonProps: { danger: true },
            cancelText: t("继续上传"),
            onOk: () => abortControllerRef.current?.abort()
        });
    };

    const props: UploadProps = {
        accept: ".zip",
        name: "file",
        showUploadList: false,
        beforeUpload: beforeUpload
    };

    // 百分比由真实字节派生（lengthComputable=false 时不用，走 indeterminate）
    const percent =
        lengthComputable && total > 0
            ? Math.min(100, Math.floor((loaded / total) * 100))
            : 0;

    return (
        <>
            {/* 更新版本包：无 system:version:upload 权限条件渲染隐藏（§7.1） */}
            {hasPerm(PERM_BUTTON.SYSTEM_VERSION_UPLOAD) && (
                <Upload {...props}>
                    <Button
                        type="primary"
                        icon={<CloudUploadOutlined />}
                        loading={uploading}
                    >
                        {t("更新版本包")}
                    </Button>
                </Upload>
            )}
            <Modal
                title={t("正在上传版本包")}
                open={uploading}
                /* success 阶段请求已完成，不再显示取消按钮；
                   awaiting-response 阶段保留取消入口（用户可主动放弃等待） */
                footer={
                    phase !== "success" ? (
                        <Button danger onClick={handleCancel}>{t("取消上传")}</Button>
                    ) : null
                }
                closable={false}
                maskClosable={false}
                centered
            >
                <div style={{ padding: "20px 0" }}>
                    {lengthComputable ? (
                        <Progress
                            percent={percent}
                            status={phase === "success" ? "success" : "active"}
                            strokeColor={{ from: "#108ee9", to: "#87d068" }}
                        />
                    ) : (
                        /* lengthComputable=false 降级：走马灯（antd v5 无原生 indeterminate，
                           用 percent=99 + active 模拟），不显示百分比与 ETA */
                        <Progress
                            percent={99}
                            status="active"
                            strokeColor={{ from: "#108ee9", to: "#87d068" }}
                        />
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, color: "#666", fontSize: 12 }}>
                        <span>
                            {lengthComputable
                                ? `${fmtMB(loaded)} / ${fmtMB(total)}`
                                : `${t("已上传")} ${fmtMB(loaded)}`}
                        </span>
                        <span>
                            {lengthComputable && speed > 0
                                ? `${speed.toFixed(2)} MB/s · ${t("剩余")} ${fmtETA(eta)}`
                                : ""}
                        </span>
                    </div>
                    <p style={{ textAlign: "center", marginTop: 12, color: "#999" }}>
                        {phase === "success"
                            ? t("上传完成")
                            : phase === "awaiting-response"
                                ? t("上传完成，等待服务器处理版本包，请勿关闭页面...")
                                : t("版本包上传中，请勿关闭页面...")}
                    </p>
                </div>
            </Modal>
        </>
    );
};
