/**
 * @description 带进度条弹窗的地图上传按钮组件
 * 封装了上传状态管理、伪进度条、进度弹窗等逻辑
 * @date 2026-6-1
 */
import { useI18n } from "@/hooks/useI18n";
import { Button, Modal, Progress, Upload, message } from "antd";
import type { UploadRequestOption } from "rc-upload/lib/interface";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * UploadMapButton 组件的 Props 接口
 * @property uploadFn 上传 API 函数，接收 File 并返回 Promise
 * @property buttonText 按钮显示文字
 * @property modalTitle 进度弹窗标题
 * @property progressText 进度中显示的提示文字
 * @property successText 上传成功后的提示文字
 * @property errorText 上传失败时的错误提示前缀
 * @property icon 按钮图标
 * @property buttonType 按钮类型，默认 "primary"
 * @property onSuccess 上传成功后的回调函数
 * @property accept 限制上传的文件类型（MIME 类型或扩展名），如 ".zip"、".bin"
 */
interface UploadMapButtonProps {
  uploadFn: (file: File) => Promise<any>;
  buttonText: string;
  modalTitle: string;
  progressText: string;
  successText: string;
  errorText: string;
  icon?: React.ReactNode;
  buttonType?: "primary" | "default";
  onSuccess?: () => void;
  accept?: string;
}

export default ({
  uploadFn,
  buttonText,
  modalTitle,
  progressText,
  successText,
  errorText,
  icon,
  buttonType = "primary",
  onSuccess,
  accept,
}: UploadMapButtonProps) => {
  /* 国际化翻译方法 */ const { t } = useI18n();

  /* 上传中状态 */
  const [uploading, setUploading] = useState(false);
  /* 伪进度条百分比 */
  const [percent, setPercent] = useState(0);
  /* 伪进度条定时器引用 */
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  /* 组件卸载时清理定时器 */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  /**
   * 启动伪进度条
   * 前 50% 每 300ms 增加 5%，50%-80% 每 300ms 增加 2%，80% 后每 300ms 增加 0.5%，最高到 90%
   */
  const startFakeProgress = useCallback(() => {
    setPercent(0);
    let current = 0;
    timerRef.current = setInterval(() => {
      const increment = current < 50 ? 5 : current < 80 ? 2 : 0.5;
      current = Math.min(current + increment, 90);
      setPercent(Math.round(current));
    }, 300);
  }, []);

  /**
   * 停止伪进度条
   * 成功时进度跳到 100%，600ms 后关闭弹窗
   * 失败时直接关闭弹窗并重置进度
   */
  const stopFakeProgress = useCallback((success: boolean) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    if (success) {
      setPercent(100);
      setTimeout(() => setUploading(false), 600);
    } else {
      setUploading(false);
      setPercent(0);
    }
  }, []);

  /**
   * 自定义上传处理函数
   * 触发上传 API 并根据结果显示提示信息
   */
  const handleUpload = (option: UploadRequestOption) => {
    const { file } = option;
    setUploading(true);
    startFakeProgress();
    uploadFn(file as File)
      .then((res) => {
        if (res.code === 200 && res.message === "success") {
          stopFakeProgress(true);
          onSuccess?.();
          message.success(successText);
        } else {
          stopFakeProgress(false);
          message.warning(errorText + res?.message);
        }
      })
      .catch((err) => {
        stopFakeProgress(false);
        if (err) {
          message.error(errorText + err?.message);
        }
      });
  };

  return (
    <>
      <Upload
        name="file"
        customRequest={handleUpload}
        showUploadList={false}
        accept={accept}
      >
        <Button type={buttonType} icon={icon} loading={uploading}>
          {buttonText}
        </Button>
      </Upload>
      <Modal
        title={modalTitle}
        open={uploading}
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
            {percent < 100 ? progressText : t("导入完成...")}
          </p>
        </div>
      </Modal>
    </>
  );
};
