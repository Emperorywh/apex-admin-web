/**
 * @description 车辆告警码弹窗（新增 / 编辑）
 * @date 2026-7-9
 */
import { useEffect } from "react";
import { Modal, Form, Input, Select, Button, message, theme } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { addVehicleAlarmCode, updateVehicleAlarmCode } from "@/api";
import { useI18n } from "@/hooks/useI18n";
import type {
    AGVAlarmCodeAddParam,
    AGVAlarmCodeUpdateParam,
    AGVAlarmCodeRecord,
} from "@/types/SystemInvolve/AlarmCode";
import { LOCALE_OPTIONS } from "@/constants/alarmCode";
import { createAlarmCodeThemeStyle } from "../themeStyle";
import styles from "./index.less";

interface AlarmCodeModalProps {
    open: boolean;
    modifyAlarm?: AGVAlarmCodeRecord;
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
    getAlarmCodes: () => void;
    setModifyAlarm: (value: React.SetStateAction<AGVAlarmCodeRecord | undefined>) => void;
}

export default (props: AlarmCodeModalProps) => {

    const { open, modifyAlarm, setOpenModal, getAlarmCodes, setModifyAlarm } = props;
    const { t } = useI18n();
    const { token } = theme.useToken();

    /**
     * Modal 通过 Portal 挂载，不继承列表页容器上的 CSS 变量。
     * 在弹窗表单根节点重新注入同一语义映射，保持模块边界清晰且主题表现一致。
     */
    const themeStyle = createAlarmCodeThemeStyle(token);

    const [form] = Form.useForm();

    // 新增车辆告警码
    const handleAddAlarmCode = (data: AGVAlarmCodeAddParam) => {
        addVehicleAlarmCode(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                setOpenModal(false);
                form.resetFields();
                getAlarmCodes();
                message.success(t("创建车辆告警码成功"));
            } else {
                message.warning(t("创建车辆告警码出错：{msg}", { msg: res?.message ?? "" }));
            }
        }).catch(err => {
            if (err) {
                message.error(t("创建车辆告警码出错：{msg}", { msg: err?.message ?? "" }));
            }
        });
    };

    // 更新车辆告警码
    const handleUpdateAlarmCode = (data: AGVAlarmCodeUpdateParam) => {
        updateVehicleAlarmCode(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                setOpenModal(false);
                form.resetFields();
                getAlarmCodes();
                message.success(t("更新车辆告警码成功"));
            } else {
                message.warning(t("更新车辆告警码出错：{msg}", { msg: res?.message ?? "" }));
            }
        }).catch(err => {
            if (err) {
                message.error(t("更新车辆告警码出错：{msg}", { msg: err?.message ?? "" }));
            }
        });
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const values = form.getFieldsValue(true);
        // 多语言记录整体选填，但已添加的行经校验后 locale/desc/hint 均已填写，过滤掉 locale 为空的兜底
        const records = (values.alarmCodeRecords || []).filter(
            (item: { locale?: string }) => !!item?.locale
        );
        if (modifyAlarm) {
            handleUpdateAlarmCode({
                id: modifyAlarm.id,
                alarmCode: values.alarmCode,
                alarmCodeRecords: records,
            });
        } else {
            handleAddAlarmCode({
                alarmCode: values.alarmCode,
                alarmCodeRecords: records,
            });
        }
    };

    const handleCancel = () => {
        setModifyAlarm(undefined);
        form.resetFields();
        setOpenModal(false);
    };

    useEffect(() => {
        if (modifyAlarm) {
            form.setFieldsValue({
                alarmCode: modifyAlarm.alarmCode,
                alarmCodeRecords: modifyAlarm.alarmCodeRecords || [],
            });
        } else {
            form.resetFields();
        }
    }, [modifyAlarm]);

    return (
        <Modal
            title={modifyAlarm ? t("编辑车辆告警码") : t("新增车辆告警码")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            forceRender
            width={800}
        >
            <Form
                name="alarmCodeForm"
                // label 统一固定宽度，让“告警码 / 多语言描述”与卡片内各字段 label 宽度完全一致
                // （span 是相对父容器的百分比，嵌套卡片内会变窄；固定 px 不受嵌套影响）
                labelCol={{ flex: "0 0 160px" }}
                wrapperCol={{ flex: "1 1 0%" }}
                autoComplete="off"
                form={form}
                style={themeStyle}
            >
                <Form.Item
                    label={t("告警码")}
                    name="alarmCode"
                    rules={[{ required: true, message: t("请输入告警码") }]}
                >
                    <Input
                        placeholder={t("请输入告警码")}
                        maxLength={128}
                    />
                </Form.Item>

                <Form.Item label={t("多语言描述")}>
                    <Form.List name="alarmCodeRecords">
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map(({ key, name, ...restField }) => (
                                    // 单条多语言记录：左侧强调条 + 头部(语言/删除) + 主体(描述/建议) 的清晰分区
                                    <div key={key} className={styles.record_card}>
                                        {/* 头部：语言选择(卡片身份) + 删除按钮，下方虚线与主体分隔 */}
                                        <div className={styles.record_header}>
                                            <Form.Item
                                                {...restField}
                                                label={t("语言")}
                                                name={[name, "locale"]}
                                                rules={[{ required: true, message: t("请选择语言") }]}
                                            >
                                                <Select
                                                    placeholder={t("请选择语言")}
                                                    allowClear
                                                    options={LOCALE_OPTIONS}
                                                />
                                            </Form.Item>
                                            {/* 删除当前记录：图标按钮，点击区更大、hover 态更明确 */}
                                            <span
                                                className={styles.record_remove}
                                                title={t("删除该语言")}
                                                onClick={() => remove(name)}
                                            >
                                                <MinusCircleOutlined />
                                            </span>
                                        </div>
                                        {/* 告警描述：说明“是什么告警”，必填，自适应高度 */}
                                        <Form.Item
                                            {...restField}
                                            label={t("告警描述")}
                                            name={[name, "desc"]}
                                            rules={[{ required: true, message: t("请输入告警描述") }]}
                                        >
                                            <Input.TextArea
                                                placeholder={t("请输入告警描述")}
                                                autoSize={{ minRows: 2, maxRows: 6 }}
                                            />
                                        </Form.Item>
                                        {/* 处理建议：说明“怎么处理这个告警”，选填，自适应高度 */}
                                        <Form.Item
                                            {...restField}
                                            label={t("处理建议")}
                                            name={[name, "hint"]}
                                        >
                                            <Input.TextArea
                                                placeholder={t("请输入处理建议（选填）")}
                                                autoSize={{ minRows: 2, maxRows: 6 }}
                                            />
                                        </Form.Item>
                                    </div>
                                ))}
                                <Button
                                    type="dashed"
                                    onClick={() => add()}
                                    block
                                    icon={<PlusOutlined />}
                                >
                                    {t("添加多语言描述")}
                                </Button>
                            </>
                        )}
                    </Form.List>
                </Form.Item>

            </Form>
        </Modal>
    );
};
