/**
 * @description 系统设置 - 全局配置页
 * @date 2026-4-13
 */
import { Tabs } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import ImageSettings from "./components/ImageSettings";
import styles from "./index.less";
import { useI18n } from "@/hooks/useI18n";

export default () => {
    /* 国际化翻译方法 */ const { t } = useI18n();

    const TAB_ITEMS = [
        {
            key: "image",
            label: (
                <span>
                    <PictureOutlined style={{ marginRight: 8 }} />
                    {t("图片配置")}
                </span>
            ),
            children: <ImageSettings />,
        },
    ];

    return (
        <div className={styles.system_setting}>
            <Tabs items={TAB_ITEMS} defaultActiveKey="image" />
        </div>
    );
};
