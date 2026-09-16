/**
 * @description 调度配置的界面
 * @date 2025-6-9
 */
import { useState, useEffect, Suspense } from "react";
import { message, Result, Tabs, Button, Space, Modal, Spin } from "antd";
import { SaveFilled, RedoOutlined, ExclamationCircleFilled } from "@ant-design/icons";
import type { TabsProps } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { getTaskConfigs, batchEditConfigs } from "@/api";
import type { StrategyConfigTypes, EditConfigParams } from "@/types/DispatchHub/typing";
import DispatchTable from "./DispatchTable";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

const { confirm } = Modal;

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();
/* 按钮级权限判定（调度中心 保存/重置） */ const { hasPerm } = useAccess();

    // 当前激活的面板keys
    const [activeKey, setActiveKey] = useState<string>("");
    // 面板的数据
    const [tabItems, setTabItems] = useState<TabsProps["items"]>([]);
    // 配置数据
    const [dispatchConfigs, setDispatchConfigs] = useState<StrategyConfigTypes[]>([]);

    const renderChildConfigTable = (data: StrategyConfigTypes[]) => {
        if (!data?.length) return [];
        const items: TabsProps["items"] = data.map(cfg => ({
            key: cfg.configType,
            label: cfg.configTypeName,
            children: (
                <DispatchTable
                    data={cfg.childTaskConfigs}
                    setDispatchConfigs={setDispatchConfigs}
                />
            )
        }));
        setTabItems(items);
    };

    // 查询表格数据
    const getTaskConfigsData = () => {
        getTaskConfigs().then(res => {
            if (res.code === 200 && res.message === "success") {
                !!!activeKey && setActiveKey(res?.data?.[0]?.configType || "");
                setDispatchConfigs(res?.data);
            } else {
                message.warning(t("查询调度配置出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询调度配置出错") + err?.message);
            }
        })
    };

    const onTabsChange: TabsProps["onChange"] = (value) => {
        setActiveKey(value);
    };

    // 批量编辑的请求
    const batchSaveRequest = (data: EditConfigParams[]) => {
        batchEditConfigs(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("保存调度参数成功"));
                getTaskConfigsData();
            } else {
                message.warning(t("保存调度参数出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("保存调度参数出错") + err?.message);
            }
        })
    };

    // 批量编辑配置
    const handleBatchSave = () => {
        confirm({
            title: t("确定保存当前页调度参数吗?"),
            icon: <ExclamationCircleFilled />,
            content: t("保存前请确认参数"),
            onOk() {
                const data: EditConfigParams[] = [];
                dispatchConfigs.forEach(configs => {
                    const { configType, childTaskConfigs } = configs;
                    if (configType === activeKey) {
                        childTaskConfigs.forEach(cfgs => {
                            const { configKey, configValue, configValueType } = cfgs;
                            data.push({
                                configKey,
                                configValue: configValueType === "select" ? (configValue as unknown as string[]).join(";") : String(configValue)
                            });
                        })
                    }
                })
                batchSaveRequest(data);
            },
            onCancel() {
                // .
            },
        });
    };

    // 把所有的配置都设置成默认值
    const handleResetConfigs = () => {
        confirm({
            title: t("确定要重置当前页调度参数吗?"),
            icon: <ExclamationCircleFilled />,
            content: t("重置数据后无法恢复"),
            onOk() {
                // 点击确定
                const data: EditConfigParams[] = [];
                dispatchConfigs.forEach(configs => {
                    const { configType, childTaskConfigs } = configs;
                    if (configType === activeKey) {
                        childTaskConfigs.forEach(cfgs => {
                            const { configKey, defaultConfigValue } = cfgs;
                            data.push({
                                configKey,
                                configValue: defaultConfigValue
                            });
                        })
                    }
                })
                batchSaveRequest(data);
            },
            onCancel() {
                // .
            },
        });

    };

    useEffect(() => {
        getTaskConfigsData();
    }, [])

    useEffect(() => {
        renderChildConfigTable(dispatchConfigs);
    }, [dispatchConfigs])

    return (
        <>
            <Suspense
                fallback={
                    <Spin />
                }
            >
                <Tabs
                    style={{ padding: 20 }}
                    activeKey={activeKey}
                    items={tabItems}
                    tabBarExtraContent={{
                        right: (
                            <Space>
                                {/* 保存调度参数：无 dispatch-hub:save 权限时隐藏入口 */}
                                {hasPerm(PERM_BUTTON.DISPATCH_HUB_SAVE) && (
                                    <Button
                                        type="primary"
                                        icon={<SaveFilled />}
                                        onClick={handleBatchSave}
                                    >
                                        {t("保存")}
                                    </Button>
                                )}
                                {/* 重置调度参数：无 dispatch-hub:reset 权限时隐藏入口 */}
                                {hasPerm(PERM_BUTTON.DISPATCH_HUB_RESET) && (
                                    <Button
                                        danger
                                        icon={<RedoOutlined />}
                                        onClick={handleResetConfigs}
                                    >
                                        {t("重置")}
                                    </Button>
                                )}
                            </Space>
                        )
                    }}
                    onChange={onTabsChange}
                />
            </Suspense>
        </>
    )
};
