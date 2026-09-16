import UploadCard, { SettingItem } from "../UploadCard";
import { useI18n } from "@/hooks/useI18n";
import { PERM_BUTTON } from "@/constants/permission";
import styles from "./index.less";

const getImageSettings = (t: (id: string) => string): SettingItem[] => [
    {
        key: "headerLogo",
        title: t("顶部导航栏图片"),
        description: t("顶部导航栏图片描述"),
        accept: ".svg,.png,.jpg,.jpeg,.webp",
        // 对应按钮码 system:setting:upload-navbar
        permCode: PERM_BUTTON.SYSTEM_SETTING_UPLOAD_NAVBAR,
    },
    {
        key: "loginBackground",
        title: t("登录背景图"),
        description: t("登录背景图描述"),
        accept: ".jpg,.jpeg,.png,.webp",
        // 对应按钮码 system:setting:upload-login-bg
        permCode: PERM_BUTTON.SYSTEM_SETTING_UPLOAD_LOGIN_BG,
    },
    {
        key: "favicon",
        title: t("网站 Tab 图标"),
        description: t("网站 Tab 图标描述"),
        accept: ".ico,.png,.svg",
        // 对应按钮码 system:setting:upload-tab-icon
        permCode: PERM_BUTTON.SYSTEM_SETTING_UPLOAD_TAB_ICON,
    },
];

const ImageSettings = () => {
    const { t } = useI18n();
    const IMAGE_SETTINGS = getImageSettings(t);
    return (
        <div className={styles.setting_grid}>
            {IMAGE_SETTINGS.map((item) => (
                <UploadCard key={item.key} item={item} />
            ))}
        </div>
    );
};

export default ImageSettings;
