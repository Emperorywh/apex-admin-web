/**
 * @description 无权限显示的页面
 *
 * 两种渲染场景（均为已登录态）：
 *   ① layout.unAccessible —— URL 直接访问无权限菜单时，umi access 渲染此组件（布局内占位）
 *   ② /no-permission 路由 —— 全无权限用户登录后跳转的兜底真路由
 *
 * §13.8 体验优化：区分「已登录 / 未登录」状态
 *   - 已登录：按钮「退出登录」（清凭证 + 跳登录页）
 *   - 未登录：按钮「去登录」
 *
 * @date 2025-9-24
 */
import { history } from "@umijs/max";
import { Result, Button } from "antd";
import { useLocalStorageState } from "ahooks";
import { useI18n } from "@/hooks/useI18n";
import type { AccessInfo } from "@/types/Login";

export default () => {

    const { t } = useI18n();
    const [, setAccessInfo] = useLocalStorageState<AccessInfo>("accessInfo");

    // 同步读取登录态判断按钮文案（unAccessible 渲染时序不确定，直接读 localStorage 最稳妥）
    let isLogged = false;
    try {
        const raw = localStorage.getItem("accessInfo");
        const info: AccessInfo = raw ? JSON.parse(raw) : {};
        isLogged = !!(info?.username && info?.token);
    } catch {
        isLogged = false;
    }

    /**
     * 已登录：退出登录（清凭证 + 跳登录页）
     * 未登录：直接跳登录页
     */
    const handleAction = () => {
        if (isLogged) {
            setAccessInfo({ username: "", token: "" });
        }
        history.replace({
            pathname: "/login"
        });
    };

    return (
        <Result
            status="403"
            title="403"
            subTitle={t("无权限访问当前页面")}
            extra={
                <Button
                    type="primary"
                    onClick={handleAction}
                >
                    {isLogged ? t("退出登录") : t("去登录")}
                </Button>
            }
        />
    )
};
