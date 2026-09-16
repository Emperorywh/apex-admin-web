/**
 * @description 404页面
 * @date 2025-5-17
 */
import { Result, Button } from "antd";
import { history } from "@umijs/max";
import { useI18n } from "@/hooks/useI18n";

export default () => {

    const { t } = useI18n();

    const backHome = () => {
        history.push({ pathname: "/over-look" });
    };

    return (
        <Result
            status="404"
            title="404"
            subTitle={t("抱歉，您访问的页面不存在")}
            extra={<Button type="primary" onClick={backHome}>{t("首页")}</Button>}
        />
    )
};
