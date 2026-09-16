/**
 * @description 启用编辑状态组件 有保存，退出
 * @date 2025-7-11
 * @summary 地图中所有标识属性为enableSelect="node"的即为需要保存的节点，除此之外的节点不保存
 * @summary 地图中表示为enableSelect="edge"的即为需要保存的路径，除此之外不保存
 */
import { useState, memo, useEffect, useRef } from "react";
import { history } from "@umijs/max";
import { ExclamationCircleFilled } from "@ant-design/icons";
import { Button, message, Modal } from "antd";
import { CreditCardOutlined, SaveOutlined, LogoutOutlined } from "@ant-design/icons";
import styles from "./index.less";
import Konva from "konva";
import { updateMapInfoVersionJson } from "@/api";
import type { MapInfoVersionJsonParam } from "@/types/MapVersion";
import { computeEdgeLength, setNodeDraggable } from "@/utils/graph";
import type { NodeEdgeGroup } from "@/types/MapNestModify";
import SaveRemarkModal from "./SaveRemarkModal";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

const { confirm } = Modal;

interface EnableModifyProps {
    stage: Konva.Stage | null;
    useMapId: string;
    /** 当前选中的地图版本 ID */
    useMapVersionId: number | undefined;
    enableModify: boolean;
    trafficGroups: NodeEdgeGroup[];
    exclusiveGroups: NodeEdgeGroup[];
    setManualKey: (value: React.SetStateAction<string>) => void;
    setEnableModify: (value: React.SetStateAction<boolean>) => void;
    /** 保存成功后更新版本选择（后端创建了新版本，需刷新列表并选中第一条） */
    setUseMapVersionId: (value: React.SetStateAction<number | undefined>) => void;
}

export default memo((props: EnableModifyProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { stage, useMapId, useMapVersionId, enableModify, trafficGroups, exclusiveGroups, setManualKey, setEnableModify, setUseMapVersionId } = props;

    /*
     * 编辑权限判定（SPEC §7.6 / G1）
     * 后端 map-edit 下仅有 map-edit:update 一个按钮码，此处用于控制「启用编辑」入口。
     * enableModify 是编辑器总开关——setEnableModify(true) 全仓仅本组件「启用编辑」按钮调用，
     * 故控住该按钮即关闭属性面板 / 工具栏 / 右键菜单 / 节点拖拽等全部写入口（等价全局只读）。
     * canEdit 会话期间稳定（权限下次登录生效 B15），直接判定无需缓存。
     */
    const { hasPerm } = useAccess();
    const canEdit = hasPerm(PERM_BUTTON.MAP_EDIT_UPDATE);

    // 保存的加载状态
    const [saveLoading, setSaveLoading] = useState<boolean>(false);
    // 备注弹窗是否可见
    const [remarkModalOpen, setRemarkModalOpen] = useState<boolean>(false);

    // 离开的监听对象
    const unblock = useRef<Function | undefined>(undefined);

    const handleEnableModify = () => {
        if (!useMapId) {
            message.warning(t("请选择需要编辑的地图"));
            return;
        }
        setEnableModify(true);
        setNodeDraggable(stage);
    };

    // 退出编辑模式
    const handleLeaveModify = () => {
        // 还原操作项
        setManualKey("");
        setEnableModify(false);
    };

    const validateEdgeNames = (edgeShapes: Konva.Shape[]): string | null => {
        const names: string[] = [];
        for (const shape of edgeShapes) {
            const name = shape.attrs.data?.name;
            if (!name || !name.trim()) {
                return t("路径({id})的名称不能为空", { id: shape.attrs.id });
            }
            if (names.includes(name)) {
                return t("路径名称「{name}」存在重复", { name });
            }
            names.push(name);
        }
        return null;
    };

    /**
     * 校验路径自定义动作参数的完整性
     * 每个 action 必须有 actionType、actionDescription、blockingType
     * 如果存在 actionParameters，每个参数对象必须有 key 和 value
     */
    const validateEdgeActions = (edgeShapes: Konva.Shape[]): string[] => {
        const errors: string[] = [];
        for (const shape of edgeShapes) {
            const actions = shape.attrs.data?.actions;
            if (!actions || !Array.isArray(actions) || actions.length === 0) continue;
            const edgeName = shape.attrs.data?.name || shape.attrs.id;
            for (let i = 0; i < actions.length; i++) {
                const action = actions[i];
                if (!action) {
                    errors.push(t("路径「{name}」的第{index}个自定义动作数据不完整", { name: edgeName, index: i + 1 }));
                    continue;
                }
                if (!action.actionType || !String(action.actionType).trim()) {
                    errors.push(t("路径「{name}」的第{index}个自定义动作缺少「动作类型」", { name: edgeName, index: i + 1 }));
                }
                if (!action.actionDescription || !String(action.actionDescription).trim()) {
                    errors.push(t("路径「{name}」的第{index}个自定义动作缺少「动作描述」", { name: edgeName, index: i + 1 }));
                }
                if (!action.blockingType || !String(action.blockingType).trim()) {
                    errors.push(t("路径「{name}」的第{index}个自定义动作缺少「阻塞类型」", { name: edgeName, index: i + 1 }));
                }
                if (action.actionParameters && Array.isArray(action.actionParameters)) {
                    for (let j = 0; j < action.actionParameters.length; j++) {
                        const param = action.actionParameters[j];
                        if (!param || !param.key || !String(param.key).trim()) {
                            errors.push(t("路径「{name}」的第{i}个自定义动作的第{j}个参数缺少「参数名」", { name: edgeName, i: i + 1, j: j + 1 }));
                        }
                        if (param.value === undefined || param.value === null || !String(param.value).trim()) {
                            errors.push(t("路径「{name}」的第{i}个自定义动作的第{j}个参数缺少「参数值」", { name: edgeName, i: i + 1, j: j + 1 }));
                        }
                    }
                }
            }
        }
        return errors;
    };

    // 暂时屏蔽三方设备动作校验函数（调用点已同步注释，恢复时两处一起取消注释即可，文案已国际化）
    // /**
    //  * 校验三方设备申请/释放动作的完整性
    //  * 展示条件与 ApplyDeviceOperationType / ReleaseDeviceOperationType 完全一致：
    //  *   当 deviceType 有值、deviceType !== "chargePile"、deviceKey 有值，三者同时满足时，
    //  *   才展示申请动作(applyDeviceOperationType)与释放动作(releaseDeviceOperationType)，
    //  *   此时两者均必填。若漏配会导致调度交管缺失设备动作指令，引发碰撞/死锁等安全隐患。
    //  * 三方设备可能配置在节点或路径上，故 nodes 与 edges 都需校验。
    //  */
    // const validateThirdDeviceActions = (shapes: Konva.Shape[]): string[] => {
    //     const errors: string[] = [];
    //     for (const shape of shapes) {
    //         const udp = shape.attrs.data?.userDefinedProperties;
    //         // 未配置三方设备的元素直接跳过
    //         if (!udp) continue;
    //         const { deviceType, deviceKey, applyDeviceOperationType, releaseDeviceOperationType } = udp;
    //         // 严格复刻展示条件：仅当三者同时满足时才校验申请/释放动作
    //         if (!deviceType || deviceType === "chargePile" || !deviceKey) continue;
    //         const shapeName = shape.attrs.data?.name || shape.attrs.id;
    //         if (!applyDeviceOperationType || !String(applyDeviceOperationType).trim()) {
    //             errors.push(t("「{name}」已配置三方设备但缺少「申请动作」，请补全后再保存", { name: shapeName }));
    //         }
    //         if (!releaseDeviceOperationType || !String(releaseDeviceOperationType).trim()) {
    //             errors.push(t("「{name}」已配置三方设备但缺少「释放动作」，请补全后再保存", { name: shapeName }));
    //         }
    //     }
    //     return errors;
    // };

    // 点击保存，校验通过后打开备注弹窗
    const handleSaveStage = () => {
        if (!stage) return;
        // 地图中所有标识属性为enableSelect="node"的即为需要保存的节点，除此之外的节点不保存
        const nodeShapes: Konva.Shape[] = stage.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "node");
        // 地图中表示为enableSelect="edge"的即为需要保存的路径，除此之外不保存
        const edgeShapes: Konva.Shape[] = stage.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "edge");
        const edgeNameError = validateEdgeNames(edgeShapes);
        if (edgeNameError) {
            message.warning(edgeNameError);
            return;
        }
        const edgeActionErrors = validateEdgeActions(edgeShapes);
        if (edgeActionErrors.length > 0) {
            Modal.warning({
                title: t("自定义动作参数校验失败"),
                width: 600,
                content: (
                    <div style={{ maxHeight: 300, overflow: "auto" }}>
                        {edgeActionErrors.map((err, idx) => (
                            <div key={idx}>{idx + 1}. {err}</div>
                        ))}
                    </div>
                ),
            });
            return;
        }
        // 暂时屏蔽三方设备动作校验（后续如需恢复，取消下方注释并恢复上方 validateThirdDeviceActions 函数即可）
        // // 校验三方设备：选了设备类型与设备 Key 后，申请动作与释放动作必填
        // const thirdDeviceErrors = validateThirdDeviceActions([...nodeShapes, ...edgeShapes]);
        // if (thirdDeviceErrors.length > 0) {
        //     Modal.warning({
        //         title: t("三方设备动作校验失败"),
        //         width: 600,
        //         content: (
        //             <div style={{ maxHeight: 300, overflow: "auto" }}>
        //                 {thirdDeviceErrors.map((err, idx) => (
        //                     <div key={idx}>{idx + 1}. {err}</div>
        //                 ))}
        //             </div>
        //         ),
        //     });
        //     return;
        // }
        // 校验通过，打开备注弹窗
        setRemarkModalOpen(true);
    };

    /**
     * 确认保存：从弹窗获取备注和是否发布，构建参数，调用 updateMapInfoVersionJson
     * 保存成功后退出编辑模式，刷新版本列表（通过重置 useMapVersionId 触发）
     */
    const handleConfirmSave = (remark: string, publish: boolean) => {
        if (!stage || !useMapVersionId) return;
        const nodeShapes: Konva.Shape[] = stage.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "node");
        const edgeShapes: Konva.Shape[] = stage.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "edge");

        const param: MapInfoVersionJsonParam = {
            mapVersionId: useMapVersionId,
            mapRemark: remark,
            publish,
            nodes: [],
            edges: [],
            zones: [],
            // NodeEdgeGroup 与 MapVersionNodeEdgeGroup 的 userDefinedProperties 可选性不同，运行时结构一致
            nodeEdgeGroups: [...trafficGroups, ...exclusiveGroups] as any[]
        };
        // 保存节点
        nodeShapes.forEach(shape => {
            const { attrs: { id, x, y, data: { angle, arrowPoints, ...rest } } } = shape;
            param.nodes.push({
                ...rest,
                id,
                angle: angle === null ? null : angle,
                x,
                y: -y
            })
        })
        // 保存路径
        edgeShapes.forEach(shape => {
            const { id, data: { arrowPoints, labelX, labelY, ...rest } } = shape.attrs;
            const length = computeEdgeLength(shape);
            param.edges.push({
                ...rest,
                id,
                sfacing: null,
                efacing: null,
                cost: length
            });
        })
        setSaveLoading(true);
        updateMapInfoVersionJson(param).then(res => {
            if (res.code === 200 && res.message === "success") {
                setEnableModify(false);
                // 还原操作项
                setManualKey("");
                setRemarkModalOpen(false);
                message.success(t("保存成功"));
                /**
                 * 保存成功后重置版本 ID 为 undefined
                 * VersionSelect 会重新加载版本列表并自动选中第一条（即刚创建的新版本）
                 */
                setUseMapVersionId(undefined);
            } else {
                message.warning(t("保存出错") + res?.message);
            }
            setSaveLoading(false);
        }).catch(err => {
            if (err) {
                setSaveLoading(false);
                message.error(t("保存出错") + err?.message);
            }
        })
    };

    // 离开前确认修改已保存
    useEffect(() => {
        if (!enableModify) return;
        if (!unblock.current) {
            unblock.current = history.block((transition) => {
                confirm({
                    title: t("确定离开当前页面吗?"),
                    icon: <ExclamationCircleFilled />,
                    content: t("系统可能不会保存您所做的更改"),
                    onOk() {
                        unblock.current && unblock.current();
                        transition.retry();
                    },
                    onCancel() {
                        //
                    },
                });
            });
        }
    }, [enableModify])

    return (
        <div className={styles.enable_modify}>
            <SaveRemarkModal
                open={remarkModalOpen}
                onConfirm={handleConfirmSave}
                onCancel={() => setRemarkModalOpen(false)}
                confirmLoading={saveLoading}
            />
            {
                enableModify ? (
                    <div className={styles.operates}>
                        <Button
                            type="primary"
                            block
                            icon={<SaveOutlined />}
                            loading={saveLoading}
                            onClick={handleSaveStage}
                        >
                            {t("保存")}
                        </Button>
                        <Button
                            type="primary"
                            block
                            danger
                            icon={<LogoutOutlined />}
                            onClick={handleLeaveModify}
                        >
                            {t("暂存")}
                        </Button>
                    </div>
                ) : canEdit ? (
                    <Button
                        type="primary"
                        block
                        icon={<CreditCardOutlined />}
                        onClick={handleEnableModify}
                    >
                        {t("启用编辑")}
                    </Button>
                ) : (
                    // 无 map-edit:update 权限：禁用「启用编辑」入口并提示，保留占位避免面板空洞（§7 状态展示型分支）
                    <Button
                        type="primary"
                        block
                        disabled
                        icon={<CreditCardOutlined />}
                    >
                        {t("无编辑权限")}
                    </Button>
                )
            }
        </div>
    )
});
