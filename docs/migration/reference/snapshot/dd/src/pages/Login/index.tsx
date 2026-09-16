/**
 * @description 登录页组件
 * 包含：表单登录、浏览器语言自动检测、独立语言切换入口
 * @date 2025-5-16
 */
import { useState, useEffect, useRef } from "react";
import { history, useModel, setLocale } from "@umijs/max";
import { LockOutlined, UserOutlined, TranslationOutlined } from "@ant-design/icons";
import { Button, Form, Input, message, ConfigProvider, theme, notification, Dropdown } from "antd";
import { useLocalStorageState } from "ahooks";
import styles from "./index.less";
import { login, detail, fetchSystemImage } from "@/api";
import type { LoginType, AccessInfo } from "@/types/Login";
import { sleep } from "@/utils/public";
import { getFirstAccessiblePath } from "@/utils/permission";
import { md5 } from "@/utils/crypto";
import defaultLoginBg from "@/assets/images/login-bg.jpg";
import { useI18n } from "@/hooks/useI18n";
import type { MenuProps } from "antd";

export default () => {

    const { t } = useI18n();
    const [form] = Form.useForm();

    const [loading, setLoading] = useState<boolean>(false);
    const [bgUrl, setBgUrl] = useState<string>("");
    const blobUrlRef = useRef<string>("");

    useEffect(() => {
        // 首次访问时，如果没有存储的语言偏好，检测浏览器语言
        const savedLocale = localStorage.getItem("umi_locale");
        if (!savedLocale) {
            const browserLang = navigator.language;
            if (browserLang.startsWith("en")) {
                setLocale("en-US", true);
            }
            // 其他情况保持默认 zh-CN
        }

        // 检查是否存在 token 过期标记，如果存在则弹出提示并清除标记
        if (sessionStorage.getItem("token_expired") === "1") {
            sessionStorage.removeItem("token_expired");
            notification.warning({
                message: t("登录过期"),
                description: t("登录已过期，请重新登录"),
                duration: 5,
            });
        }
        fetchSystemImage("loginBackground")
            .then((blob) => {
                if (blob && blob.size > 0 && blob.type.includes("image")) {
                    const url = URL.createObjectURL(blob);
                    blobUrlRef.current = url;
                    setBgUrl(url);
                } else {
                    setBgUrl(defaultLoginBg);
                }
            })
            .catch(() => {
                setBgUrl(defaultLoginBg);
            });
        return () => {
            if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        };
    }, []);
    // 初始状态
    const { refresh } = useModel("@@initialState");
    // 登录信息存入stroage
    const [_, setAccessInfo] = useLocalStorageState<AccessInfo>("accessInfo", {
        defaultValue: {
            username: "",
            token: ""
        },
        listenStorageChange: true
    });

    const handleClickLogin = (values: LoginType) => {
        setLoading(true);
        login({ ...values, password: md5(values.password) }).then(async res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("登录成功"));
                // 扩展存储 permissionsTree（菜单级数据源，D3）与 flatPermissions（按钮级数据源，B16/B19）
                // 后端字段 data.permissions → 前端存储字段 flatPermissions（刻意改名以与 InitialState.permissions 区分）
                setAccessInfo({
                    username: values.username,
                    token: "Bearer " + res?.data?.token,
                    permissionsTree: res?.data?.permissionsTree ?? [],
                    flatPermissions: res?.data?.permissions ?? []
                });
                await refresh();
                await sleep(3);
                /*
                 * 登录成功后强制刷新页面
                 * 清空浏览器缓存，确保加载最新资源
                 *
                 * 根据后端返回的 activated 字段判断系统是否激活：
                 * - activated === false：系统未激活，跳转到授权入场页
                 * - 否则动态跳转首个可访问菜单（D6）：传 username 使 root 走短路，
                 *   普通用户按 MENU_ROUTE_ORDER 顺序找首个命中菜单；全无权限跳 /no-permission
                 * 使用严格等于 false 判断，避免字段不存在时误跳转
                 */
                const targetPath =
                    res?.data?.activated === false
                        ? "/authorize-ingress"
                        : getFirstAccessiblePath(res?.data?.permissionsTree, values.username);
                window.location.href = window.location.origin + "/#" + targetPath;
            } else {
                setLoading(false);
                message.warning(res?.message);
            }
        }).catch(err => {
            if (err) {
                setLoading(false);
                message.error(t("登录出错") + err?.message);
            }
        })
    };

    /**
     * 登录页独立语言切换菜单
     * 由于 layout: false，页面无顶栏 ActionsRender，需单独提供切换入口
     */
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
        /* 切换后刷新页面，确保所有组件完全重新渲染 */
        setLocale(key, true);
    };

    return (
        <div
            className={styles.login}
            style={{ backgroundImage: `url(${bgUrl || defaultLoginBg})` }}
        >
            {/* 语言切换按钮：固定在右上角 */}
            <div className={styles.locale_switch}>
                <Dropdown
                    menu={{ items: localeMenuItems, onClick: onLocaleClick }}
                    trigger={["click"]}
                >
                    <TranslationOutlined style={{ fontSize: 20 }} />
                </Dropdown>
            </div>
            <div className={styles.login_vessel}>
                <div className={styles.login_text}>
                    {t("登录")}
                </div>
                <ConfigProvider
                    theme={{
                        algorithm: theme.defaultAlgorithm
                    }}
                >
                    <Form
                        name="login"
                        className={styles.login_form}
                        onFinish={handleClickLogin}
                        form={form}
                    >
                        <Form.Item<LoginType>
                            name="username"
                            rules={[{ required: true, message: t("请输入账号") }]}
                        >
                            <Input
                                prefix={<UserOutlined />}
                                placeholder={t("请输入账号")}
                            />
                        </Form.Item>
                        <Form.Item<LoginType>
                            name="password"
                            rules={[{ required: true, message: t("请输入密码") }]}
                        >
                            <Input
                                prefix={<LockOutlined />}
                                type="password"
                                placeholder={t("请输入密码")}
                            />
                        </Form.Item>

                        <Form.Item>
                            <Button
                                block
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                            >
                                {t("登录")}
                            </Button>
                        </Form.Item>
                    </Form>
                </ConfigProvider>
            </div>
        </div>
    )
};
