# SPEC：分配权限弹窗 — 父子三态勾选（持久半选）

> 状态：设计规格（核心决策经三轮访谈确认）
> 日期：2026-06-30
> 分支：v2_dev
> 关联代码：`src/pages/AccessManagement/RoleManagement/PermissionModal/index.tsx`
> 关联接口：`getPermissions()`、`getPermissions({ roleId })`、`assignPermissions({ roleId, permissionIds })`

---

## 1. 背景与目标

`PermissionModal` 是角色管理下的「分配权限」弹窗，基于权限资源树（菜单 / 按钮）勾选后调用 `assignPermissions` 完成角色权限分配。

现有实现依赖 antd Tree 的自动父子联动（`checkStrictly={false}`），其「半选」是 antd 依据子级选中数**派生**的瞬时态——**子级全部取消后父级必然回落到未选**。

本次需求要求把父子联动改为**持久三态**：子级全部取消后，父级仍保持半选（规则③）。其业务根因是**父级菜单需可被独立授权**（即使无任何子权限，父级 id 也应作为可分配单元上送后端）。antd 的派生半选无法表达这种与子级解耦的「持久半选」，必须脱离自动联动、自管状态。

**目标**：
- 父级 checkbox 具备 **未选 / 半选 / 全选** 三种稳定状态，半选粘性（子级清空也不回落）；
- 半选父级的 id 随提交上送（独立授权语义）；
- 回显能还原三态（含「空半选」父级）；
- 提交 / 回显两条链路结果一致（沿用现有不变量）。

**非目标**：
- 不改变后端 `assignPermissions` / `getPermissions` 接口契约（仍传 `permissionIds: number[]`）；
- 不改变弹窗 UI 布局、loading / 错误处理、`destroyOnClose` 行为；
- 不涉及菜单动态渲染侧（消费端，见 [[SPEC_menu_permission]]）。

---

## 2. 现状回顾（实现基线）

阅读 `PermissionModal/index.tsx` 后确认的关键事实，新方案必须遵守 / 借助：

### 2.1 数据来源（`loadPermissions`，160-188）

```
getPermissions()            → 全量权限树，构建 treeData（渲染）+ 默认展开顶层
getPermissions({ roleId })  → 当前角色已分配权限树，用于回显勾选
```

回显当前只收集**叶子** id（`collectLeafPermissionIds`，68-81），父级（选中 / 半选）状态交由 antd 依据子级派生 —— **这正是本次要打破的前提**。

### 2.2 状态（41-48）

```ts
treeData: TreeDataNode[]     // 全量权限树（渲染用，children 完整）
expandedKeys: React.Key[]    // 默认展开顶层
checkedKeys: React.Key[]     // 仅叶子 + 「子级全选」的父级
```

> 关键：`treeData` 来自**全量** `getPermissions()`，故即使某父级在回显中「子级全空」，UI 上该父级仍可展开看到完整子级用于重新勾选。新方案沿用此结构。

### 2.3 现有勾选链路（将被重写）

| 函数 | 行号 | 现有职责 | 新方案处置 |
| --- | --- | --- | --- |
| `collectLeafPermissionIds` | 68-81 | 回显只收叶子 | **改为收集全部节点 id**（含父级），见 §7 |
| `collectSubtreeLeafKeys` | 88-114 | onSelect 按子树叶子整体切换 | **删除**，onSelect 改调统一 `toggleNode`，见 §6.3 |
| `collectCheckedPermissionKeys` | 125-153 | 提交前遍历推导「选中+半选」父级 | **删除**，提交直接 `[...S]`，见 §8 |
| `onCheck` | 196-198 | 直接存 antd 返回值 | **改为** 读 `info.node.key` 调 `toggleNode`（不消费 antd 返回值） |
| `onSelect` | 205-214 | 按子树叶子整体切换 | **改为** 调同一 `toggleNode`（D10，行为等同 checkbox） |
| `collectAllLeafKeys` / `isAllChecked` / `handleToggleAll` | 221-254 | 全选按钮（操作叶子） | **改为** 操作授权集合 S：全选=所有节点进 S，取消=清空 S，见 §6.4 |
| `handleOk`（提交） | 260-288 | `collectCheckedPermissionKeys` 推导 | **改为** `[...S].map(Number)`，见 §8 |

### 2.4 Tree 受控（318-329）

```tsx
<Tree checkable checkStrictly={false}
  checkedKeys={checkedKeys}        // 数组
  onCheck={onCheck} onSelect={onSelect}
  treeData={treeData} ... />
```

新方案改为 `checkStrictly`（受控对象格式 `{ checked, halfChecked }`），见 §6.2。

### 2.5 现有不变量（须保持）

- 回显后直接提交 ≡ 交互后提交（提交规范化保证一致）；
- 提交含「选中 / 半选」祖先 id（D11，后端按 id 还原任意层级）。

新方案以「单一授权集合 S」为唯一数据源，提交 = `[...S]`，上述不变量天然成立。

---

## 3. 需求详述

### 3.1 用户故事（需求原文 + 解读）

> 作为权限管理员，我希望父级 checkbox 表现为三态：
> 1. **主动选中父级 → 子级全选**（规则①）；
> 2. **子级部分选中 → 父级半选**（规则②）；
> 3. **先选父级 → 逐个取消子级 → 子级全空后，父级仍保持半选**（规则③，核心改动）；
> 4. **子级全部选中 → 父级自动全选**（规则④）。

### 3.2 核心难点：持久半选与 antd 派生半选不兼容

antd `checkStrictly={false}` 的半选 =「部分子级选中」的派生态，**子级全空时必回未选**，无法满足规则③。且 antd 不允许向 `checkedKeys` 注入「子级全空但显示半选」的父级——派生逻辑会覆盖受控值。

故底层必须 **`checkStrictly`（关闭自动联动）+ 完全自管勾选 / 半选集合**（D12），由组件自身实现三态点击、上下联动、粘性保留。

---

## 4. 设计决策（访谈结论）

| # | 决策点 | 结论 | 依据 |
| --- | --- | --- | --- |
| D1 | 业务动机 | **父级需独立授权**：父级菜单即使无子权限也是可分配最小单元，半选父级 id 必上送 | R1-Q1 |
| D2 | 半选语义 | **持久第三态**：未选 / 半选 / 全选 三种稳定态，半选与子级选中数解耦、粘性保留 | R1-Q2 |
| D3 | 取消半选方式 | **点父级 checkbox**：半选 → 点击 → 全选 → 再点 → 未选（三态循环） | R1-Q3 |
| D4 | 多层传递 | **逐级半选向上**：后代半选或部分选中 → 所有祖先半选 | R1-Q4 |
| D5 | 点击循环 | 未选 ↔ 全选（互切）；**半选 → 全选 → 未选**；从「全选」直接点击 → 未选（一次性清空该子树） | R2-Q1 |
| D6 | 派生半选粘性 | 与规则③一致：**任何路径**进入的半选都持久；点子级取消只移除该子级、父级保留为空半选 | R2-Q2 |
| D7 | 回显依据 | 后端树中**父级节点存在且 `childPermissions=[]`** → 灌入 S 后**自然呈现**为「空半选」（非显式识别，由 S 派生） | R2-Q3 |
| D8 | 全选态提交 | **父级 id + 全部子级 id** 都上送 | R2-Q4 |
| D9 | 全选按钮 | **取消全选 = 全树清空**（含所有空半选父级）；全选 = 所有节点进 S | R3-Q1 |
| D10 | 点 label 行为 | **完全等同 checkbox**：onSelect 与 onCheck 跑同一三态 `toggleNode` | R3-Q2 |
| D11 | 中间父级提交 | **上送所有命中的中间父级** id（保持现有行为） | R3-Q3 |
| D12 | 实现方式 | **`checkStrictly` + 全手动**：自管 `{ checked, halfChecked }`，自实现三态点击 / 上下联动 / 粘性 | R3-Q4 |

### 4.1 D5 / D6 的操作语义对照

| 操作对象 | 当前态 | 点击后 | 对 S 的影响 |
| --- | --- | --- | --- |
| 点**子级**（叶子或子树） | 选中 | 未选 | 仅移除该子级及其后代；**祖先保留**（D6 粘性） |
| 点**子级** | 未选 | 选中 | 加入该子级及后代 + 全部祖先（D4 向上联动） |
| 点**父级** | 未选 | 全选 | 加入该父级 + 全部后代 + 全部祖先 |
| 点**父级** | 半选 | 全选 | 补齐该父级全部后代（父级已在 S）+ 祖先（已在 S） |
| 点**父级** | 全选 | 未选 | 移除该父级 + 全部后代；**祖先保留**（D6 粘性） |

> **粘性统一性**（D6）：无论经「先全选再取消」还是「直接勾部分子级再清空」，父级一旦进入半选即持久，只有「点父级本身从全选→未选」或「全选按钮取消」才会清除。点子级取消**永远不会移除祖先**。

### 4.2 三态显示规则（派生）

设授权集合 `S ⊆ Key`（父级与子级 id 混存），节点 `X` 的后代叶子集合 `Leaf(X)`：

| 节点类型 | 全选（实勾） | 半选（半勾） | 未选（空） |
| --- | --- | --- | --- |
| 父级（有子级） | `X ∈ S` 且所有后代 ∈ S | `X ∈ S` 且后代未全 ∈ S（含后代全空＝空半选） | `X ∉ S` |
| 叶子（无子级） | `X ∈ S` | —（叶子无半选） | `X ∉ S` |

> 「空半选」= `X ∈ S` 且 `Leaf(X) ∩ S = ∅`：父级被独立授权但无任何子权限。这是 D1 的直接体现。
>
> **不变量（消除「X ∉ S 但后代命中」的歧义）**：由 `toggleNode` 的向上联动（勾任意节点 → 全部祖先入 S，§6.3）与回显按权限树结构收集 id（§7）共同保证——**「后代 ∈ S ⟹ 祖先 ∈ S」**。因此上表「X ∉ S → 未选」在实际中不会与「后代命中」并存：只要后代在 S，X 必已在 S，必落入全选或半选。`deriveChecked`（§5.2）据此实现，**不为「X ∉ S 但后代命中」单列分支**。

---

## 5. 核心数据模型与状态机

### 5.1 单一数据源：授权集合 S

```ts
// 替换原 checkedKeys: React.Key[]
// S 是唯一真相：父级与子级 id 混存，显示态与提交均由 S 派生
const [authorizedSet, setAuthorizedSet] = useState<Set<React.Key>>(new Set());
```

- **显示态**：由 S 按 §4.2 派生 `{ checked, halfChecked }`，喂给 antd（见 §6.2）；
- **提交**：`[...S].map(Number)`（见 §8）；
- **回显**：把已分配权限树的全部节点 id 灌入 S（见 §7）。

### 5.2 antd 受控值派生（`deriveChecked`）

```ts
/**
 * @description 由授权集合 S 派生 antd Tree 的受控勾选值。
 *              antd 在 checkStrictly 模式下不做父子联动，checked / halfChecked 完全由本函数决定：
 *               - 父级「全选」（自身+所有后代都在 S）→ 进 checked（实勾）
 *               - 父级「半选」（自身在 S 但后代未全在 S，含空半选）→ 进 halfChecked（半勾）
 *               - 叶子在 S → 进 checked；不在 S 则不出现
 *              未选节点两个集合都不含，antd 自然渲染为空勾。
 * @param nodes   全量权限树（treeData）
 * @param authSet 授权集合 S
 * @returns { checked: 实勾 key 列表, halfChecked: 半勾父级 key 列表 }
 */
const deriveChecked = (
    nodes: TreeDataNode[],
    authSet: Set<React.Key>,
): { checked: React.Key[]; halfChecked: React.Key[] } => {
    const checked: React.Key[] = [];
    const halfChecked: React.Key[] = [];
    // 单次深度遍历（自底向上）：walk 返回「该层列表内所有节点（含后代）是否全部在 S」，
    // 用于父级「全选 vs 半选」的严格判定（§4.2）：
    //   父全选 = 自身在 S 且全部后代都在 S；父半选 = 自身在 S 但后代未全在 S（含空半选）。
    // 等价于对每个父级调用 isFullyChecked（§6.1），但用 allInS 上行传递避免逐节点重算，保持 O(n)。
    const walk = (list: TreeDataNode[]): boolean => {
        let allInS = list.length > 0;
        (list || []).forEach(node => {
            const selfInS = authSet.has(node.key);
            if (node.children?.length) {
                const childrenAllInS = walk(node.children); // 后代是否全部在 S
                const nodeFullyChecked = selfInS && childrenAllInS;
                if (nodeFullyChecked) {
                    // 自身 + 所有后代都在 S → 全选（实勾）
                    checked.push(node.key);
                } else if (selfInS) {
                    // 自身在 S 但后代未全在 S → 半选（含空半选：后代全空）
                    halfChecked.push(node.key);
                }
                // selfInS=false → 未选（§4.2）；依赖不变量「后代∈S ⟹ 祖先∈S」，
                //                 故「自身不在 S 但后代命中」在正常交互 / 回显下不会出现。
                allInS = allInS && nodeFullyChecked;
            } else {
                // 叶子：在 S 即实勾
                if (selfInS) {
                    checked.push(node.key);
                }
                allInS = allInS && selfInS;
            }
        });
        return allInS;
    };
    walk(nodes);
    return { checked, halfChecked };
};
```

> **全选判定（严格）**：`deriveChecked` 用自底向上的 `allInS` 传递，在单次 O(n) 遍历内严格判定「自身 + 所有后代是否都在 S」（等价于 `isFullyChecked`，见 §6.1）。「自身在 S、后代部分在 S」精确判为**半选**，从而规则②（子级部分选中→父级半选）与规则④（子级全选→父级全选）都精确成立——不再使用「后代有命中即全选」的近似判定。

---

## 6. 详细设计

### 6.1 辅助函数（纯函数，基于 treeData）

```ts
/**
 * @description 收集节点 targetKey 及其全部后代的 key（含 targetKey 自身）。
 *              用于 toggleNode 判定「该子树是否全选」、以及「加入/移除整棵子树」。
 * @param nodes     全量权限树
 * @param targetKey 目标节点 key
 * @returns 子树全部 key（含自身），找不到目标返回 []
 */
const collectSubtreeKeys = (
    nodes: TreeDataNode[],
    targetKey: React.Key,
): React.Key[] => {
    const result: React.Key[] = [];
    const walk = (list: TreeDataNode[]): boolean => {
        for (const node of list) {
            if (node.key === targetKey) {
                const collect = (n: TreeDataNode) => {
                    result.push(n.key);
                    (n.children || []).forEach(collect);
                };
                collect(node);
                return true;
            }
            if (node.children?.length && walk(node.children)) return true;
        }
        return false;
    };
    walk(nodes);
    return result;
};

/**
 * @description 收集节点 targetKey 的全部祖先 key（不含自身）。
 *              用于「加入节点时向上联动」（D4：勾任意节点 → 全部祖先进 S）。
 * @param nodes     全量权限树
 * @param targetKey 目标节点 key
 * @returns 祖先 key 列表（从根到父），找不到返回 []
 */
const collectAncestorKeys = (
    nodes: TreeDataNode[],
    targetKey: React.Key,
): React.Key[] => {
    const ancestors: React.Key[] = [];
    const walk = (list: TreeDataNode[]): boolean => {
        for (const node of list) {
            if (node.key === targetKey) return true;
            if (node.children?.length) {
                const found = walk(node.children);
                if (found) {
                    ancestors.push(node.key);   // 回溯时记录祖先
                    return true;
                }
            }
        }
        return false;
    };
    walk(nodes);
    return ancestors;
};

/**
 * @description 严格判定节点是否「完全选中」（全选）：
 *              自身 + 所有后代 key 都在 S 中。叶子节点等价于 S.has(key)。
 * @param node    目标节点
 * @param authSet 授权集合 S
 */
const isFullyChecked = (node: TreeDataNode, authSet: Set<React.Key>): boolean => {
    const all = collectSubtreeKeys([node], node.key);
    return all.length > 0 && all.every(k => authSet.has(k));
};
```

> `collectSubtreeKeys` / `collectAncestorKeys` 每次递归遍历整树，O(n)。权限树规模小（几十~几百节点，每次点击调常数次），可接受；若后续树变大，可预构 `key → { subtree, ancestors }` 映射（`useMemo`）降至 O(1) 查询，见 §12。

### 6.2 Tree 受控改造

```tsx
// checkStrictly：关闭 antd 自动联动，checked / halfChecked 完全受控（D12）
<Tree
    checkable
    checkStrictly
    checkedKeys={{ checked, halfChecked }}   // 对象格式，由 deriveChecked 派生
    selectedKeys={[]}                         // 不高亮行（onSelect 仅触发勾选，D10）
    expandedKeys={expandedKeys}
    onExpand={keys => setExpandedKeys(keys)}
    onCheck={onCheck}
    onSelect={onSelect}
    treeData={treeData}
    style={{ maxHeight: "60vh", overflow: "auto" }}
/>
```

```ts
// checked / halfChecked 由 S 派生（memo 化，S 变才重算）
const { checked, halfChecked } = useMemo(
    () => deriveChecked(treeData, authorizedSet),
    [treeData, authorizedSet],
);
```

> **antd 5 兼容**：`checkStrictly` 下 `checkedKeys` 接受 `{ checked, halfChecked }` 对象，`halfChecked` 控制半勾显示。实施时须验证当前 antd 5.x 版本尊重受控 `halfChecked`（见 §12 风险 R1 的降级方案）。

### 6.3 统一三态切换 `toggleNode`（onCheck / onSelect 共用，D10）

```ts
/**
 * @description 节点三态切换的核心算法（D5/D6）。
 *              - 当前非全选（未选或半选）→ 切到全选：
 *                把该节点 + 全部后代 + 全部祖先加入 S（向上联动 D4）。
 *              - 当前全选 → 切到未选：
 *                把该节点 + 全部后代移出 S；祖先保留（粘性 D6，空半选由此产生）。
 *              叶子节点：subtree=[自身]，等价于「未选→选中(+祖先) / 选中→未选(留祖先)」。
 *              onCheck 与 onSelect 都调本函数（D10 行为等同）。
 * @param key 被点击节点的 key
 */
const toggleNode = (key: React.Key) => {
    if (!treeData.length) return;
    const subtree = collectSubtreeKeys(treeData, key);
    if (!subtree.length) return;
    const fullyChecked = subtree.every(k => authorizedSet.has(k));
    setAuthorizedSet(prev => {
        const next = new Set(prev);
        if (!fullyChecked) {
            // 未选/半选 → 全选：子树 + 祖先 全部加入
            subtree.forEach(k => next.add(k));
            collectAncestorKeys(treeData, key).forEach(k => next.add(k));
        } else {
            // 全选 → 未选：子树移除，祖先保留（粘性 → 可能产生空半选祖先）
            subtree.forEach(k => next.delete(k));
        }
        return next;
    });
};

// onCheck：忽略 antd 返回值，用 info.node.key 自管（D12 全手动）
const onCheck: TreeProps["onCheck"] = (_, info) => {
    toggleNode(info.node.key as React.Key);
};

// onSelect：与 onCheck 完全一致（D10 点 label 等同点 checkbox）
const onSelect: TreeProps["onSelect"] = (_, info) => {
    toggleNode(info.node.key as React.Key);
};
```

> **为何不消费 antd 的 `onCheck` 返回值**：`checkStrictly` 下 antd 不再做父子联动，其返回值基于「单点切换」推算，无法表达本规格的持久半选 / 向上联动 / 粘性。故只取 `info.node.key` 作为事件信号，状态转换完全由 `toggleNode` + S 决定 —— 这是「全手动」的核心。

### 6.4 全选 / 取消全选按钮（D9）

```ts
/**
 * @description 收集整棵权限树的全部节点 key（含父级与叶子）。
 *              「全选」时把全部 key 灌入 S，使每个父级都达全选态（D9）。
 */
const collectAllNodeKeys = (nodes: TreeDataNode[]): React.Key[] => {
    const result: React.Key[] = [];
    const walk = (list: TreeDataNode[]) => {
        (list || []).forEach(node => {
            result.push(node.key);
            if (node.children?.length) walk(node.children);
        });
    };
    walk(nodes);
    return result;
};

// 全部节点 key（缓存）
const allNodeKeys = useMemo(() => collectAllNodeKeys(treeData), [treeData]);

// 全部叶子 key（用于 isAllChecked 判定，沿用现有口径）
const allLeafKeys = useMemo(() => collectAllLeafKeys(treeData), [treeData]);

// 是否处于「全部选中」态：存在叶子且所有叶子均在 S（此时所有父级亦全选）
const isAllChecked =
    allLeafKeys.length > 0 &&
    allLeafKeys.every(key => authorizedSet.has(key));

/**
 * 全选 / 取消全选（D9）：
 *  - 全选态 → 清空 S（全树回到未选，含所有空半选父级）
 *  - 非全选态 → S = 全部节点 key（所有父级达全选）
 */
const handleToggleAll = () => {
    if (!allNodeKeys.length) return;
    setAuthorizedSet(isAllChecked ? new Set() : new Set(allNodeKeys));
};
```

> **取消全选清空 S**：直接 `new Set()`，所有父级（含空半选）一并回到未选。这会覆盖用户先前手动设置的空半选 —— 符合 D9「全树清空」语义。

---

## 7. 回显逻辑（D7）

```ts
/**
 * @description 收集后端已分配权限树的【全部节点 id】（含父级，深度优先）。
 *              替代原 collectLeafPermissionIds（仅收叶子）。
 *              新方案把全部命中 id 灌入 S，三态由 S 派生：
 *               - 父级+全部子级都在 → 全选
 *               - 父级+部分子级在 → 半选
 *               - 父级在、子级全空（childPermissions=[]）→ 空半选（D7）
 * @param list 后端 getPermissions({roleId}) 返回的已分配权限树
 * @returns 全部命中节点 id
 */
const collectAssignedIds = (list: AuthPermission[]): number[] => {
    const ids: number[] = [];
    const walk = (nodes: AuthPermission[]) => {
        (nodes || []).forEach(node => {
            ids.push(node.id);
            if (node.childPermissions?.length) walk(node.childPermissions);
        });
    };
    walk(list);
    return ids;
};
```

`loadPermissions` 回显处（原 176-180）改为：

```ts
if (roleRes.code === 200 && roleRes.message === "success") {
    const roleList = roleRes.data || [];
    // 把已分配的全部节点 id（含父级）灌入 S，三态由 S 派生
    setAuthorizedSet(new Set(collectAssignedIds(roleList)));
}
```

> **回显三态覆盖验证**：
> - 全选父级：`roleRes` 含父级 + 全部子级 → 全灌入 S → 父级全选 ✓
> - 半选父级：含父级 + 部分子级 → 父级半选 ✓
> - **空半选**：含父级但 `childPermissions=[]` → 仅父级 id 入 S → 后代全空 → 空半选 ✓（D7）
>
> 依赖后端契约（§3.4 of SPEC_menu_permission）：被授权的父级节点本身须出现在返回树中。若后端只返叶子，空半选无法回显（降级见 §12 R3）。

---

## 8. 提交契约（D8 / D11）

```ts
/**
 * 提交权限分配（handleOk）：
 * S 即授权集合，直接展开为 id 数组上送。
 *  - 全选父级：父级 id + 全部子级 id 均在 S → 全上送（D8）
 *  - 半选父级：父级 id + 实际选中子级 id 在 S → 全上送
 *  - 空半选父级：仅父级 id 在 S → 上送父级 id（D1 独立授权）
 *  - 中间父级命中亦在 S → 一并上送（D11）
 *  - 未选节点不在 S → 不上送
 * 回显后直接提交 ≡ 交互后提交（S 是唯一数据源，天然一致）。
 */
const handleOk = async () => {
    if (!roleId) return;
    setSaving(true);
    try {
        const permissionIds = [...authorizedSet].map(key => Number(key));
        const res = await assignPermissions({ roleId, permissionIds });
        // ... 成功 / 失败提示沿用现有
    } finally {
        setSaving(false);
    }
};
```

> **与现有行为一致**：原 `collectCheckedPermissionKeys`（125-153）也是收集「选中 + 半选」父级 + 叶子，结果与新方案 `[...S]` 等价。新方案去掉了「遍历推导」步骤，直接用 S，更简单且无歧义。

---

## 9. 边界与异常

| 场景 | 行为 |
| --- | --- |
| 点父级（未选） | 全选：父级 + 全部后代 + 祖先进 S |
| 点父级（半选） | 全选：补齐后代，祖先已在 S |
| 点父级（全选） | 未选：移除父级 + 全部后代；**祖先保留**（变空半选或仍全选，视其他后代） |
| 点叶子（未选） | 选中：叶子 + 全部祖先进 S（D4） |
| 点叶子（选中） | 未选：移除叶子；**祖先保留**（D6 粘性） |
| 先全选父级 → 逐个取消全部子级 | 父级保留为**空半选**（规则③主场景） |
| 直接勾部分子级 → 再全部取消 | 父级同样保留为**空半选**（D6，与规则③一致） |
| 三层 A→B→C，取消 C 全部子级 | C 留空半选 → B 半选 → A 半选（D4 逐级向上） |
| 多层嵌套，点中间父级 B 全选→未选 | B 及其后代移出 S；A 保留（粘性）；A 因 B 不在 S 且可能无其他命中 → 空半选 |
| 「全选」按钮 | S = 全部节点 key（所有父级全选） |
| 「取消全选」按钮 | S = 空（全树未选，覆盖所有空半选，D9） |
| 回显「空半选」父级（`childPermissions=[]`） | 父级 id 入 S，后代全空 → 显示空半选；可展开 treeData 子级重新勾选 |
| 回显全选父级 | 父级 + 全部子级入 S → 全选 |
| 叶子节点 | 仅二态（选中 / 未选），无半选 |
| 单层结构（根直接是叶子） | toggle 叶子，无父级联动 |
| 多顶层权限树 | 全选按钮作用于全部顶层；祖先联动在各顶层内独立 |
| `destroyOnClose` + 重新打开 | 每次打开 `loadPermissions` 重建 S，无残留 |
| `treeData` 为空 | `toggleNode` / `deriveChecked` 短路返回空，全选按钮 disabled（`!allNodeKeys.length`） |
| `getPermissions({roleId})` 失败 | 沿用现有 `message.error`，S 保持空 |
| antd `halfChecked` 受控不被尊重 | 见 §12 R1 降级 |

---

## 10. 验收用例

### 10.1 规则①②④（标准联动，回归）

| # | 场景 | 预期 |
| --- | --- | --- |
| 1 | 未选父级，点父级 checkbox | 父级 + 全部子级实勾（全选） |
| 2 | 全选父级，手动取消 1 个子级 | 父级变半勾（半选），该子级空勾 |
| 3 | 半选父级，把剩余子级全部勾上 | 父级自动变实勾（全选） |

### 10.2 规则③（核心：持久半选）

| # | 场景 | 预期 |
| --- | --- | --- |
| 4 | 全选父级 → 逐个取消全部子级 | **父级保持半勾**（空半选），所有子级空勾 |
| 5 | 直接勾 1 个子级（父级派生半选）→ 取消该子级 | **父级保持半勾**（空半选，D6 与规则③一致） |
| 6 | 空半选父级，点父级 checkbox | 进入全选（子级全选） |
| 7 | 空半选父级 → 点进全选 → 再点父级 | 回到未选（父级 + 子级全空） |
| 8 | 三层 A→B→C，C 全选后取消全部 C 子级 | C 空半选 → B 半选 → A 半选（D4） |

### 10.3 取消路径区分（D5 / D6）

| # | 场景 | 预期 |
| --- | --- | --- |
| 9 | 全选态，**点子级**取消 | 仅该子级移除；父级保留（变半选或空半选） |
| 10 | 全选态，**点父级**取消 | 父级 + 全部子级移除（直接未选）；父级的祖先保留 |

### 10.4 全选按钮（D9）

| # | 场景 | 预期 |
| --- | --- | --- |
| 11 | 存在空半选父级，点「全选」 | 所有节点进 S，全部父级全选 |
| 12 | 全选态点「取消全选」 | S 清空，全树未选（含原空半选父级） |
| 13 | 部分选中态，按钮文案 | 显示「全选」（isAllChecked=false） |

### 10.5 回显（D7）

| # | 场景 | 预期 |
| --- | --- | --- |
| 14 | 后端返回父级 + 全部子级 | 父级全选 |
| 15 | 后端返回父级 + 部分子级 | 父级半选 |
| 16 | 后端返回父级，`childPermissions=[]` | 父级**空半选** |
| 17 | 回显后直接点确定 | 提交 id 集合 ≡ 回显 id 集合（一致） |

### 10.6 点 label（D10）

| # | 场景 | 预期 |
| --- | --- | --- |
| 18 | 点父级标题（未选） | 等同点 checkbox：进入全选 |
| 19 | 点父级标题（半选） | 等同点 checkbox：进入全选 |
| 20 | 点叶子标题 | 切换叶子选中 / 未选 |

### 10.7 提交（D8 / D11）

| # | 场景 | 预期上送 |
| --- | --- | --- |
| 21 | 父级全选 | 父级 id + 全部子级 id |
| 22 | 父级空半选 | 仅父级 id |
| 23 | 三层 A→B→C 勾选 C | A、B、C 三个 id 均上送 |

---

## 11. 改动文件清单

| 文件 | 改动类型 | 说明 |
| --- | --- | --- |
| `src/pages/AccessManagement/RoleManagement/PermissionModal/index.tsx` | **重写勾选逻辑** | 见下 |

**仅改动单文件**，无新增文件、无 i18n 新增（按钮文案「全选 / 取消全选」已存在）、无接口契约变更。

**PermissionModal 内部改动明细**：

| 原成员 | 处置 |
| --- | --- |
| `checkedKeys` state | → 替换为 `authorizedSet: Set<React.Key>` |
| `collectLeafPermissionIds`（68-81） | → 替换为 `collectAssignedIds`（§7） |
| `collectSubtreeLeafKeys`（88-114） | → **删除**，由 `toggleNode` + `collectSubtreeKeys` / `collectAncestorKeys` 取代（§6.1/§6.3） |
| `collectCheckedPermissionKeys`（125-153） | → **删除**，提交用 `[...authorizedSet]`（§8） |
| `collectAllLeafKeys`（221-234） | → 保留（isAllChecked 判定用），另新增 `collectAllNodeKeys`（§6.4） |
| `onCheck`（196-198） | → 改为调 `toggleNode(info.node.key)` |
| `onSelect`（205-214） | → 改为调同一 `toggleNode`（D10） |
| `handleToggleAll`（251-254） | → 改为操作 S（§6.4） |
| `handleOk` 提交段（264-270） | → `[...authorizedSet].map(Number)` |
| `loadPermissions` 回显段（176-180） | → `setAuthorizedSet(new Set(collectAssignedIds(roleList)))` |
| `<Tree>`（318-329） | → `checkStrictly` + `checkedKeys={{ checked, halfChecked }}` |
| 文件头注释（1-18） | → 更新为新三态模型说明 |

---

## 12. 风险与注意事项

1. **R1 — antd `checkStrictly` 下 `halfChecked` 受控渲染**：`checkedKeys={{ checked, halfChecked }}` 在 `checkStrictly` 时由 antd 5 渲染半勾。**实施时首要验证点**：若当前 antd 5.x 版本不尊重受控 `halfChecked`（半勾不显示），降级方案：① 升级 antd 小版本至支持；② 或保留 `checkStrictly={false}` 但把 `checkedKeys` 仅设为 `checked`（实勾），半勾通过自定义 `title` 节点叠加 indeterminate 图标模拟（成本较高，不推荐）。首选验证 `checkStrictly + { checked, halfChecked }` 原生支持。

2. **R2 — `onCheck`/`onSelect` 双触发**：antd 中点 checkbox 触发 `onCheck`，点 title 触发 `onSelect`，两者互斥（不会同次点击双发）。两处都调 `toggleNode` 即可，无需防抖。

3. **R3 — 后端回显契约**：空半选回显依赖后端在 `getPermissions({roleId})` 返回的树中**包含被授权的父级节点**（即便其 `childPermissions=[]`）。若后端只返叶子，空半选无法回显（降级为未选），但不影响本次编辑会话内的交互。**须与后端确认**：角色权限树组装时，被独立授权（仅父级 id 无子级）的父级节点是否原样返回。

4. **R4 — 性能**：`collectSubtreeKeys` / `collectAncestorKeys` 每次递归遍历整树，`toggleNode` 单次点击调 O(1) 次遍历；`deriveChecked` 单次 O(n) 遍历（memo）。权限树规模小（实测几十~几百节点）可接受。若树变大，预构 `useMemo(() => buildKeyIndex(treeData))` 映射 `key → { subtree, ancestors }`，查询降至 O(1)。

5. **R5 — 与消费端契约**（菜单动态渲染，见 [[SPEC_menu_permission]]）：本弹窗提交的 `permissionIds` 经后端落库后，在登录接口的 `permissionsTree` 中还原为权限树。空半选父级（仅父级 id）须能在消费端正确还原为「父菜单可见、无子权限」—— 这要求后端 `permissionsTree` 组装时保留「仅有父级 id」的节点（与 R3 同一契约）。

6. **R6 — `Set` 不可序列化**：`authorizedSet` 仅在组件内存中，不进 localStorage（本就是弹窗内瞬时状态，`destroyOnClose` 关闭即销毁），无序列化问题。

---

## 13. 未决 / 后续

- **后端契约确认（R3/R5）**：被独立授权的父级节点（无子级）在 `getPermissions({roleId})` 与登录 `permissionsTree` 中是否原样返回。若不返回，空半选仅会话内有效，回显降级。
- **大权限树性能优化（R4）**：若后续权限节点增长，预构 `key → { subtree, ancestors }` 索引。
- **键盘可访问性**：antd Tree 自带键盘操作（Space 切换勾选），`checkStrictly` 模式下应仍触发 `onCheck` → `toggleNode`，三态循环对键盘可用。实施时顺带验证。
- **测试**：项目无单测（CLAUDE.md），按 §10 验收用例手动验证。

> **Git 操作由用户决定**（CLAUDE.md 规定 Claude 不主动操作 git）。本规格仅描述实现方案，提交 / 分支动作交由用户。
