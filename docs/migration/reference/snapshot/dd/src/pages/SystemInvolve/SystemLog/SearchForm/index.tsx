/**
 * @description 搜索日志信息的表单
 * @date 2025-11-5
 */
import { Form, Input, Select, DatePicker, Button, Space, Row, Col } from "antd";
import dayjs from "dayjs";
import type { FormProps, SelectProps } from "antd";
import type { SysLogParam } from "@/types/SystemInvolve/SystemLog";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

interface SearchFormProps {
    logTypes: SelectProps["options"];
    searchParams: SysLogParam;
    setSearchParams: (value: React.SetStateAction<SysLogParam>) => void;
    handleDownloadLogs: () => void;
}

export default (props: SearchFormProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();
    /*
     * 按钮级权限判定
     * 无权限的动作触发型按钮条件渲染隐藏（root 短路全开）
     * 详见 docs/SPEC_button_permission.md §7
     */
    const { hasPerm } = useAccess();

    const { logTypes, searchParams, setSearchParams, handleDownloadLogs } = props;

    const [form] = Form.useForm();

    const onFinish: FormProps<SysLogParam>["onFinish"] = (values) => {
        const { startTime, endTime } = values;
        const start = startTime ? dayjs(startTime).format("YYYY-MM-DD HH:mm:ss") : "";
        const end = endTime ? dayjs(endTime).format("YYYY-MM-DD HH:mm:ss") : "";
        setSearchParams({
            ...searchParams,
            ...values,
            pageNo: 1,
            startTime: start,
            endTime: end
        });
    };

    return (
        <Form
            style={{ marginBottom: 20 }}
            name="systemLogSearch"
            onFinish={onFinish}
            autoComplete="off"
            form={form}
        >
            <Row gutter={24}>
                <Col span={8}>
                    <Form.Item<SysLogParam>
                        label={t("日志名称")}
                        name="logName"
                        rules={[{ required: false, message: t("请输入日志名称") }]}
                    >
                        <Input
                            placeholder={t("请输入日志名称")}
                        />
                    </Form.Item>
                </Col>
                <Col span={8}>
                    <Form.Item<SysLogParam>
                        label={t("日志类型")}
                        name="logType"
                        rules={[{ required: true, message: t("请选择日志类型") }]}
                    >
                        <Select
                            placeholder={t("请选择日志类型")}
                            options={logTypes}
                            allowClear
                        />
                    </Form.Item>
                </Col>
                <Col span={8}>
                    <Form.Item<SysLogParam>
                        label={t("开始时间")}
                        name="startTime"
                        rules={[{ required: false, message: t("请选择日志开始时间") }]}
                    >
                        <DatePicker
                            style={{ width: "100%" }}
                            placeholder={t("请选择日志开始时间")}
                            showTime
                            allowClear
                            needConfirm
                            preserveInvalidOnBlur
                        />
                    </Form.Item>
                </Col>
            </Row>

            <Row>
                <Col span={8}>
                    <Form.Item<SysLogParam>
                        label={t("结束时间")}
                        name="endTime"
                        rules={[{ required: false, message: t("请选择日志结束时间") }]}
                    >
                        <DatePicker
                            style={{ width: "100%" }}
                            placeholder={t("请选择日志结束时间")}
                            showTime
                            allowClear
                            needConfirm
                            preserveInvalidOnBlur
                        />
                    </Form.Item>
                </Col>
                <Col span={8} offset={1}>
                    <Form.Item label={null}>
                        <div style={{ textAlign: "left" }}>
                            <Space>
                                <Button type="primary" htmlType="submit">
                                    {t("查询")}
                                </Button>
                                <Button onClick={() => form.resetFields()}>{t("清空")}</Button>
                                {/* 下载日志：无 system:log:download 权限条件渲染隐藏（§7.1） */}
                                {hasPerm(PERM_BUTTON.SYSTEM_LOG_DOWNLOAD) && (
                                    <Button type="primary" onClick={() => handleDownloadLogs()}>
                                        {t("下载日志")}
                                    </Button>
                                )}
                            </Space>
                        </div>
                    </Form.Item>
                </Col>
            </Row>

        </Form>
    )
};
