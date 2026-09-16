import { DisconnectOutlined, WifiOutlined } from "@ant-design/icons";
import { Tag } from "antd";
import { useI18n } from "@/hooks/useI18n";
import styles from "./index.less";

export type NetworkState = "ONLINE" | "OFFLINE";

interface NetworkStateTagProps {
    state: NetworkState;
}

/**
 * 统一展示设备网络状态，集中维护状态语义、文案与视觉样式。
 * 组件只负责展示，不读取设备数据或引入额外状态，便于各设备列表复用。
 */
export default ({ state }: NetworkStateTagProps) => {
    const { t } = useI18n();
    const isOnline = state === "ONLINE";

    return (
        <Tag
            className={`${styles.networkStateTag} ${isOnline ? styles.online : styles.offline}`}
            icon={isOnline ? <WifiOutlined /> : <DisconnectOutlined />}
        >
            {isOnline ? t("在线") : t("离线")}
        </Tag>
    );
};
