/**
 * @description 软件信息
 * @date 2026-4-21
 */
import { useMemo, useState } from "react";
import { Card, Row, Col, Statistic, Tag, Typography, Tooltip, Button, Empty, Spin, message, Modal, Form, Input } from "antd";
import {
    SafetyCertificateOutlined,
    CarOutlined,
    CalendarOutlined,
    FieldTimeOutlined,
    KeyOutlined,
    DesktopOutlined,
    CopyOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ThunderboltOutlined
} from "@ant-design/icons";
import { useRequest } from "ahooks";
import dayjs from "dayjs";
import { getLicense, softwareActivation } from "@/api";
import type { LicenseProofRecord } from "@/types/SystemInvolve/SystemLog";
import styles from "./index.less";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

const { Paragraph, Text } = Typography;

const DATE_FORMAT = "YYYY-MM-DD HH:mm:ss";

const formatDate = (value?: string) => {
    if (!value) return "-";
    const d = dayjs(value);
    return d.isValid() ? d.format(DATE_FORMAT) : value;
};

interface LicenseStatus {
    label: string;
    color: string;
    icon: React.ReactNode;
    restDays: number;
}

const getLicenseStatus = (expirationDate?: string, t?: (id: string) => string): LicenseStatus => {
    const translate = t || ((id: string) => id);
    if (!expirationDate) {
        return { label: translate("未知"), color: "default", icon: <ClockCircleOutlined />, restDays: 0 };
    }
    const now = dayjs();
    const expire = dayjs(expirationDate);
    if (!expire.isValid()) {
        return { label: translate("未知"), color: "default", icon: <ClockCircleOutlined />, restDays: 0 };
    }
    const restDays = expire.startOf("day").diff(now.startOf("day"), "day");
    if (restDays < 0) {
        return { label: translate("已过期"), color: "error", icon: <CloseCircleOutlined />, restDays };
    }
    if (restDays <= 30) {
        return { label: translate("即将到期"), color: "warning", icon: <ClockCircleOutlined />, restDays };
    }
    return { label: translate("已激活"), color: "success", icon: <CheckCircleOutlined />, restDays };
};

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();
    /*
     * 按钮级权限判定
     * 无权限的动作触发型按钮条件渲染隐藏（root 短路全开）
     * 详见 docs/SPEC_button_permission.md §7
     */
    const { hasPerm } = useAccess();
    /* 激活软件权限（banner 与空态两处入口共用，无权限均隐藏 §7.1） */
    const canActivate = hasPerm(PERM_BUTTON.SYSTEM_SOFTWARE_ACTIVATE);

    // 激活弹窗
    const [activeModalOpen, setActiveModalOpen] = useState(false);
    const [form] = Form.useForm<{ activationCode: string }>();

    // 查询激活信息
    const { data, loading, refresh } = useRequest(async () => {
        const result = await getLicense();
        return result;
    }, {
        onError: (err) => message.error(t("获取激活信息出错") + err?.message)
    });

    // 软件激活
    const { run: runActivate, loading: activating } = useRequest(softwareActivation, {
        manual: true,
        onSuccess: (res: any) => {
            if (res?.code === 200 && res?.message === "success") {
                message.success(t("激活成功"));
                setActiveModalOpen(false);
                form.resetFields();
                refresh();
            } else {
                message.error(res?.message || t("激活失败"));
            }
        },
        onError: (err) => message.error(t("激活失败") + (err?.message || ""))
    });

    // 打开激活弹窗
    const handleOpenActivate = () => {
        form.resetFields();
        setActiveModalOpen(true);
    };

    // 提交激活
    const handleActivate = async () => {
        const values = await form.validateFields();
        runActivate({ activationCode: values.activationCode?.trim() });
    };

    // 激活信息
    const licenseInfo = useMemo<LicenseProofRecord | null>(() => {
        if (data?.code === 200 && data?.message === "success") {
            return data.data as LicenseProofRecord;
        }
        return null;
    }, [data]);

    // 激活状态
    const status = useMemo(() => getLicenseStatus(licenseInfo?.expirationDate, t), [licenseInfo, t]);

    // 复制文本到剪贴板
    const handleCopy = async (value: string, label: string) => {
        if (!value) return;
        // 非安全上下文（http 非 localhost）下 navigator.clipboard 不可用，走 execCommand 降级
        const fallbackCopy = (text: string): boolean => {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.setAttribute("readonly", "");
            textarea.style.position = "fixed";
            textarea.style.top = "-1000px";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            textarea.setSelectionRange(0, text.length);
            let ok = false;
            try {
                ok = document.execCommand("copy");
            } catch {
                ok = false;
            }
            document.body.removeChild(textarea);
            return ok;
        };

        try {
            if (window.isSecureContext && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
                message.success(t("{label}已复制", { label }));
                return;
            }
            if (fallbackCopy(value)) {
                message.success(t("{label}已复制", { label }));
            } else {
                message.error(t("复制失败"));
            }
        } catch (error) {
            console.error(error);
            if (fallbackCopy(value)) {
                message.success(t("{label}已复制", { label }));
            } else {
                message.error(t("复制失败"));
            }
        }
    };

    return (
        <div className={styles.software_information}>
            <Spin spinning={loading}>
                {licenseInfo ? (
                    <>
                        <Card
                            className={styles.banner_card}
                            bordered={false}
                        >
                            <div className={styles.banner_content}>
                                <div className={styles.banner_left}>
                                    <div className={styles.banner_icon}>
                                        <SafetyCertificateOutlined />
                                    </div>
                                    <div className={styles.banner_text}>
                                        <div className={styles.banner_title}>{t("软件授权信息")}</div>
                                        <div className={styles.banner_subtitle}>
                                            {t("当前系统授权状态与激活详情")}
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.banner_right}>
                                    <Tag
                                        icon={status.icon}
                                        color={status.color}
                                        className={styles.status_tag}
                                    >
                                        {status.label}
                                    </Tag>
                                    {/* 激活软件：无 system:software:activate 权限条件渲染隐藏（§7.1） */}
                                    {canActivate && (
                                        <Button
                                            type="primary"
                                            ghost
                                            icon={<ThunderboltOutlined />}
                                            className={styles.activate_btn}
                                            onClick={handleOpenActivate}
                                        >
                                            {t("激活软件")}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>

                        <Row gutter={[16, 16]} className={styles.stat_row}>
                            <Col xs={24} sm={12}>
                                <Card bordered={false} className={styles.stat_card}>
                                    <Statistic
                                        title={
                                            <span>
                                                <CarOutlined /> {t("最大 AGV 数量")}
                                            </span>
                                        }
                                        value={licenseInfo.agvNumber ?? 0}
                                        suffix={t("台")}
                                        valueStyle={{ color: "var(--ant-color-primary)" }}
                                    />
                                </Card>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Card bordered={false} className={styles.stat_card}>
                                    <Statistic
                                        title={
                                            <span>
                                                <FieldTimeOutlined /> {t("剩余授权天数")}
                                            </span>
                                        }
                                        value={status.restDays < 0 ? 0 : status.restDays}
                                        suffix={t("天")}
                                        valueStyle={{
                                            color:
                                                status.color === "error"
                                                    ? "var(--ant-color-error)"
                                                    : status.color === "warning"
                                                        ? "var(--ant-color-warning)"
                                                        : "var(--ant-color-success)"
                                        }}
                                    />
                                </Card>
                            </Col>
                        </Row>

                        <Row gutter={[16, 16]} className={styles.detail_row}>
                            <Col xs={24} lg={12}>
                                <Card
                                    bordered={false}
                                    className={styles.detail_card}
                                    title={
                                        <span>
                                            <CalendarOutlined /> {t("激活日期")}
                                        </span>
                                    }
                                >
                                    <div className={styles.detail_value}>
                                        {formatDate(licenseInfo.issueDate)}
                                    </div>
                                </Card>
                            </Col>
                            <Col xs={24} lg={12}>
                                <Card
                                    bordered={false}
                                    className={styles.detail_card}
                                    title={
                                        <span>
                                            <CalendarOutlined /> {t("过期日期")}
                                        </span>
                                    }
                                >
                                    <div className={styles.detail_value}>
                                        {formatDate(licenseInfo.expirationDate)}
                                    </div>
                                </Card>
                            </Col>

                            <Col xs={24}>
                                <Card
                                    bordered={false}
                                    className={styles.detail_card}
                                    title={
                                        <span>
                                            <KeyOutlined /> {t("激活码")}
                                        </span>
                                    }
                                    extra={
                                        <Tooltip title={t("复制激活码")}>
                                            <Button
                                                type="link"
                                                icon={<CopyOutlined />}
                                                disabled={!licenseInfo.activationCode}
                                                onClick={() =>
                                                    handleCopy(licenseInfo.activationCode, t("激活码"))
                                                }
                                            >
                                                {t("复制")}
                                            </Button>
                                        </Tooltip>
                                    }
                                >
                                    {/*
                                     * 激活码现在可能超过 15 行，全量展示会把卡片撑得很高
                                     * 超出固定高度后在区域内滚动查看完整内容（同硬件信息的处理方式）
                                     */}
                                    <Paragraph className={styles.code_value}>
                                        {licenseInfo.activationCode || "-"}
                                    </Paragraph>
                                </Card>
                            </Col>

                            <Col xs={24}>
                                <Card
                                    bordered={false}
                                    className={styles.detail_card}
                                    title={
                                        <span>
                                            <DesktopOutlined /> {t("硬件信息")}
                                        </span>
                                    }
                                    extra={
                                        <Tooltip title={t("复制硬件信息")}>
                                            <Button
                                                type="link"
                                                icon={<CopyOutlined />}
                                                disabled={!licenseInfo.hardwareInfo}
                                                onClick={() =>
                                                    handleCopy(licenseInfo.hardwareInfo, t("硬件信息"))
                                                }
                                            >
                                                {t("复制")}
                                            </Button>
                                        </Tooltip>
                                    }
                                >
                                    <pre className={styles.hardware_info}>
                                        {licenseInfo.hardwareInfo ? (
                                            licenseInfo.hardwareInfo
                                        ) : (
                                            <Text type="secondary">-</Text>
                                        )}
                                    </pre>
                                </Card>
                            </Col>
                        </Row>
                    </>
                ) : (
                    !loading && (
                        <div className={styles.empty_wrapper}>
                            <Empty description={t("暂无激活信息")}>
                                {/* 激活软件：无 system:software:activate 权限条件渲染隐藏（§7.1） */}
                                {canActivate && (
                                    <Button
                                        type="primary"
                                        icon={<ThunderboltOutlined />}
                                        onClick={handleOpenActivate}
                                    >
                                        {t("激活软件")}
                                    </Button>
                                )}
                            </Empty>
                        </div>
                    )
                )}
            </Spin>

            <Modal
                title={
                    <span>
                        <ThunderboltOutlined style={{ marginRight: 6, color: "var(--ant-color-primary)" }} />
                        {t("激活软件")}
                    </span>
                }
                open={activeModalOpen}
                onOk={handleActivate}
                onCancel={() => setActiveModalOpen(false)}
                confirmLoading={activating}
                okText={t("确认激活")}
                cancelText={t("取消")}
                destroyOnClose
                maskClosable={false}
            >
                <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 12 }}>
                    <Form.Item
                        name="activationCode"
                        label={t("激活码")}
                        rules={[{ required: true, message: t("请输入激活码") }]}
                    >
                        <Input.TextArea
                            placeholder={t("请输入激活码")}
                            autoSize={{ minRows: 4, maxRows: 8 }}
                            allowClear
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};
