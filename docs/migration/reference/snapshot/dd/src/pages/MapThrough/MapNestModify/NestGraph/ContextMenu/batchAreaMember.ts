/**
 * @description 独占区/三方交管 右键菜单 4 个单向一级项（添加/移除 × 独占区/三方交管）的纯逻辑工具。
 *              由右键菜单（ContextMenu/index.tsx）消费：
 *              - resolveOperateMembers / collectMembers：解析本次菜单的操作范围（D4，沿用 B3 + B5）
 *              - computeAddItem / computeRemoveItem：基于操作范围生成区域子菜单项的 label / disabled（D3 + D6 + D11 + D12）
 *              - applyAddToGroup / applyRemoveToGroup：对区域单向增减成员并返回实际增减数（D3 幂等跳过）
 *              - buildAreaChildren：把上述计算聚合成区域子菜单列表（D6 + D11 + D12，方案 A 下沉至此）
 *              含 message 副作用的反馈留在组件层，不下沉至此。
 *              i18n：本文件是纯逻辑模块（不 import React hook），翻译能力以 TranslateFn 参数注入，
 *              computeAddItem / computeRemoveItem / buildAreaChildren 产出的 label 直接是当前语言文案（ICU {var} 占位）。
 *              取代前序 toggle 语义（computeAreaItem / applyToggleToGroup 已删除，见 SPEC_split_area_member_menu.md）。
 * @date 2026-7-20
 */
import type Konva from "konva";
import type { NodeEdgeGroup } from "@/types/MapNestModify";

/**
 * 翻译函数签名（与 useI18n 返回的 t 一致）。
 * 此文件是纯逻辑模块，不 import React hook，故以参数形式注入翻译能力，
 * 让 computeAddItem / computeRemoveItem 生成的 label 直接是当前语言文案（ICU {var} 占位）。
 */
export type TranslateFn = (id: string, values?: Record<string, string | number>) => string;

/** 操作范围内的单个成员：node 或 edge */
export interface OperateMember {
    id: string;
    type: "node" | "edge";
}

/** 区域子菜单项的展示元信息：label + danger + disabled + 待操作数 */
export interface AreaItemMeta {
    label: string;
    /**
     * 区域项 danger：移除模式 true、添加模式 false（与一级项一致，确保视觉一致 D10）
     */
    danger: boolean;
    /**
     * 置灰（该区域对选中集完全无可操作元素：添加全已在 / 移除全不在，D6）
     */
    disabled: boolean;
    /**
     * 待操作数：添加 = outCount（不在区域内的），移除 = inCount（已在区域内的）
     */
    operateCount: number;
}

/** 单向变更结果：新成员列表 + 实际增减数（幂等跳过不计入，D3） */
export interface MembershipResult {
    nodeIds: string[];
    edgeIds: string[];
    /**
     * 实际增减数：添加 = 新增数、移除 = 移除数（幂等跳过不计入）
     */
    changed: number;
}

/** 区域子菜单的模式：添加 / 移除（决定 compute/apply 函数、danger、褪色、message 文案） */
export type AreaMode = "add" | "remove";

/**
 * 从 selectShapes 中收集 node / edge 成员（过滤 robot / 设备图标等非可选 shape）。
 * selectShapes 中可能残留已销毁的 shape 引用——这里只取 attrs.id / enableSelect，
 * 不依赖 shape 存活；后续高亮褪色由 removeAreaHighlightFromShape 内部 findOne 容错。
 * @param shapes 当前框选的 shape 列表
 * @returns 仅含 node / edge 的操作成员列表
 */
export function collectMembers(shapes: Konva.Shape[]): OperateMember[] {
    return shapes
        .filter(s => s.attrs?.enableSelect === "node" || s.attrs?.enableSelect === "edge")
        .map(s => ({ id: s.attrs?.id, type: s.attrs?.enableSelect }));
}

/**
 * 解析本次右键菜单的操作范围（D4，沿用 B3 + B5）。
 * - stage 空白右键（event.target === stage）→ 整个 selectShapes
 * - node/edge 右键 + 命中 id ∈ selectShapes → 整个 selectShapes
 * - node/edge 右键 + 命中 id ∉ selectShapes → 仅命中元素（单元素）
 * - 其余（robot 等）→ 空数组（不会进入独占区/三方交管分支）
 *
 * 仅收集 enableSelect 为 node/edge 的成员，过滤 robot/设备图标等。
 * @param event 右键事件
 * @param selectShapes 当前框选的 shape 列表
 * @returns 本次操作范围（node/edge 成员数组）
 */
export function resolveOperateMembers(
    event: Konva.KonvaEventObject<MouseEvent> | undefined,
    selectShapes: Konva.Shape[]
): OperateMember[] {
    const target = event?.target;
    const stage = target?.getStage?.();
    if (!target || !stage) return [];

    // stage 空白右键：操作整个 selectShapes
    if (target === stage) {
        return collectMembers(selectShapes);
    }
    // node/edge 右键：命中元素 ∈ 选中集 → 操作整个选中集；否则仅命中元素
    const targetType = target.attrs?.enableSelect;
    if (targetType === "node" || targetType === "edge") {
        const targetId = target.attrs?.id;
        const inSelection = selectShapes.some(s => s.attrs?.id === targetId);
        if (inSelection) {
            return collectMembers(selectShapes);
        }
        return [{ id: targetId, type: targetType }];
    }
    return [];
}

/**
 * 计算添加模式下区域项的 label / disabled（D3 + D6 + D11 + D12）。
 * - outCount === 0（全已在）→ 置灰，label「{name}（全已在）」
 * - outCount > 0 + 批量（members.length > 1）→ label「{name} · {outCount}」
 * - outCount > 0 + 单元素 → label「{name}」（无数量，兼容 B6）
 *
 * 仅在 members 非空时调用（members 空时由 buildAreaChildren 直接返回空，不进入此函数）。
 * label 经 t() 翻译：置灰走「{name}（全已在）」，批量走「{name} · {count}」，
 * 单元素仅返回区域名本身（区域名是后端数据，不翻译）。
 * @param members 本次操作范围
 * @param group 目标区域
 * @param t 翻译函数（由组件层 useI18n 注入，保持本文件纯逻辑）
 * @returns 区域项展示元信息（label / danger / disabled / operateCount）
 */
export function computeAddItem(
    members: OperateMember[],
    group: NodeEdgeGroup,
    t: TranslateFn
): AreaItemMeta {
    const name = group.name;
    // 预建 Set 加速成员判定：框选上万元素时，数组 includes 的线性查找会让
    // 区域子菜单计算退化为 O(members × 区域成员数)；改用 Set.has 降为 O(members)。
    const nodeSet = new Set(group.nodeIds);
    const edgeSet = new Set(group.edgeIds);
    // outCount：操作范围内不在区域内的数量（即本次可添加的数量）
    const outCount = members.filter(m =>
        m.type === "node" ? !nodeSet.has(m.id) : !edgeSet.has(m.id)
    ).length;
    const isBatch = members.length > 1;

    // 全已在 → 置灰（D6 + D11）
    if (outCount === 0) {
        return { label: t("{name}（全已在）", { name }), danger: false, disabled: true, operateCount: 0 };
    }
    // 可添加：批量带数量（D12）；单元素仅区域名（区域名是后端数据，不翻译）
    return {
        label: isBatch ? t("{name} · {count}", { name, count: outCount }) : name,
        danger: false,
        disabled: false,
        operateCount: outCount
    };
}

/**
 * 计算移除模式下区域项的 label / disabled（D3 + D6 + D11 + D12）。
 * - inCount === 0（全不在）→ 置灰，label「{name}（不在该区域）」
 * - inCount > 0 + 批量 → label「{name} · {inCount}」
 * - inCount > 0 + 单元素 → label「{name}」
 *
 * 仅在 members 非空时调用。
 * label 经 t() 翻译：置灰走「{name}（不在该区域）」，批量走「{name} · {count}」，
 * 单元素仅返回区域名本身（区域名是后端数据，不翻译）。
 * @param members 本次操作范围
 * @param group 目标区域
 * @param t 翻译函数（由组件层 useI18n 注入，保持本文件纯逻辑）
 * @returns 区域项展示元信息（label / danger / disabled / operateCount）
 */
export function computeRemoveItem(
    members: OperateMember[],
    group: NodeEdgeGroup,
    t: TranslateFn
): AreaItemMeta {
    const name = group.name;
    // 预建 Set 加速成员判定（与 computeAddItem 同理，避免万级 members 下的 O(n×m) 退化）
    const nodeSet = new Set(group.nodeIds);
    const edgeSet = new Set(group.edgeIds);
    // inCount：操作范围内已在区域内的数量（即本次可移除的数量）
    const inCount = members.filter(m =>
        m.type === "node" ? nodeSet.has(m.id) : edgeSet.has(m.id)
    ).length;
    const isBatch = members.length > 1;

    // 全不在 → 置灰（D6 + D11）
    if (inCount === 0) {
        return { label: t("{name}（不在该区域）", { name }), danger: false, disabled: true, operateCount: 0 };
    }
    // 可移除：批量带数量（D12）；danger 跟随一级项（D10）；单元素仅区域名
    return {
        label: isBatch ? t("{name} · {count}", { name, count: inCount }) : name,
        danger: true,
        disabled: false,
        operateCount: inCount
    };
}

/**
 * 添加模式：把 members 中不在区域内的加入，已在的跳过（幂等，D3）。
 * 用 Set 保证去重（与原 [...new Set(...)] 一致）。
 * @param group 目标区域（不会被修改）
 * @param members 本次操作范围
 * @returns 新 nodeIds / edgeIds 及实际新增数（changed）
 */
export function applyAddToGroup(group: NodeEdgeGroup, members: OperateMember[]): MembershipResult {
    const nodeSet = new Set(group.nodeIds);
    const edgeSet = new Set(group.edgeIds);
    let added = 0;
    for (const m of members) {
        const set = m.type === "node" ? nodeSet : edgeSet;
        // 幂等：已在区域内的跳过，不计入 added
        if (!set.has(m.id)) {
            set.add(m.id);
            added++;
        }
    }
    return { nodeIds: [...nodeSet], edgeIds: [...edgeSet], changed: added };
}

/**
 * 移除模式：把 members 中已在区域内的移除，不在的跳过（幂等，D3）。
 * @param group 目标区域（不会被修改）
 * @param members 本次操作范围
 * @returns 新 nodeIds / edgeIds 及实际移除数（changed）
 */
export function applyRemoveToGroup(group: NodeEdgeGroup, members: OperateMember[]): MembershipResult {
    const nodeSet = new Set(group.nodeIds);
    const edgeSet = new Set(group.edgeIds);
    let removed = 0;
    for (const m of members) {
        const set = m.type === "node" ? nodeSet : edgeSet;
        // 幂等：不在区域内的跳过，不计入 removed
        if (set.has(m.id)) {
            set.delete(m.id);
            removed++;
        }
    }
    return { nodeIds: [...nodeSet], edgeIds: [...edgeSet], changed: removed };
}

/**
 * 构造某一级项下的区域子菜单（D6 + D11 + D12）。
 * - members 为空（未框选 + stage 右键）→ 返回 []，使一级项在组件层被置为 disabled（D8）
 * - groups 为空 → 返回 []（正常路径下该一级项已被 filter 守卫隐藏，此处兜底）
 * - 否则逐区域用 computeAddItem / computeRemoveItem 生成 label / disabled / danger
 *
 * 纯数据转换，不含 UI 副作用；返回结构化对象（不直接构造 antd ItemType，避免耦合 antd 类型）。
 * 组件层挂载时按需 `as MenuProps["items"]` 断言即可（与原代码直接构造对象字面量的处理方式一致）。
 * @param groups 该类型的区域列表
 * @param members 操作范围
 * @param mode 添加 / 移除
 * @param t 翻译函数（透传给 computeAddItem / computeRemoveItem，保持本文件纯逻辑）
 * @returns 区域子菜单项列表（key + label + danger + disabled）
 */
export function buildAreaChildren(
    groups: NodeEdgeGroup[] | undefined,
    members: OperateMember[],
    mode: AreaMode,
    t: TranslateFn
): { key: string; label: string; danger: boolean; disabled: boolean }[] {
    if (!members.length || !groups?.length) return [];
    return groups.map(group => {
        const meta = mode === "add"
            ? computeAddItem(members, group, t)
            : computeRemoveItem(members, group, t);
        return {
            key: group.id,
            label: meta.label,
            danger: meta.danger,
            disabled: meta.disabled
        };
    });
}
