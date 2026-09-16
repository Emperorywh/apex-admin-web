/**
 * @description 操作日志搜索表单
 * @date 2026-4-21
 */
import { Form, Input, Select, DatePicker, Button, Space, Row, Col } from "antd";
import type { FormProps, GetProps } from "antd";
import dayjs from "dayjs";
import type { PageSysLogsParams } from "@/types/SystemInvolve/SystemLog";
import { operationLogModuleOptions } from "@/constants";
import { useI18n } from "@/hooks/useI18n";

type RangePickerProps = GetProps<typeof DatePicker.RangePicker>;

const { RangePicker } = DatePicker;

const logTypeOptions = (t: (id: string) => string) => [
    { label: t("正常"), value: "NORMAL" },
    { label: t("异常"), value: "ERROR" }
];

interface OperationLogSearchProps {
    searchParams: PageSysLogsParams;
    setSearchParams: (value: React.SetStateAction<PageSysLogsParams>) => void;
}

interface FormValues {
    title?: string;
    targetName?: string;
    logType?: PageSysLogsParams["logType"];
    module?: PageSysLogsParams["module"];
    requestTime?: RangePickerProps["value"];
}

export default (props: OperationLogSearchProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { searchParams, setSearchParams } = props;

    const [form] = Form.useForm();

    /**
     * 模块下拉选项
     * 复用 operationLogModuleOptions（与表格列 Tag 渲染同源），label 经 t() 国际化
     */
    const moduleOptions = operationLogModuleOptions.map((item) => ({
        label: t(item.label),
        value: item.value
    }));

    const onFinish: FormProps<FormValues>["onFinish"] = (values) => {
        const { title = "", targetName = "", logType, module, requestTime } = values;
        const [startRequestTime, endRequestTime] = requestTime || [null, null];
        setSearchParams({
            ...searchParams,
            pageNo: 1,
            title,
            targetName,
            logType,
            module,
            startRequestTime: startRequestTime ? dayjs(startRequestTime).format("YYYY-MM-DD HH:mm:ss") : "",
            endRequestTime: endRequestTime ? dayjs(endRequestTime).format("YYYY-MM-DD HH:mm:ss") : ""
        });
    };

    const handleResetForm = () => {
        form.resetFields();
    };

    return (
        <Form
            form={form}
            name="search_operation_log"
            autoComplete="off"
            onFinish={onFinish}
        >
            {/*
                布局说明：文本类查询（日志标题、目标名称）与枚举类查询（日志类型、模块）
                各两项排在首行；请求时间范围较宽，单独占次行并紧随操作按钮
            */}
            <Row gutter={[10, 0]} justify="start">
                <Col span={6} offset={0}>
                    <Form.Item<FormValues>
                        label={t("日志标题")}
                        name="title"
                        rules={[{ required: false, message: "" }]}
                    >
                        <Input
                            allowClear
                            placeholder={t("请输入日志标题")}
                        />
                    </Form.Item>
                </Col>
                <Col span={6} offset={0}>
                    <Form.Item<FormValues>
                        label={t("目标名称")}
                        name="targetName"
                        rules={[{ required: false, message: "" }]}
                    >
                        <Input
                            allowClear
                            placeholder={t("请输入目标名称")}
                        />
                    </Form.Item>
                </Col>
                <Col span={6} offset={0}>
                    <Form.Item<FormValues>
                        label={t("日志类型")}
                        name="logType"
                        rules={[{ required: false, message: "" }]}
                    >
                        <Select
                            allowClear
                            placeholder={t("请选择日志类型")}
                            options={logTypeOptions(t)}
                        />
                    </Form.Item>
                </Col>
                <Col span={6} offset={0}>
                    <Form.Item<FormValues>
                        label={t("模块")}
                        name="module"
                        rules={[{ required: false, message: "" }]}
                    >
                        <Select
                            allowClear
                            placeholder={t("请选择模块")}
                            options={moduleOptions}
                        />
                    </Form.Item>
                </Col>
                <Col span={8} offset={0}>
                    <Form.Item<FormValues>
                        label={t("请求时间")}
                        name="requestTime"
                        rules={[{ required: false, message: "" }]}
                    >
                        <RangePicker
                            allowEmpty={[true, true]}
                            showTime={{ format: "HH:mm" }}
                            placeholder={[t("开始请求时间"), t("结束请求时间")]}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>
                <Col span={4} offset={0}>
                    <Form.Item<FormValues>>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                {t("查询")}
                            </Button>
                            <Button onClick={handleResetForm}>
                                {t("清空")}
                            </Button>
                        </Space>
                    </Form.Item>
                </Col>
            </Row>
        </Form>
    )
};
