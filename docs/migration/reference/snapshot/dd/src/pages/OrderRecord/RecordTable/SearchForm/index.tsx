/**
 * @description 历史任务表格的搜索表单
 * @date 2025-6-14
 */
import { useEffect, useState } from "react";
import { Form, Input, DatePicker, Row, Col, Button, Space, Select, message } from "antd";
import { orderTypeOptions, orderStateOptions } from "@/constants/OrderRecord/orderRecord";
import type { FormProps, GetProps } from "antd";
import type { PageOrderRecordsParams } from "@/types/OrderRecord";
import dayjs from "dayjs";
import { getSimpleVehicles, exportOrderRecords } from "@/api";
import type { SimpleVehicle } from "@/types/VehicleDeploy/GroupType";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

type RangePickerProps = GetProps<typeof DatePicker.RangePicker>;

const { RangePicker } = DatePicker;

interface RecordSearchProps {
    searchParams: PageOrderRecordsParams;
    setSearchParams: (value: React.SetStateAction<PageOrderRecordsParams>) => void;
    setOpenCreateOrder: (value: React.SetStateAction<boolean>) => void;
}

export default (props: RecordSearchProps) => {

    const { setSearchParams, setOpenCreateOrder } = props;

    /* 国际化翻译方法，用于将搜索表单的标签和按钮文案进行多语言转换 */
    const { t } = useI18n();

    /* 按钮级权限判定（SPEC §8.3）：创建任务 */
    const { hasPerm } = useAccess();
    const canCreate = hasPerm(PERM_BUTTON.ORDER_RECORD_CREATE); // 创建任务（§7.1）

    const [simpleVehicles, setSimpleVehicles] = useState<SimpleVehicle[]>([]);

    const [form] = Form.useForm();

    // 把表单值转换成接口查询参数（查询与导出共用，保证两处口径一致）
    const buildParams = (values: Partial<PageOrderRecordsParams>) => {
        const { query = "", orderType = "", orderState = "", vehicleKey = "" } = values;
        /*
         * 注意：RangePicker 被 allowClear 清空后，表单字段值为 null（而非 undefined）。
         * ES 解构默认值（= ["", ""]）仅对 undefined 生效，对 null 不生效，
         * 若沿用解构默认值，下面 const [a, b] = null 会抛
         * "Invalid attempt to destructure non-iterable instance"。
         * 这里改用 Array.isArray 兜底，确保一定是可迭代的数组。
         * 该函数同时供查询（onFinish）与导出（handleExportExcel）使用，
         * 故此兜底对两条路径都生效。
         */
        const createTime = Array.isArray(values.createTime) ? values.createTime : ["", ""];
        const finalTime = Array.isArray(values.finalTime) ? values.finalTime : ["", ""];
        const executionTime = Array.isArray(values.executionTime) ? values.executionTime : ["", ""];
        const [startCreateTime, endCreateTime] = createTime;
        const [startFinalTime, endFinalTime] = finalTime;
        const [startExecutionTime, endExecutionTime] = executionTime;
        /*
         * 仅收集有值的筛选条件，空值一律不写入参数对象。
         * 这样请求 URL 只会出现用户实际填写的条件，实现"所见即所得"：
         * 页面没有选择的字段，查询/导出参数里就完全不存在（而不是带一个空串）。
         * buildParams 同时供查询与导出使用，保证两处口径一致。
         */
        const params: Partial<PageOrderRecordsParams> = {};
        if (query) params.query = query;
        if (orderType) params.orderType = orderType;
        if (orderState) params.orderState = orderState;
        if (vehicleKey) params.vehicleKey = vehicleKey;
        if (startCreateTime) params.startCreateTime = dayjs(startCreateTime).format("YYYY-MM-DD HH:mm:ss");
        if (endCreateTime) params.endCreateTime = dayjs(endCreateTime).format("YYYY-MM-DD HH:mm:ss");
        if (startFinalTime) params.startFinalTime = dayjs(startFinalTime).format("YYYY-MM-DD HH:mm:ss");
        if (endFinalTime) params.endFinalTime = dayjs(endFinalTime).format("YYYY-MM-DD HH:mm:ss");
        if (startExecutionTime) params.startExecutionTime = dayjs(startExecutionTime).format("YYYY-MM-DD HH:mm:ss");
        if (endExecutionTime) params.endExecutionTime = dayjs(endExecutionTime).format("YYYY-MM-DD HH:mm:ss");
        return params;
    };

    const onFinish: FormProps<Partial<PageOrderRecordsParams>>["onFinish"] = (values) => {
        /*
         * 函数式更新：丢弃上一次 searchParams 中的旧筛选条件，
         * 让本次查询条件完全由当前表单决定（与表单所见一致）；pageSize 予以保留。
         */
        setSearchParams(prev => ({
            pageNo: 1,
            pageSize: prev.pageSize,
            ...buildParams(values)
        }));
    };

    const handleResetForm = () => {
        /*
         * "清空"必须同时处理两件事，缺一不可：
         * 1. form.resetFields() —— 清空表单 UI（所见）；
         * 2. setSearchParams(...) —— 重置驱动请求的查询条件为仅分页参数（所得）。
         * 之前只做了第 1 步，导致表单已清空但请求仍带上旧条件。
         * 用函数式更新避免闭包中的陈旧 searchParams，pageSize 予以保留。
         */
        form.resetFields();
        setSearchParams(prev => ({
            pageNo: 1,
            pageSize: prev.pageSize
        }));
    };

    const handleOpenCreateOrder = () => {
        setOpenCreateOrder(true);
    };

    // 解析 content-disposition 响应头中的文件名：优先按 RFC 5987 解析 filename*=charset''value，其次解析 filename="value"
    const parseDispositionFilename = (disposition?: string) => {
        if (!disposition) return "";
        const starMatch = disposition.match(/filename\*=[^']*''([^;]+)/i);
        if (starMatch) {
            try {
                return decodeURIComponent(starMatch[1]);
            } catch {
                return starMatch[1];
            }
        }
        const match = disposition.match(/filename="?([^";]+)"?/i);
        return match ? match[1] : "";
    };

    // 导出订单记录Excel：直接取表单当前值作为导出条件（与表单所见一致，清空后即无条件导出）
    const handleExportExcel = () => {
        // 导出前先提醒用户：数据导出需要等待，完成后浏览器会自动触发下载，请留意浏览器下载提示
        const hide = message.loading(t("正在导出，请留意浏览器下载提示"), 0);
        exportOrderRecords(buildParams(form.getFieldsValue())).then(res => {
            hide();
            // 文件名取服务器在响应头 content-disposition 中返回的原始文件名，取不到时回退到默认名
            const filename =
                parseDispositionFilename(res?.headers["content-disposition"]) ||
                t("订单记录.xlsx");
            const blob: Blob = res.data;
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            message.success(t("导出订单记录成功"));
        }).catch(err => {
            hide();
            if (err) {
                message.error(t("导出订单记录出错：{msg}", { msg: err?.message ?? "" }));
            }
        });
    };

    useEffect(() => {
        // 查询车辆列表
        getSimpleVehicles().then(res => {
            if (res.code === 200 && res.message === "success") {
                setSimpleVehicles(res?.data || []);
            } else {
                message.warning(t("查询车辆出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询车辆出错") + err?.message);
            }
        })
    }, [])

    return (
        <Form
            form={form}
            name="search_record"
            autoComplete="off"
            onFinish={onFinish}
        >
            <Row gutter={[10, 0]} justify="start">
                <Col span={6} offset={0}>
                    <Form.Item<PageOrderRecordsParams>
                        label={t("任务名称")}
                        name="query"
                        rules={[{ required: false, message: "" }]}
                    >
                        <Input
                            allowClear
                            placeholder={t("任务名称/编号")}
                        />
                    </Form.Item>
                </Col>
                <Col span={6} offset={0}>
                    <Form.Item<PageOrderRecordsParams>
                        label={t("任务类型")}
                        name="orderType"
                        rules={[{ required: false, message: "" }]}
                    >
                        <Select
                            allowClear
                            placeholder={t("请选择任务类型")}
                            options={orderTypeOptions?.map(opt => ({ ...opt, label: t(opt.label as string) }))}
                        />
                    </Form.Item>
                </Col>
                <Col span={6} offset={0}>
                    <Form.Item<PageOrderRecordsParams>
                        label={t("任务状态")}
                        name="orderState"
                        rules={[{ required: false, message: "" }]}
                    >
                        <Select
                            allowClear
                            placeholder={t("请选择任务状态")}
                            options={orderStateOptions?.map(opt => ({ ...opt, label: t(opt.label as string) }))}
                        />
                    </Form.Item>
                </Col>
                <Col span={6} offset={0}>
                    <Form.Item<PageOrderRecordsParams>
                        label={t("任务车辆")}
                        name="vehicleKey"
                        rules={[{ required: false, message: "" }]}
                    >
                        <Select
                            allowClear
                            showSearch
                            optionFilterProp="name"
                            fieldNames={{ label: "name", value: "key" }}
                            placeholder={t("请选择任务车辆")}
                            options={simpleVehicles}
                        />
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={[10, 0]}>
                <Col span={6} offset={0}>
                    <Form.Item<PageOrderRecordsParams>
                        label={t("创建时间")}
                        name="createTime"
                        rules={[{ required: false, message: "" }]}
                    >
                        <RangePicker
                            allowEmpty={[true, true]}
                            allowClear
                            showTime={{ format: 'HH:mm' }}
                            placeholder={[t("开始创建时间"), t("结束创建时间")]}
                        />
                    </Form.Item>
                </Col>

                <Col span={6} offset={0}>
                    <Form.Item<PageOrderRecordsParams>
                        label={t("终止时间")}
                        name="finalTime"
                        rules={[{ required: false, message: "" }]}
                    >
                        <RangePicker
                            allowEmpty={[true, true]}
                            allowClear
                            showTime={{ format: 'HH:mm' }}
                            placeholder={[t("终止开始时间"), t("终止结束时间")]}
                        />
                    </Form.Item>
                </Col>

                <Col span={6} offset={0}>
                    <Form.Item<PageOrderRecordsParams>
                        label={t("执行时间")}
                        name="executionTime"
                        rules={[{ required: false, message: "" }]}
                    >
                        <RangePicker
                            allowEmpty={[true, true]}
                            allowClear
                            showTime={{ format: 'HH:mm' }}
                            placeholder={[t("执行开始时间"), t("执行结束时间")]}
                        />
                    </Form.Item>
                </Col>

                <Col span={6} offset={0}>
                    <Form.Item<PageOrderRecordsParams>>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                {t("查询")}
                            </Button>
                            <Button onClick={handleResetForm}>
                                {t("清空")}
                            </Button>
                            {/* 创建任务：无权限隐藏（§7.1） */}
                            {canCreate && (
                                <Button
                                    type="primary"
                                    onClick={handleOpenCreateOrder}
                                >
                                    {t("创建任务")}
                                </Button>
                            )}
                            <Button onClick={handleExportExcel}>
                                {t("导出Excel")}
                            </Button>
                        </Space>
                    </Form.Item>
                </Col>
            </Row>
        </Form>
    )
};
