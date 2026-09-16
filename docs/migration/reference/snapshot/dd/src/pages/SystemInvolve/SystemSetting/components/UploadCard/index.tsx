import { useState, useCallback, useEffect, useRef } from "react";
import { Card, Upload, Button, message, Spin, Typography, Image } from "antd";
import type { UploadProps } from "antd";
import { CloudUploadOutlined, FileImageOutlined } from "@ant-design/icons";
import { uploadSystemImage, fetchSystemImage } from "@/api";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON, type PermButtonCode } from "@/constants/permission";
import styles from "./index.less";

export interface SettingItem {
    key: string;
    title: string;
    description: string;
    accept: string;
    /**
     * 该卡片「上传图片」按钮对应的按钮权限码
     * 无权限时隐藏上传按钮（预览图保留可见），详见 docs/SPEC_button_permission.md §7.1
     */
    permCode: PermButtonCode;
}

interface UploadCardProps {
    item: SettingItem;
}

const UploadCard = ({ item }: UploadCardProps) => {
    const { t } = useI18n();
    /*
     * 按钮级权限判定
     * 无权限的动作触发型按钮条件渲染隐藏（root 短路全开）
     * 详见 docs/SPEC_button_permission.md §7
     */
    const { hasPerm } = useAccess();
    /* 当前卡片是否具备上传权限（预览图始终可见，仅隐藏上传动作） */
    const canUpload = hasPerm(item.permCode);
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string>("");
    const [imgLoadError, setImgLoadError] = useState(false);
    const blobUrlRef = useRef<string>("");

    const loadPreview = useCallback((placementKey: string) => {
        fetchSystemImage(placementKey)
            .then((blob) => {
                if (blobUrlRef.current) {
                    URL.revokeObjectURL(blobUrlRef.current);
                }
                const url = URL.createObjectURL(blob);
                blobUrlRef.current = url;
                setPreviewUrl(url);
                setImgLoadError(false);
            })
            .catch(() => {
                setImgLoadError(true);
            });
    }, []);

    useEffect(() => {
        loadPreview(item.key);
        return () => {
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
            }
        };
    }, [item.key, loadPreview]);

    const handleBeforeUpload: UploadProps["beforeUpload"] = useCallback(
        (file: File) => {
            setUploading(true);
            uploadSystemImage(item.key, file)
                .then((res: any) => {
                    if (res?.code === 200 && res?.message === "success") {
                        message.success(t("{label}上传成功", { label: item.title }));
                        loadPreview(item.key);
                    } else {
                        message.warning(res?.message || t("上传失败"));
                    }
                })
                .catch((err: any) => {
                    message.error(t("上传失败") + `: ${err?.message || ""}`);
                })
                .finally(() => setUploading(false));
            return false;
        },
        [item.key, item.title, loadPreview]
    );

    return (
        <Card className={styles.upload_card} title={item.title} size="small">
            <div className={styles.card_content}>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {item.description}
                </Typography.Text>
                <Spin spinning={uploading}>
                    <div className={styles.preview_area}>
                        {!imgLoadError ? (
                            <Image
                                className={styles.preview_image}
                                src={previewUrl}
                                alt={item.title}
                                onError={() => setImgLoadError(true)}
                                preview={{ mask: t("点击预览") }}
                            />
                        ) : (
                            <div className={styles.placeholder}>
                                <FileImageOutlined
                                    className={styles.placeholder_icon}
                                />
                                <span>{t("暂无图片")}</span>
                            </div>
                        )}
                    </div>
                </Spin>
                {/* 上传图片：无权限时隐藏上传按钮，预览图保留可见（§7.1 动作触发型隐藏） */}
                {canUpload && (
                    <div className={styles.upload_actions}>
                        <Upload
                            accept={item.accept}
                            showUploadList={false}
                            beforeUpload={handleBeforeUpload}
                        >
                            <Button
                                type="primary"
                                icon={<CloudUploadOutlined />}
                                loading={uploading}
                            >
                                {t("上传图片")}
                            </Button>
                        </Upload>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default UploadCard;
