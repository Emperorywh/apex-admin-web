/**
 * @description 系统文件
 * @date 2025-11-5
 */
import { useEffect } from "react";
import { getSystemLogTypes } from "@/api";
import { useI18n } from "@/hooks/useI18n";

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();

    useEffect(() => {
        getSystemLogTypes();
    }, [])

    return (
        <div>{t("系统文件")}</div>
    )
};
