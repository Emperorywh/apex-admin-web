/**
 * @description 避障模板弹窗：通过 Transfer 选择预置模板，再为每一项配置避障参数类型与启用状态
 * @date 2026-4-21
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Form, Input, Transfer, Select, Switch, Table, Button, Divider, Space, message } from "antd";
import type { TransferProps, InputRef } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { ObstacleParameters, ObstacleRecord } from "@/types/ObstacleAvoidance";
import { createObstacleAvoidance, updateObstacleAvoidance } from "@/api";
import { ObstacleAvoidanceTemplateData, type AvoidItem } from "./ObstacleAvoidanceTemplateData";
import { useI18n } from "@/hooks/useI18n";

interface ObstacleTemplateModalProps {
    open: boolean;
    updateRecord?: ObstacleRecord;
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
    setUpdateRecord: (value: React.SetStateAction<ObstacleRecord | undefined>) => void;
    getObstacleAvoidance: () => void;
}

interface TransferItem {
    key: string;
    title: string;
}

interface ParamConfig {
    avoid?: string;
    enable: boolean;
}

type TemplateItem = typeof ObstacleAvoidanceTemplateData[number];

interface AvoidParamSelectProps {
    baseList: AvoidItem[];
    extraList: AvoidItem[];
    value?: string;
    onChange: (value: string) => void;
    onAddItem: (label: string) => void;
}

/**
 * 避障参数类型选择器
 *  - option label 以 `${label} (${value})` 形式显示，便于识别具体标识
 *  - 下拉底部支持用户自定义添加，value 按数据源规则 `${key}_index_${i}` 自动生成
 */
const AvoidParamSelect = ({
    baseList,
    extraList,
    value,
    onChange,
    onAddItem
}: AvoidParamSelectProps) => {
    /* 国际化翻译方法 */ const { t } = useI18n();
    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef<InputRef>(null);

    const options = useMemo(
        () => {
            // 将 baseList 中预置项的 label 翻译为当前语言文案。
            // 数据源 generateAvoidList 生成的 label 形如 "默认" / "自定义N"（数字已拼死），
            // 但 i18n key 为 "默认" / "自定义{index}"（占位符形式），直接 t(item.label) 会查不到。
            // 这里从 value（`${key}_index_${i}`）反解出 index，还原为正确的 i18n key 再翻译。
            const translateBaseLabel = (item: AvoidItem) => {
                const match = /_index_(\d+)$/.exec(item.value);
                const idx = match ? Number(match[1]) : -1;
                if (idx === 0) {
                    return t("默认");
                }
                if (idx > 0) {
                    return t("自定义{index}", { index: idx });
                }
                return item.label;
            };
            return [
                ...baseList.map(item => ({
                    value: item.value,
                    label: `${translateBaseLabel(item)} (${item.value})`
                })),
                ...extraList.map(item => ({
                    value: item.value,
                    label: `${item.label} (${item.value})`
                }))
            ];
        },
        [baseList, extraList, t]
    );

    const handleAdd = (e?: React.MouseEvent | React.KeyboardEvent) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        const label = inputValue.trim();
        if (!label) return;
        onAddItem(label);
        setInputValue("");
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    return (
        <Select
            style={{ width: "100%" }}
            value={value}
            options={options}
            placeholder={t("请选择避障参数类型")}
            onChange={onChange}
            showSearch
            optionFilterProp="label"
            dropdownRender={menu => (
                <>
                    {menu}
                    <Divider style={{ margin: "4px 0" }} />
                    <Space style={{ padding: "0 8px 4px" }} onClick={e => e.stopPropagation()}>
                        <Input
                            ref={inputRef}
                            placeholder={t("请输入自定义名称")}
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === "Enter") handleAdd(e);
                            }}
                            maxLength={32}
                        />
                        <Button type="text" icon={<PlusOutlined />} onClick={handleAdd}>
                            {t("添加")}
                        </Button>
                    </Space>
                </>
            )}
        />
    );
};

export default (props: ObstacleTemplateModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, updateRecord, setOpenModal, setUpdateRecord, getObstacleAvoidance } = props;

    const [form] = Form.useForm();
    // Transfer 已选模板 key 列表（key 为模板 key）
    const [targetKeys, setTargetKeys] = useState<string[]>([]);
    // Transfer 当前选中（待移动）的 key
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    // 每个已选模板对应的参数配置（以 template.key 为 key）
    const [paramConfigs, setParamConfigs] = useState<Record<string, ParamConfig>>({});
    // 用户为每个模板额外添加的自定义避障项（以 template.key 为 key）
    const [customAvoidItems, setCustomAvoidItems] = useState<Record<string, AvoidItem[]>>({});

    // Transfer 数据源（key 使用模板 key，title 展示模板 name 的国际化文案）
    const transferData: TransferItem[] = useMemo(
        () => ObstacleAvoidanceTemplateData.map(item => ({ key: item.key, title: t(item.name) })),
        [t]
    );

    // 以 key 为索引的模板表
    const templateMap = useMemo(() => {
        const map: Record<string, TemplateItem> = {};
        ObstacleAvoidanceTemplateData.forEach(t => { map[t.key] = t; });
        return map;
    }, []);

    // 将旧数据中的 parameter 匹配到对应模板：优先用 avoid 前缀匹配 key，回退用 name 匹配
    const findTemplate = (p: ObstacleParameters): TemplateItem | undefined => {
        if (p.avoid) {
            const byAvoid = ObstacleAvoidanceTemplateData.find(
                t => p.avoid === t.key || p.avoid.startsWith(`${t.key}_`)
            );
            if (byAvoid) return byAvoid;
        }
        if (p.name) {
            return ObstacleAvoidanceTemplateData.find(t => t.name === p.name);
        }
        return undefined;
    };

    // 编辑态回填 / 新增态重置
    useEffect(() => {
        if (!open) return;
        if (updateRecord) {
            form.setFieldsValue({ obstacleAvoidanceName: updateRecord.obstacleAvoidanceName });
            const keys: string[] = [];
            const configs: Record<string, ParamConfig> = {};
            const customs: Record<string, AvoidItem[]> = {};
            (updateRecord.parameters || []).forEach(p => {
                const tpl = findTemplate(p);
                if (!tpl) return;
                if (keys.includes(tpl.key)) return;
                keys.push(tpl.key);

                let avoidValue: string | undefined;
                const avoidValid = tpl.avoidList.some(a => a.value === p.avoid);
                if (avoidValid) {
                    avoidValue = p.avoid;
                } else if (p.avoid && p.avoid.startsWith(`${tpl.key}_index_`)) {
                    // 历史保存的自定义项：按 key_index_N 规则还原
                    const idx = Number(p.avoid.slice(`${tpl.key}_index_`.length));
                    if (Number.isFinite(idx) && idx >= 0) {
                        if (!customs[tpl.key]) customs[tpl.key] = [];
                        if (!customs[tpl.key].some(i => i.value === p.avoid)) {
                            customs[tpl.key].push({
                                value: p.avoid,
                                label: idx === 0 ? t("默认") : t("自定义{index}", { index: idx })
                            });
                        }
                        avoidValue = p.avoid;
                    }
                }
                configs[tpl.key] = {
                    avoid: avoidValue ?? tpl.avoidList[0]?.value,
                    enable: !!p.enable
                };
            });
            setTargetKeys(keys);
            setParamConfigs(configs);
            setCustomAvoidItems(customs);
        } else {
            form.resetFields();
            setTargetKeys([]);
            setParamConfigs({});
            setCustomAvoidItems({});
        }
        setSelectedKeys([]);
    }, [open, updateRecord]);

    // Transfer 移动事件：右移时为新项初始化默认配置，左移时清理
    const onTransferChange: TransferProps["onChange"] = (nextTargetKeys, direction, moveKeys) => {
        const keys = nextTargetKeys as string[];
        setTargetKeys(keys);
        if (direction === "right") {
            setParamConfigs(prev => {
                const next = { ...prev };
                (moveKeys as string[]).forEach(key => {
                    if (!next[key]) {
                        const tpl = templateMap[key];
                        next[key] = {
                            avoid: tpl?.avoidList?.[0]?.value,
                            enable: false
                        };
                    }
                });
                return next;
            });
        } else if (direction === "left") {
            setParamConfigs(prev => {
                const next = { ...prev };
                (moveKeys as string[]).forEach(key => { delete next[key]; });
                return next;
            });
            setCustomAvoidItems(prev => {
                const next = { ...prev };
                (moveKeys as string[]).forEach(key => { delete next[key]; });
                return next;
            });
        }
    };

    const onTransferSelectChange: TransferProps["onSelectChange"] = (sourceKeys, targetSelected) => {
        setSelectedKeys([...(sourceKeys as string[]), ...(targetSelected as string[])]);
    };

    const updateParamConfig = (key: string, patch: Partial<ParamConfig>) => {
        setParamConfigs(prev => ({
            ...prev,
            [key]: { ...prev[key], enable: prev[key]?.enable ?? false, ...patch }
        }));
    };

    // 从已选模板中移除一项：效果等同于 Transfer 的"移除"
    const removeTemplate = (key: string) => {
        setTargetKeys(prev => prev.filter(k => k !== key));
        setSelectedKeys(prev => prev.filter(k => k !== key));
        setParamConfigs(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        setCustomAvoidItems(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    // 为指定模板追加一个自定义避障项
    // 遵循数据源规则：value = `${key}_index_${nextIndex}`，nextIndex 为当前总长度
    const addCustomAvoidItem = (templateKey: string, label: string) => {
        const trimmed = label.trim();
        if (!trimmed) return;
        const baseList = templateMap[templateKey]?.avoidList || [];
        setCustomAvoidItems(prev => {
            const extra = prev[templateKey] || [];
            const nextIndex = baseList.length + extra.length;
            const value = `${templateKey}_index_${nextIndex}`;
            return { ...prev, [templateKey]: [...extra, { value, label: trimmed }] };
        });
    };

    // 新增
    const handleCreateObstacle = (data: ObstacleRecord) => {
        createObstacleAvoidance(data).then(res => {
            if (res.code === 200 && res?.message === "success") {
                closeAndReset();
                getObstacleAvoidance();
                message.success(t("创建避障数据成功"));
            } else {
                message.warning(t("创建避障数据出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("创建避障数据出错") + err?.message);
            }
        });
    };

    // 更新
    const handleUpdateObstacle = (data: ObstacleRecord) => {
        updateObstacleAvoidance(data).then(res => {
            if (res.code === 200 && res?.message === "success") {
                closeAndReset();
                getObstacleAvoidance();
                message.success(t("更新避障数据成功"));
            } else {
                message.warning(t("更新避障数据出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("更新避障数据出错") + err?.message);
            }
        });
    };

    const handleOk = async () => {
        try {
            await form.validateFields();
        } catch {
            return;
        }
        if (targetKeys.length === 0) {
            message.warning(t("请至少选择一项避障模板"));
            return;
        }
        for (const key of targetKeys) {
            const tpl = templateMap[key];
            if (!paramConfigs[key]?.avoid) {
                message.warning(t('请为"{name}"选择避障参数类型', { name: t(tpl?.name || key) }));
                return;
            }
        }
        const values = form.getFieldsValue();
        const parameters: ObstacleParameters[] = targetKeys.map(key => ({
            name: templateMap[key]?.name || key,
            avoid: paramConfigs[key].avoid as string,
            enable: !!paramConfigs[key].enable
        }));
        const data: ObstacleRecord = {
            ...(updateRecord || {}),
            obstacleAvoidanceName: values.obstacleAvoidanceName,
            parameters
        };
        if (updateRecord) {
            handleUpdateObstacle(data);
        } else {
            handleCreateObstacle(data);
        }
    };

    const closeAndReset = () => {
        form.resetFields();
        setTargetKeys([]);
        setSelectedKeys([]);
        setParamConfigs({});
        setCustomAvoidItems({});
        setUpdateRecord(undefined);
        setOpenModal(false);
    };

    const handleCancel = () => {
        closeAndReset();
    };

    const paramColumns = [
        {
            title: t("避障名称"),
            dataIndex: "name",
            width: 200,
            ellipsis: { showTitle: true }
        },
        {
            title: t("避障参数类型"),
            dataIndex: "avoid",
            width: 200,
            render: (_: unknown, record: { key: string }) => (
                <AvoidParamSelect
                    baseList={templateMap[record.key]?.avoidList || []}
                    extraList={customAvoidItems[record.key] || []}
                    value={paramConfigs[record.key]?.avoid}
                    onChange={value => updateParamConfig(record.key, { avoid: value })}
                    onAddItem={label => addCustomAvoidItem(record.key, label)}
                />
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("是否启用"),
            dataIndex: "enable",
            width: 100,
            render: (_: unknown, record: { key: string }) => (
                <Switch
                    checked={!!paramConfigs[record.key]?.enable}
                    onChange={checked => updateParamConfig(record.key, { enable: checked })}
                />
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            dataIndex: "action",
            width: 80,
            render: (_: unknown, record: { key: string }) => (
                <Button type="link" danger size="small" onClick={() => removeTemplate(record.key)}>
                    {t("移除")}
                </Button>
            ),
            ellipsis: { showTitle: true }
        }
    ];

    const tableData = targetKeys.map(key => ({ key, name: t(templateMap[key]?.name || key) }));

    return (
        <Modal
            title={updateRecord ? t("编辑避障模板") : t("新增避障模板")}
            open={open}
            width={1000}
            onOk={handleOk}
            onCancel={handleCancel}
            destroyOnClose
            okText={t("确定")}
            cancelText={t("取消")}
        >
            <Form
                name="obstacle-template-form"
                labelCol={{ span: 4 }}
                wrapperCol={{ span: 20 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item
                    label={t("避障名称")}
                    name="obstacleAvoidanceName"
                    rules={[{ required: true, message: t("请输入避障名称") }]}
                >
                    <Input maxLength={64} placeholder={t("请输入避障名称")} />
                </Form.Item>

                <Form.Item label={t("选择模板")} required>
                    <Transfer
                        dataSource={transferData}
                        titles={[t("可选模板"), t("已选模板")]}
                        operations={[t("添加"), t("移除")]}
                        targetKeys={targetKeys}
                        selectedKeys={selectedKeys}
                        onChange={onTransferChange}
                        onSelectChange={onTransferSelectChange}
                        render={item => item.title}
                        listStyle={{ width: 400, height: 320 }}
                        showSearch={{ placeholder: t("搜索模板名称") }}
                        locale={{ itemUnit: t("项"), itemsUnit: t("项") }}
                    />
                </Form.Item>

                <Form.Item label={t("参数配置")}>
                    <div style={{ height: 280 }}>
                        <Table
                            rowKey="key"
                            size="small"
                            columns={paramColumns}
                            dataSource={tableData}
                            pagination={false}
                            scroll={{ y: 260 }}
                        />
                    </div>
                </Form.Item>
            </Form>
        </Modal>
    );
};
