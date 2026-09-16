/**
 * @description 硬件授权页面
 * 深蓝科技风（与服务器资源监控大屏同色板），硬件码支持一键复制
 * @date 2025-9-25
 */
import { getHardwareInfo, softwareActivation } from "@/api";
import { useI18n } from "@/hooks/useI18n";
import { CopyOutlined, KeyOutlined } from "@ant-design/icons";
import { history } from "@umijs/max";
import { Button, ConfigProvider, Input, message, theme } from "antd";
import { useEffect, useState } from "react";
import styles from "./index.less";

const { TextArea } = Input;

/*
 * 复制文本到剪贴板
 * 系统常部署在 http 内网环境，navigator.clipboard 仅在安全上下文可用，
 * 因此需要 execCommand 兜底方案保证复制功能始终可用
 */
const copyText = (text: string): boolean => {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  return ok;
};

export default () => {
  const { t } = useI18n();

  // 硬件ID
  const [hardwareId, setHardwareId] = useState<string>("");
  // 激活码
  const [activationCode, setActivationCode] = useState<string>("");
  // 激活请求中状态，防止重复提交
  const [activating, setActivating] = useState<boolean>(false);

  const handleAuthClick = () => {
    if (!activationCode) return;
    setActivating(true);
    softwareActivation({ activationCode })
      .then((res) => {
        if (res.code === 200 && res.message === "success") {
          history.push({
            pathname: "/over-look",
          });
        } else {
          setActivating(false);
          message.warning(res?.message);
        }
      })
      .catch((err) => {
        setActivating(false);
        if (err) {
          message.error(t("激活出错") + err?.message);
        }
      });
  };

  // 复制硬件码，便于用户发送给管理员换取激活码
  const handleCopyHardwareId = () => {
    if (!hardwareId) return;
    if (copyText(hardwareId)) {
      message.success(t("复制成功"));
    }
  };

  useEffect(() => {
    getHardwareInfo()
      .then((res) => {
        if (res.code === 200 && res.message === "success") {
          setHardwareId(res?.data || "");
        } else {
          message.warning(t("查询硬件信息出错") + res?.message);
        }
      })
      .catch((err) => {
        if (err) {
          message.error(t("查询硬件信息出错") + err?.message);
        }
      });
  }, []);

  return (
    <div className={styles.auth}>
      {/* 装饰性背景水印，纯展示 */}
      <div className={styles.watermark}>LICENSE</div>
      {/*
       * 深色主题：页面为 layout:false 独立全屏页，
       * 局部使用 darkAlgorithm 让输入框/按钮融入深色卡片，
       * colorPrimary 覆盖为琥珀色，统一聚焦态描边
       */}
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: "#35c8ff",
            colorInfo: "#35c8ff",
            borderRadius: 2,
          },
        }}
      >
        <div className={styles.card}>
          <div className={styles.emblem}>
            <KeyOutlined />
          </div>
          {/* 标题行：两侧翼形装饰线 + 辉光标题 + 英文小标题（大屏头部语言的微缩版） */}
          <div className={styles.title_row}>
            <span className={styles.wing + " " + styles.wing_left} />
            <h2 className={styles.title}>{t("软件授权")}</h2>
            <span className={styles.wing + " " + styles.wing_right} />
          </div>
          <p className={styles.title_en}>SOFTWARE LICENSE ACTIVATION</p>
          <p className={styles.subtitle}>
            {t("系统尚未激活，请将硬件码提供给管理员以获取激活码")}
          </p>

          <div className={styles.field_label}>
            <span>{t("硬件码")}</span>
            <span className={styles.copy_btn} onClick={handleCopyHardwareId}>
              <CopyOutlined style={{ marginRight: 4 }} />
              {t("复制")}
            </span>
          </div>
          <div className={styles.hardware_id}>{hardwareId || "—"}</div>

          <TextArea
            showCount
            allowClear
            placeholder={t("请输入激活码")}
            value={activationCode}
            autoSize={{ minRows: 4, maxRows: 8 }}
            onChange={(e) => setActivationCode(e.target.value)}
          />

          <div className={styles.actions}>
            <Button
              className={styles.back_btn}
              onClick={() => history.replace({ pathname: "/login" })}
            >
              {t("返回登录")}
            </Button>
            <Button
              type="primary"
              className={styles.submit_btn}
              loading={activating}
              disabled={!activationCode}
              onClick={handleAuthClick}
            >
              {t("激活授权")}
            </Button>
          </div>
        </div>
      </ConfigProvider>
    </div>
  );
};
