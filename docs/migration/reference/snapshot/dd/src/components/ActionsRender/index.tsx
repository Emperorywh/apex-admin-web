/**
 * @description 页面布局顶部右侧的操作集合
 * 包含：主题切换、语言切换、用户信息/退出登录
 * 每个操作项使用独立的 Dropdown，确保所有按钮始终可见
 * @date 2025-9-20
 */
import { useState, useEffect } from "react";
import { setLocale, useAntdConfigSetter, history, useModel } from "@umijs/max";
import { Dropdown, message, theme } from "antd";
import { useLocalStorageState } from "ahooks";
import {
  UserOutlined,
  SkinOutlined,
  LogoutOutlined,
  TranslationOutlined,
  KeyOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import type { AccessInfo } from "@/types/Login";
import { logout } from "@/api";
import { useI18n } from "@/hooks/useI18n";
import PasswordModal from "@/components/PasswordModal";

type ThemeMode = "defaultAlgorithm" | "darkAlgorithm";

/**
 * 用户首次进入系统时统一使用 Ant Design 默认主题。
 * 主题初始值只在此处定义，主题切换和初始化共享同一套类型约束。
 */
const DEFAULT_THEME: ThemeMode = "defaultAlgorithm";
const { darkAlgorithm, defaultAlgorithm } = theme;

export default () => {
  const { t } = useI18n();
  /* 清空初始化状态 */
  const { refresh } = useModel("@@initialState");
  /* 主题模式 */
  const [localTheme, setLocalTheme] = useLocalStorageState<ThemeMode>("theme", {
    defaultValue: DEFAULT_THEME,
    listenStorageChange: true,
  });
  const setAntdConfig = useAntdConfigSetter();
  const [accessInfo, setAccessInfo] = useLocalStorageState<AccessInfo>("accessInfo");
  /**
   * 修改密码弹窗状态归属于顶部用户操作组件。
   * 弹窗只通过显式属性接收当前用户及成功回调，不与主题状态耦合。
   */
  const [openPasswordModal, setOpenPasswordModal] = useState<boolean>(false);

  /**
   * 登出事件
   * 调用后端登出接口，清除本地凭证后跳转登录页
   */
  const handleLoginOut = () => {
    logout()
      .then(async (res) => {
        if (res.code === 200 && res.message === "success") {
          // 清除权限数据（D11）：setter 为整体替换语义，不传 permissionsTree 即一并清除
          setAccessInfo({
            username: "",
            token: "",
          });
          await refresh();
          history.replace({
            pathname: "/login",
          });
        } else {
          message.warning(t("退出登录出错") + res?.message);
        }
      })
      .catch((err) => {
        if (err) {
          message.error(t("退出登录出错") + err?.message);
        }
      });
  };

  /* ---- 主题切换下拉菜单 ---- */
  const themeMenuItems: MenuProps["items"] = [
    {
      key: "defaultAlgorithm",
      label: (
        <span>
          <span style={{ marginRight: "8px" }}>☀</span>
          {t("默认主题")}
        </span>
      ),
    },
    {
      key: "darkAlgorithm",
      label: (
        <span>
          <span style={{ marginRight: "8px" }}>☪</span>
          {t("暗色主题")}
        </span>
      ),
    },
  ];

  const onThemeClick: MenuProps["onClick"] = ({ key }) => {
    if (key === localTheme) return;
    /* 先设置目标主题，再刷新 */
    const target = key as ThemeMode;
    setLocalTheme(target);
    setAntdConfig({
      theme: {
        algorithm: [target === "darkAlgorithm" ? darkAlgorithm : defaultAlgorithm],
      },
    });
    window.location.reload();
  };

  /* ---- 语言切换下拉菜单 ---- */
  const localeMenuItems: MenuProps["items"] = [
    {
      key: "zh-CN",
      label: (
        <span>
          <span style={{ marginRight: "8px" }}>🇨🇳</span>简体中文
        </span>
      ),
    },
    {
      key: "en-US",
      label: (
        <span>
          <span style={{ marginRight: "8px" }}>🇺🇸</span>English
        </span>
      ),
    },
  ];

  const onLocaleClick: MenuProps["onClick"] = ({ key }) => {
    /* 第二个参数 true = 切换后刷新页面，确保所有组件（含 antd、ECharts）完全重新渲染 */
    setLocale(key, true);
  };

  /* ---- 用户信息下拉菜单 ---- */
  const userMenuItems: MenuProps["items"] = [
    {
      key: "password",
      label: t("修改密码"),
      icon: <KeyOutlined />,
    },
    {
      key: "logout",
      label: t("退出"),
      icon: <LogoutOutlined />,
    },
  ];

  const onUserClick: MenuProps["onClick"] = ({ key }) => {
    if (key === "logout") {
      handleLoginOut();
    } else if (key === "password") {
      // 打开修改密码弹窗，修改当前登录用户自己的密码
      setOpenPasswordModal(true);
    }
  };

  /**
   * 初始化主题
   * useLocalStorageState 负责提供新系统默认值和用户偏好。
   * 此处只把唯一的主题状态同步给 Ant Design，不再维护额外回退分支。
   */
  useEffect(() => {
    setAntdConfig({
      theme: {
        algorithm: [localTheme === "darkAlgorithm" ? darkAlgorithm : defaultAlgorithm],
      },
    });
  }, []);

  /**
   * 返回 flex 容器包裹三个独立的 Dropdown 操作项
   * 使用 flex 布局确保所有按钮始终可见、互不挤压
   */
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {/* 主题切换 */}
      <Dropdown
        menu={{ items: themeMenuItems, onClick: onThemeClick }}
        trigger={["click"]}
      >
        <span style={{ cursor: "pointer", padding: "0 8px" }}>
          <SkinOutlined style={{ fontSize: 16 }} />
        </span>
      </Dropdown>
      {/* 语言切换 */}
      <Dropdown
        menu={{ items: localeMenuItems, onClick: onLocaleClick }}
        trigger={["click"]}
      >
        <span style={{ cursor: "pointer", padding: "0 8px" }}>
          <TranslationOutlined style={{ fontSize: 16 }} />
        </span>
      </Dropdown>
      {/* 用户名 + 退出登录 */}
      <Dropdown
        menu={{ items: userMenuItems, onClick: onUserClick }}
        trigger={["click"]}
      >
        <span style={{ cursor: "pointer", padding: "0 8px" }}>
          <UserOutlined style={{ fontSize: 16, marginRight: 4 }} />
          {accessInfo?.username}
        </span>
      </Dropdown>
      {/* 修改当前登录用户密码 */}
      <PasswordModal
        open={openPasswordModal}
        username={accessInfo?.username}
        setOpenModal={setOpenPasswordModal}
        // 修改成功后退出登录，回到登录页重新使用新密码登录
        onSuccess={handleLoginOut}
      />
    </div>
  );
};
