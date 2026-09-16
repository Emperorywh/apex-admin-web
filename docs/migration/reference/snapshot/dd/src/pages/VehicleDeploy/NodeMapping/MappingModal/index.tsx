/**
 * @description AGV节点映射的新增/编辑弹窗
 * 万行级交互与性能设计见 docs/SPEC_node_mapping.md §4.7
 * @date 2026-08-18
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Form, Input, InputNumber, Select, Button, Table, Card, Checkbox, Popconfirm, Tooltip, Space, message } from "antd";
import { PlusOutlined, DeleteOutlined, EnvironmentOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import styles from "./index.less";
import MapPickerModal from "./MapPickerModal";
import {
    getSimpleMaps,
    getSimpleVehicles,
    getMapInfo,
    saveAGVNodeMapping,
    updateAGVNodeMapping,
    getSuggestionsForCollectionNodes,
} from "@/api";
import type {
    AGVNodeMapping,
    MappingNode,
    MappingPoint,
    MapNodeMapping,
} from "@/types/VehicleDeploy/NodeMappingType";
import type { SimpleMap } from "@/types/MultipleMaps";
import type { SimpleVehicle } from "@/types/VehicleDeploy/GroupType";
import { useI18n } from "@/hooks/useI18n";

/**
 * 映射行草稿（前端编辑态，rowKey 仅用于渲染标识）
 * 导出供 MapPickerModal 共享（同特性目录内的草稿类型）
 */
export interface MappingRowDraft {
    rowKey: string;
    /** 选中节点后整体回填 {nodeId,nodeName,x,y}，后端 MappingNode 需要节点坐标 */
    mapNode?: MappingNode;
    /** 映射点坐标 */
    mappingPoint?: MappingPoint;
}

/**
 * 地图组草稿（按地图分组的映射行集合）
 */
export interface MapGroupDraft {
    groupKey: string;
    mapId?: string;
    /** 保存接口需要地图名称，选地图时一并记录 */
    mapName?: string;
    /** 「获取建议」的期望点位数量（可选，不传由后端自动计算预算） */
    expectedCount?: number;
    rows: MappingRowDraft[];
}

/**
 * 组内视图状态（搜索关键字/只看未填完整/前端分页）
 * 纯 UI 状态，按 groupKey 索引独立存放，不进入提交数据；
 * 删除行/清空等操作始终作用于完整 rows，与过滤无关
 */
interface GroupViewState {
    keyword: string;
    onlyInvalid: boolean;
    /** 前端分页页码 */
    pageNo: number;
    /** 每页条数 */
    pageSize: number;
}

/**
 * 组内视图状态默认值：组首次操作过滤/分页时以此打底
 */
const DEFAULT_GROUP_VIEW: GroupViewState = { keyword: "", onlyInvalid: false, pageNo: 1, pageSize: 10 };

/**
 * 节点下拉选项：附带原始节点对象（含坐标），选中时免二次查找直接整体回填
 */
interface NodeOption {
    value: string;
    label: string;
    node: MappingNode;
}

/**
 * 行是否完全空白（未选节点且坐标均未填）：视为占位行，提交时自动剔除，不高亮不报错
 */
const isRowBlank = (r: MappingRowDraft) =>
    !r.mapNode?.nodeId
    && typeof r.mappingPoint?.x !== "number"
    && typeof r.mappingPoint?.y !== "number";

/**
 * 行是否填写完整：已选节点且映射点 x/y 均为数字
 */
const isRowComplete = (r: MappingRowDraft) =>
    !!r.mapNode?.nodeId
    && typeof r.mappingPoint?.x === "number"
    && typeof r.mappingPoint?.y === "number";

/**
 * 半填行（非空白但不完整）：常显淡红高亮，提交校验拦截
 */
const isRowPartial = (r: MappingRowDraft) => !isRowBlank(r) && !isRowComplete(r);

interface MappingModalProps {
    open: boolean;
    isModify: boolean;
    modifyRow?: AGVNodeMapping;
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
    getMappings: () => void;
}

export default (props: MappingModalProps) => {

    const { open, isModify, modifyRow, setOpenModal, getMappings } = props;
    /* 国际化翻译方法 */ const { t } = useI18n();

    const [form] = Form.useForm();

    /**
     * 简单地图列表（地图组的选择项）
     */
    const [simpleMaps, setSimpleMaps] = useState<SimpleMap[]>([]);
    /**
     * 简单车辆列表（关联AGV的选择项）
     */
    const [simpleVehicles, setSimpleVehicles] = useState<SimpleVehicle[]>([]);
    /**
     * 地图组草稿列表（本地 state 驱动：组内是动态表格，受控 state 比 Form.List 更直观）
     */
    const [groups, setGroups] = useState<MapGroupDraft[]>([]);
    /**
     * 组内视图状态（搜索/只看未填完整），纯 UI 状态，不进提交数据
     */
    const [groupViews, setGroupViews] = useState<Record<string, GroupViewState>>({});
    /**
     * 各地图的节点选项缓存（mapId -> MappingNode[]），避免重复拉取地图数据
     */
    const [mapNodesMap, setMapNodesMap] = useState<Record<string, MappingNode[]>>({});
    /**
     * 缓存的 ref 镜像：loadMapNodes 的去重判断需要同步读取，state 闭包可能过期
     */
    const mapNodesRef = useRef<Record<string, MappingNode[]>>({});
    /**
     * 「获取建议」按钮的加载状态（按组标识）
     */
    const [suggestionLoading, setSuggestionLoading] = useState<Record<string, boolean>>({});
    /**
     * 提交中状态（控制确认按钮 loading，防止重复提交）
     */
    const [submitting, setSubmitting] = useState<boolean>(false);
    /**
     * 选点目标行：null 表示弹窗关闭；弹窗打开期间外层 Modal 被遮罩阻隔，行数据不会变化
     */
    const [pickerTarget, setPickerTarget] = useState<{ groupKey: string; rowKey: string } | null>(null);

    /**
     * 行/组标识自增序列：保证同一弹窗生命周期内 key 唯一
     */
    const keySeq = useRef(0);
    const nextKey = (prefix: string) => `${prefix}_${keySeq.current++}`;

    /**
     * 各地图节点选项缓存：label 一次算好，nodeId 同步建 Set 供 O(1) 存在性判定
     * （替代逐行 fetched.some 的 O(行数×节点数) 比较，万行万节点下每次渲染可达上亿次）
     */
    const nodeOptionCache = useMemo(() => {
        const options: Record<string, NodeOption[]> = {};
        const idSets: Record<string, Set<string>> = {};
        for (const [mapId, nodes] of Object.entries(mapNodesMap)) {
            options[mapId] = nodes.map(n => ({
                value: n.nodeId!,
                label: `${n.nodeName}（${n.nodeId}）`,
                node: n,
            }));
            idSets[mapId] = new Set(nodes.map(n => n.nodeId!));
        }
        return { options, idSets };
    }, [mapNodesMap]);

    /**
     * 拉取指定地图的节点列表并转换为 MappingNode 缓存
     * 地图数据结构：res.data.currentMapInfoVersion.mapJson.nodes（节点 id/name/x/y）
     */
    const loadMapNodes = (mapId: string) => {
        if (!mapId || mapNodesRef.current[mapId]) return;
        /* 先占位防止同一地图并发重复请求，失败时删除占位以允许重试 */
        mapNodesRef.current[mapId] = [];
        getMapInfo({ mapId }).then(res => {
            if (res.code === 200 && res.message === "success") {
                const mapJson = res.data?.currentMapInfoVersion?.mapJson as
                    | { nodes?: Array<{ id: string; name: string; x: number; y: number }> }
                    | undefined;
                const mapped: MappingNode[] = (mapJson?.nodes ?? []).map(node => ({
                    nodeId: node.id,
                    nodeName: node.name,
                    x: node.x,
                    y: node.y,
                }));
                mapNodesRef.current[mapId] = mapped;
                setMapNodesMap({ ...mapNodesRef.current });
            } else {
                delete mapNodesRef.current[mapId];
                message.warning(t("获取地图节点失败") + res?.message);
            }
        }).catch(err => {
            delete mapNodesRef.current[mapId];
            if (err) {
                message.error(t("获取地图节点失败") + err?.message);
            }
        });
    };

    /**
     * 更新指定组的字段
     */
    const patchGroup = (groupKey: string, patch: Partial<MapGroupDraft>) => {
        setGroups(prev => prev.map(g => (g.groupKey === groupKey ? { ...g, ...patch } : g)));
    };

    /**
     * 更新指定组的视图状态（搜索关键字/只看未填完整）
     */
    const patchGroupView = (groupKey: string, patch: Partial<GroupViewState>) => {
        setGroupViews(prev => {
            /* 组尚无视图状态时用默认值打底（首次操作过滤/分页的组） */
            const current: GroupViewState = prev[groupKey] ?? DEFAULT_GROUP_VIEW;
            return { ...prev, [groupKey]: { ...current, ...patch } };
        });
    };

    /**
     * 更新指定行的字段
     */
    const patchRow = (groupKey: string, rowKey: string, patch: Partial<MappingRowDraft>) => {
        setGroups(prev => prev.map(g => (
            g.groupKey === groupKey
                ? { ...g, rows: g.rows.map(r => (r.rowKey === rowKey ? { ...r, ...patch } : r)) }
                : g
        )));
    };

    /**
     * 组内选择地图：记录 mapName 供保存接口使用，并重置映射行与过滤状态
     * （旧地图的节点选择对新地图无意义，保留会造成脏数据）
     */
    const onGroupMapChange = (groupKey: string, mapId: string) => {
        const mapName = simpleMaps.find(m => m.mapId === mapId)?.mapName;
        patchGroup(groupKey, { mapId, mapName, rows: [{ rowKey: nextKey("r") }] });
        patchGroupView(groupKey, { keyword: "", onlyInvalid: false });
        loadMapNodes(mapId);
    };

    /**
     * 组的节点选项：已拉取节点 + 行内已选节点的并集
     * 编辑回填的行可能引用地图上已删除的节点，合并进行内节点保证名称可显示（SPEC §4.3）；
     * extras 用 Set 判定 + seen 去重，整体 O(行数)
     */
    const getGroupOptions = (group: MapGroupDraft): NodeOption[] => {
        const base = nodeOptionCache.options[group.mapId ?? ""] ?? [];
        const idSet = nodeOptionCache.idSets[group.mapId ?? ""];
        const extras: NodeOption[] = [];
        const seen = new Set<string>();
        for (const r of group.rows) {
            const n = r.mapNode;
            if (n?.nodeId && !idSet?.has(n.nodeId) && !seen.has(n.nodeId)) {
                seen.add(n.nodeId);
                extras.push({ value: n.nodeId, label: `${n.nodeName}（${n.nodeId}）`, node: n });
            }
        }
        return extras.length ? [...base, ...extras] : base;
    };

    /**
     * 组的行视图：一次 O(行数) 遍历同时产出过滤结果、原始行号映射、半填行计数
     * 过滤是纯视图行为（搜索节点名称/ID、只看未填完整），不改动 group.rows
     */
    const getGroupRowView = (group: MapGroupDraft) => {
        const view = groupViews[group.groupKey];
        const keyword = view?.keyword?.trim().toLowerCase() ?? "";
        const onlyInvalid = view?.onlyInvalid ?? false;
        const filteredRows: MappingRowDraft[] = [];
        const indexMap = new Map<string, number>();
        let invalidCount = 0;
        group.rows.forEach((r, i) => {
            indexMap.set(r.rowKey, i);
            if (isRowPartial(r)) invalidCount++;
            /* 「只看未填完整」显示所有非完整行（半填 + 空白占位），完整行才跳过 */
            if (onlyInvalid && isRowComplete(r)) return;
            if (keyword) {
                const name = r.mapNode?.nodeName?.toLowerCase() ?? "";
                const id = r.mapNode?.nodeId?.toLowerCase() ?? "";
                if (!name.includes(keyword) && !id.includes(keyword)) return;
            }
            filteredRows.push(r);
        });
        return { filteredRows, indexMap, invalidCount, hasFilter: !!keyword || onlyInvalid };
    };

    /**
     * 行内选择地图节点：整体回填 mapNode（含节点坐标）；
     * 映射点坐标仅在未手填时回填节点坐标（万行场景省去逐行输入），已手填的值不覆盖（SPEC §4.3）
     */
    const onRowNodeChange = (group: MapGroupDraft, row: MappingRowDraft, node?: MappingNode) => {
        patchRow(group.groupKey, row.rowKey, {
            mapNode: node ? { ...node } : undefined,
            mappingPoint: {
                x: typeof row.mappingPoint?.x === "number" ? row.mappingPoint.x : node?.x,
                y: typeof row.mappingPoint?.y === "number" ? row.mappingPoint.y : node?.y,
            },
        });
    };

    /**
     * 添加映射行：清空本组过滤（否则新空行可能因不匹配过滤条件而不可见）并跳到最后页
     */
    const handleAddRow = (group: MapGroupDraft) => {
        const pageSize = groupViews[group.groupKey]?.pageSize ?? DEFAULT_GROUP_VIEW.pageSize;
        patchGroup(group.groupKey, { rows: [...group.rows, { rowKey: nextKey("r") }] });
        patchGroupView(group.groupKey, {
            keyword: "",
            onlyInvalid: false,
            pageNo: Math.ceil((group.rows.length + 1) / pageSize),
        });
    };

    /**
     * 获取采集点位建议：返回的控制点按节点 id 合并进当前组，不整组覆盖已录入行
     * 控制点本身就是地图节点（id/name/point 与地图节点一一对应）：
     * - 已录入行的 mapNode.nodeId 命中控制点 id → 只更新该行的节点信息与映射点；
     * - 未命中 → 以控制点追加新行；
     * - 未匹配到任何控制点的已录入行保持原样
     */
    const handleSuggestion = (group: MapGroupDraft) => {
        if (!group.mapId) {
            message.warning(t("请先选择地图"));
            return;
        }
        setSuggestionLoading(prev => ({ ...prev, [group.groupKey]: true }));
        getSuggestionsForCollectionNodes({
            mapId: group.mapId!,
            ...(group.expectedCount ? { expectedCount: group.expectedCount } : {}),
        }).then(res => {
            if (res.code === 200 && res.message === "success") {
                const points = res.data?.controlPoints ?? [];
                /* 合并前先剔除完全未填写的占位空行（未选节点且未填坐标），
                   否则新建组自带的初始空行会残留 */
                const rows = group.rows.filter(r => !isRowBlank(r));
                points.forEach(p => {
                    /* mapNode 从控制点整体回填（nodeId/nodeName/x/y），
                       即使节点尚未加载也不影响显示：getGroupOptions 会把行内 mapNode 合并进选项 */
                    const suggested = {
                        mapNode: {
                            nodeId: p.id,
                            nodeName: p.name,
                            x: p.point?.x,
                            y: p.point?.y,
                        },
                        mappingPoint: { x: p.point?.x, y: p.point?.y },
                    };
                    /* 无 id 的控制点不参与匹配，直接按新行追加 */
                    const index = p.id ? rows.findIndex(r => r.mapNode?.nodeId === p.id) : -1;
                    if (index >= 0) {
                        /* 节点已录入：保留 rowKey，仅更新节点信息与映射点坐标 */
                        rows[index] = { ...rows[index], ...suggested };
                    } else {
                        rows.push({ rowKey: nextKey("r"), ...suggested });
                    }
                });
                patchGroup(group.groupKey, { rows });
                /* 建议可能追加大量新行：清空过滤并跳到最后页，让新合并的行可见 */
                const pageSize = groupViews[group.groupKey]?.pageSize ?? DEFAULT_GROUP_VIEW.pageSize;
                patchGroupView(group.groupKey, {
                    keyword: "",
                    onlyInvalid: false,
                    pageNo: Math.max(1, Math.ceil(rows.length / pageSize)),
                });
                message.success(t("获取建议成功"));
            } else {
                message.warning(t("获取建议失败") + res?.message);
            }
            setSuggestionLoading(prev => ({ ...prev, [group.groupKey]: false }));
        }).catch(err => {
            setSuggestionLoading(prev => ({ ...prev, [group.groupKey]: false }));
            if (err) {
                message.error(t("获取建议失败") + err?.message);
            }
        });
    };

    /**
     * 提交前校验地图组，返回错误文案（null 表示通过）
     * 完全空白行视为占位、提交时自动剔除；存在半填行时给问题组自动开「只看未填完整」过滤，
     * 帮助用户在万行中定位（SPEC §4.5）
     */
    const validateGroups = (): string | null => {
        if (groups.length === 0) return t("请至少添加一个地图组");
        for (const g of groups) {
            if (!g.mapId) return t("每个地图组都需要选择地图");
            if (!g.rows.some(r => !isRowBlank(r))) return t("每个地图组至少需要一行映射");
        }
        const invalidGroupKeys = groups
            .filter(g => g.rows.some(isRowPartial))
            .map(g => g.groupKey);
        if (invalidGroupKeys.length > 0) {
            /* 重置问题组的视图状态为「只看未填完整」并回到第一页，半填行即过滤结果 */
            setGroupViews(prev => {
                const next = { ...prev };
                invalidGroupKeys.forEach(k => {
                    next[k] = { ...DEFAULT_GROUP_VIEW, onlyInvalid: true };
                });
                return next;
            });
            return t("存在未填写完整的映射行，已为你过滤显示");
        }
        return null;
    };

    /**
     * 把草稿组装成保存接口需要的按地图分组结构（剔除完全空白的占位行）
     */
    const buildMapNodeMappings = (): MapNodeMapping[] => {
        return groups.map(g => ({
            mapId: g.mapId,
            mapName: g.mapName,
            nodeMappings: g.rows.filter(r => !isRowBlank(r)).map(r => ({
                mapNode: r.mapNode,
                mappingPoint: r.mappingPoint,
            })),
        }));
    };

    /**
     * 新增节点映射
     */
    const handleAdd = (values: { mappingName: string; agvKeys?: string[] }) => {
        saveAGVNodeMapping({
            mappingName: values.mappingName,
            nodeMappings: buildMapNodeMappings(),
            agvKeys: values.agvKeys ?? [],
        }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getMappings();
                setOpenModal(false);
                message.success(t("新增节点映射成功"));
            } else {
                message.warning(t("新增节点映射失败") + res?.message);
            }
            setSubmitting(false);
        }).catch(err => {
            setSubmitting(false);
            if (err) {
                message.error(t("新增节点映射失败") + err?.message);
            }
        });
    };

    /**
     * 编辑节点映射
     * 2026-08-19 起更新接口与保存接口结构对齐（按地图分组 + agvKeys，整体替换语义），
     * 一次调用提交全量草稿即可，不再按组拆分多次调用
     */
    const handleUpdate = (values: { mappingName: string; agvKeys?: string[] }) => {
        if (!modifyRow?.mappingKey) {
            setSubmitting(false);
            return;
        }
        updateAGVNodeMapping({
            mappingKey: modifyRow.mappingKey,
            mappingName: values.mappingName,
            nodeMappings: buildMapNodeMappings(),
            agvKeys: values.agvKeys ?? [],
        }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getMappings();
                setOpenModal(false);
                message.success(t("编辑节点映射成功"));
            } else {
                message.warning(t("编辑节点映射失败") + res?.message);
            }
            setSubmitting(false);
        }).catch(err => {
            setSubmitting(false);
            if (err) {
                message.error(t("编辑节点映射失败") + err?.message);
            }
        });
    };

    /**
     * 弹窗确认事件
     */
    const handleOk = async () => {
        let values: { mappingName: string; agvKeys?: string[] };
        try {
            values = await form.validateFields();
        } catch {
            return;
        }
        const errorMsg = validateGroups();
        if (errorMsg) {
            message.warning(errorMsg);
            return;
        }
        setSubmitting(true);
        if (isModify) {
            handleUpdate(values);
        } else {
            handleAdd(values);
        }
    };

    /**
     * 弹窗取消事件
     */
    const handleCancel = () => {
        setOpenModal(false);
    };

    /**
     * 弹窗打开时初始化：编辑回填 / 新增重置为一个空地图组
     */
    useEffect(() => {
        if (!open) return;
        /* 过滤状态与组一一对应，每次打开整体重置 */
        setGroupViews({});
        if (isModify && modifyRow) {
            form.setFieldsValue({
                mappingName: modifyRow.mappingName,
                agvKeys: modifyRow.agvKeys ?? [],
            });
            const initGroups: MapGroupDraft[] = (modifyRow.mapNodeMapping ?? []).map(g => ({
                groupKey: nextKey("g"),
                mapId: g.mapId,
                mapName: g.mapName,
                rows: (g.nodeMappings ?? []).map(r => ({
                    rowKey: nextKey("r"),
                    mapNode: r.mapNode,
                    mappingPoint: r.mappingPoint,
                })),
            }));
            setGroups(initGroups);
            /* 预拉各地图节点，保证回填的行节点 Select 有选项 */
            initGroups.forEach(g => g.mapId && loadMapNodes(g.mapId));
        } else {
            form.resetFields();
            setGroups([{ groupKey: nextKey("g"), rows: [{ rowKey: nextKey("r") }] }]);
        }
    }, [open]);

    /**
     * 加载简单地图列表与车辆列表
     */
    useEffect(() => {
        getSimpleMaps().then(res => {
            if (res.code === 200 && res.message === "success") {
                setSimpleMaps(res?.data || []);
            } else {
                message.warning(t("查询简单地图列表出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询简单地图列表出错") + err?.message);
            }
        });
        getSimpleVehicles().then(res => {
            if (res.code === 200 && res.message === "success") {
                setSimpleVehicles(res?.data || []);
            } else {
                message.warning(t("查询车辆列表出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询车辆列表出错") + err?.message);
            }
        });
    }, []);

    /**
     * 映射行表格列配置（在渲染闭包内生成，依赖当前组的选项与行号映射）
     * 列全部固定宽且总和 = scroll.x（1080）≈ 内容区宽度，横向不出现滚动条（SPEC §4.7）
     */
    const getRowColumns = (
        group: MapGroupDraft,
        nodeOptions: NodeOption[],
        indexMap: Map<string, number>,
    ): TableColumnsType<MappingRowDraft> => [
        {
            title: "#",
            width: 60,
            /* 显示在完整 rows 中的原始行号，过滤后仍可用于定位 */
            render: (_, row) => (indexMap.get(row.rowKey) ?? 0) + 1,
        },
        {
            title: t("地图节点"),
            width: 600,
            render: (_, row) => (
                /* Space.Compact：下拉框为主录入方式，右侧📍按钮打开地图选点二级弹窗（SPEC_node_mapping_map_picker §3.1） */
                <Space.Compact style={{ width: "100%" }}>
                    <Select
                        showSearch
                        optionFilterProp="label"
                        placeholder={t("请选择地图节点")}
                        style={{ flex: 1 }}
                        value={row.mapNode?.nodeId}
                        options={nodeOptions}
                        onChange={(_, option) => onRowNodeChange(group, row, (option as NodeOption)?.node)}
                    />
                    {/* 组未选地图时禁用选点（选点依赖地图节点数据） */}
                    <Tooltip title={!group.mapId ? t("请先选择地图") : undefined}>
                        <Button
                            icon={<EnvironmentOutlined />}
                            disabled={!group.mapId}
                            onClick={() => setPickerTarget({ groupKey: group.groupKey, rowKey: row.rowKey })}
                        />
                    </Tooltip>
                </Space.Compact>
            ),
        },
        {
            title: t("映射点X"),
            width: 180,
            render: (_, row) => (
                <InputNumber
                    style={{ width: "100%" }}
                    value={row.mappingPoint?.x}
                    onChange={(value) => patchRow(group.groupKey, row.rowKey, {
                        mappingPoint: { ...row.mappingPoint, x: value ?? undefined },
                    })}
                />
            ),
        },
        {
            title: t("映射点Y"),
            width: 180,
            render: (_, row) => (
                <InputNumber
                    style={{ width: "100%" }}
                    value={row.mappingPoint?.y}
                    onChange={(value) => patchRow(group.groupKey, row.rowKey, {
                        mappingPoint: { ...row.mappingPoint, y: value ?? undefined },
                    })}
                />
            ),
        },
        {
            title: t("操作"),
            width: 60,
            align: "center",
            render: (_, row) => (
                <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => patchGroup(group.groupKey, {
                        rows: group.rows.filter(r => r.rowKey !== row.rowKey),
                    })}
                />
            ),
        },
    ];

    /* 选点目标解析：pickerTarget 非空时取出对应组与行（打开期间外层被遮罩阻隔，行数据不变） */
    const pickerGroup = pickerTarget ? groups.find(g => g.groupKey === pickerTarget.groupKey) : undefined;
    const pickerRow = pickerGroup?.rows.find(r => r.rowKey === pickerTarget?.rowKey);
    const pickerTargetData = pickerGroup && pickerRow ? { group: pickerGroup, row: pickerRow } : null;

    return (
        <>
        <Modal
            title={isModify ? t("编辑节点映射") : t("新增节点映射")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
            width={1200}
            confirmLoading={submitting}
            maskClosable={false}
            destroyOnHidden
        >
            {/* body 限高内部滚动：多地图组时不撑破屏幕 */}
            <div className={styles.modal_body}>
                <Form
                    name="node-mapping-form"
                    labelCol={{ span: 3 }}
                    wrapperCol={{ span: 21 }}
                    autoComplete="off"
                    form={form}
                >
                    <Form.Item
                        label={t("映射名称")}
                        name="mappingName"
                        rules={[{ required: true, message: t("请输入映射名称") }]}
                    >
                        <Input
                            placeholder={t("请输入映射名称")}
                            maxLength={64}
                            showCount
                        />
                    </Form.Item>

                    <Form.Item
                        label={t("关联AGV")}
                        name="agvKeys"
                    >
                        <Select
                            mode="multiple"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            placeholder={t("请选择关联AGV")}
                            options={simpleVehicles.map(v => ({ value: v.key, label: v.name }))}
                        />
                    </Form.Item>

                    <Form.Item label={t("节点映射")} required>
                        {groups.map(group => {
                            const nodeOptions = getGroupOptions(group);
                            const rowView = getGroupRowView(group);
                            const view = groupViews[group.groupKey];
                            /* 页码钳制：删除行/过滤收缩后 maxPage 变小，渲染侧派生 min 值，不停留在空页 */
                            const pageSize = view?.pageSize ?? DEFAULT_GROUP_VIEW.pageSize;
                            const maxPage = Math.max(1, Math.ceil(rowView.filteredRows.length / pageSize));
                            const currentPage = Math.min(view?.pageNo ?? 1, maxPage);
                            return (
                                <Card
                                    key={group.groupKey}
                                    size="small"
                                    className={styles.group_card}
                                    title={(
                                        <Select
                                            placeholder={t("请选择地图")}
                                            style={{ width: 240 }}
                                            value={group.mapId}
                                            options={simpleMaps.map(m => ({ value: m.mapId, label: m.mapName }))}
                                            onChange={(mapId) => onGroupMapChange(group.groupKey, mapId)}
                                        />
                                    )}
                                    extra={(
                                        <div className={styles.group_toolbar}>
                                            {/* 行定位工具与组操作同放一行，省一条工具栏的纵向空间 */}
                                            <Input
                                                allowClear
                                                placeholder={t("搜索节点名称/ID")}
                                                style={{ width: 180 }}
                                                value={view?.keyword ?? ""}
                                                /* 过滤条件变化时回到第一页，避免带着大页码过滤后落空 */
                                                onChange={e => patchGroupView(group.groupKey, { keyword: e.target.value, pageNo: 1 })}
                                            />
                                            <Checkbox
                                                checked={view?.onlyInvalid ?? false}
                                                onChange={e => patchGroupView(group.groupKey, { onlyInvalid: e.target.checked, pageNo: 1 })}
                                            >
                                                {t("只看未填完整")}
                                            </Checkbox>
                                            <InputNumber
                                                placeholder={t("期望点位数量")}
                                                min={1}
                                                style={{ width: 130 }}
                                                value={group.expectedCount}
                                                onChange={(value) => patchGroup(group.groupKey, {
                                                    expectedCount: value ?? undefined,
                                                })}
                                            />
                                            <Button
                                                loading={!!suggestionLoading[group.groupKey]}
                                                onClick={() => handleSuggestion(group)}
                                            >
                                                {t("获取建议")}
                                            </Button>
                                            <Popconfirm
                                                title={t("清空映射行")}
                                                description={t("确定清空该地图组的全部映射行？")}
                                                onConfirm={() => patchGroup(group.groupKey, { rows: [] })}
                                                okText={t("确定")}
                                                cancelText={t("取消")}
                                            >
                                                <Button danger disabled={group.rows.length === 0}>
                                                    {t("清空")}
                                                </Button>
                                            </Popconfirm>
                                            <Button
                                                danger
                                                icon={<DeleteOutlined />}
                                                onClick={() => setGroups(prev => prev.filter(g => g.groupKey !== group.groupKey))}
                                            />
                                        </div>
                                    )}
                                >
                                    {/* 行数统计行：搜索/过滤已上移组头，这里只保留统计文本 */}
                                    <div className={styles.row_toolbar}>
                                        <span className={styles.row_stats}>
                                            {rowView.hasFilter
                                                ? t("显示 {shown} / {total} 行", {
                                                    shown: rowView.filteredRows.length,
                                                    total: group.rows.length,
                                                })
                                                : t("共 {total} 行", { total: group.rows.length })}
                                            {rowView.invalidCount > 0 && (
                                                <span className={styles.invalid_count}>
                                                    {t("未填完整 {count} 行", { count: rowView.invalidCount })}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    {/* 前端分页：默认 10 条/页，只有当前页行进 DOM，万行不卡 */}
                                    <Table<MappingRowDraft>
                                        size="small"
                                        columns={getRowColumns(group, nodeOptions, rowView.indexMap)}
                                        dataSource={rowView.filteredRows}
                                        rowKey={r => r.rowKey}
                                        rowClassName={(row) => (isRowPartial(row) ? styles.invalid_row : "")}
                                        pagination={{
                                            current: currentPage,
                                            pageSize,
                                            showSizeChanger: true,
                                            pageSizeOptions: [10, 20, 50, 100],
                                            /* 行数统计已由上方统计行承担，不再重复 showTotal */
                                            onChange: (p, ps) => patchGroupView(group.groupKey, ps !== pageSize
                                                /* 改每页条数时回到第一页，避免带着大页码换页容量后落空 */
                                                ? { pageNo: 1, pageSize: ps }
                                                : { pageNo: p }),
                                        }}
                                    />
                                    <Button
                                        type="dashed"
                                        block
                                        icon={<PlusOutlined />}
                                        className={styles.add_row}
                                        onClick={() => handleAddRow(group)}
                                    >
                                        {t("添加映射行")}
                                    </Button>
                                </Card>
                            );
                        })}
                        <Button
                            type="dashed"
                            block
                            icon={<PlusOutlined />}
                            onClick={() => setGroups(prev => ([
                                ...prev,
                                { groupKey: nextKey("g"), rows: [{ rowKey: nextKey("r") }] },
                            ]))}
                        >
                            {t("添加地图")}
                        </Button>
                    </Form.Item>
                </Form>
            </div>
        </Modal>
        {/* 地图选点二级弹窗：确定回填直接复用 onRowNodeChange，
            与下拉框选节点语义完全一致（mapNode 整体回填，映射点仅未手填时回填） */}
        <MapPickerModal
            target={pickerTargetData}
            nodeIdSet={pickerGroup?.mapId ? nodeOptionCache.idSets[pickerGroup.mapId] : undefined}
            onOk={(node) => {
                if (pickerGroup && pickerRow) onRowNodeChange(pickerGroup, pickerRow, node);
                setPickerTarget(null);
            }}
            onClose={() => setPickerTarget(null)}
        />
        </>
    );
};
