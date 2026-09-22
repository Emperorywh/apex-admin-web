import type { Connection, Edge, Node, XYPosition } from '@xyflow/react'
import type { ActionCombination } from './action.model'
import type { AxisMotor } from '../axis-motor/axisMotor.types'
import {
	EMPTY_PICKUP,
	validateActionConfiguration,
	type EForkPickupSettings,
} from './workflow.action'

/** 节点种类仅描述当前编辑器支持的配置，不会直接向机器人下发指令。 */
export type WorkflowKind =
	'start' | 'end' | 'action' | 'condition' | 'http' | 'delay'

/** 每条条件对应一个独立输出端口；未命中任何条件时统一进入 else 端口。 */
export interface WorkflowBranch {
	id: string
	variable: string
	operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains'
	value: string
}

/** 参数随节点参与会话编辑与导出；预制名称使用中文翻译键，用户输入保持原文。 */
export interface WorkflowNodeData extends Record<string, unknown> {
	kind: WorkflowKind
	label: string
	description: string
	actionId?: string
	/** 仅 E叉取货使用轴配置；其他动作无需创建无业务意义的电机字段。 */
	pickup?: EForkPickupSettings
	target: string
	timeout: number
	retries: number
	method: string
	url: string
	body: string
	duration: number
	branches: WorkflowBranch[]
	inputs: {
		id: string
		name: string
		type: 'string' | 'number' | 'boolean'
		required: boolean
	}[]
}

/** 自定义节点统一使用 workflow 渲染器，连线保留 React Flow 的原生数据结构。 */
export type WorkflowNode = Node<WorkflowNodeData, 'workflow'>
export type WorkflowEdge = Edge

/** 文档只表示当前编辑会话的流程，不包含浏览器缓存或本地发布状态。 */
export interface WorkflowDocument {
	id: string
	name: string
	nodes: WorkflowNode[]
	edges: WorkflowEdge[]
}

/** 动作库按车型和控制能力分组；所有可见文案均交由界面的 action 命名空间翻译。 */
export interface ActionPreset {
	id: string
	group: string
	label: string
	description: string
	kind: WorkflowKind
}

/** 预制库完整覆盖四类车型，并补充现有顺序组合使用的通用动作。 */
export const ACTION_PRESETS: ActionPreset[] = [
	{
		id: 'amr-pick',
		group: 'AMR双轮差速动作库',
		label: 'AMR顶升取货动作',
		description: '顶升货架并确认取货完成',
		kind: 'action',
	},
	{
		id: 'amr-drop',
		group: 'AMR双轮差速动作库',
		label: 'AMR顶升放货动作',
		description: '下降货架并确认放货完成',
		kind: 'action',
	},
	{
		id: 'amr-recognize',
		group: 'AMR双轮差速动作库',
		label: 'AMR货架识别动作',
		description: '识别货架位置与货架编码',
		kind: 'action',
	},
	{
		id: 'efork-recognize',
		group: 'E叉双轮差速动作库',
		label: 'E叉栈板识别动作',
		description: '识别栈板位置与姿态',
		kind: 'action',
	},
	{
		id: 'efork-pick',
		group: 'E叉双轮差速动作库',
		label: 'E叉取货动作',
		description: '对准栈板并完成叉取',
		kind: 'action',
	},
	{
		id: 'efork-drop',
		group: 'E叉双轮差速动作库',
		label: 'E叉放货动作',
		description: '将栈板放置到指定货位',
		kind: 'action',
	},
	{
		id: 'sidefork-recognize',
		group: '侧叉双轮差速动作',
		label: '侧叉识别动作',
		description: '识别侧向货位与货物姿态',
		kind: 'action',
	},
	{
		id: 'sidefork-pick',
		group: '侧叉双轮差速动作',
		label: '侧叉取货动作',
		description: '从侧向货位完成取货',
		kind: 'action',
	},
	{
		id: 'sidefork-drop',
		group: '侧叉双轮差速动作',
		label: '侧叉放货动作',
		description: '将货物放置到侧向货位',
		kind: 'action',
	},
	{
		id: 'forklift-drop',
		group: '单舵轮叉车',
		label: '叉车放货',
		description: '将托盘放置到目标库位',
		kind: 'action',
	},
	{
		id: 'forklift-charge',
		group: '单舵轮叉车',
		label: '叉车充电',
		description: '与充电桩对接并开始充电',
		kind: 'action',
	},
	{
		id: 'forklift-pick',
		group: '单舵轮叉车',
		label: '叉车取货',
		description: '叉取目标托盘并确认到位',
		kind: 'action',
	},
	{
		id: 'navigate',
		group: '通用动作',
		label: '导航到点',
		description: '规划路径并到达指定站点',
		kind: 'action',
	},
	{
		id: 'dock',
		group: '通用动作',
		label: '精确对接',
		description: '完成工位或设备的精确对接',
		kind: 'action',
	},
	{
		id: 'wait-signal',
		group: '通用动作',
		label: '等待信号',
		description: '等待外部设备返回允许信号',
		kind: 'action',
	},
	{
		id: 'exit-station',
		group: '通用动作',
		label: '退出站点',
		description: '退出当前工位并到达安全点',
		kind: 'action',
	},
	{
		id: 'lift',
		group: '通用动作',
		label: '顶升',
		description: '抬升承载机构至作业高度',
		kind: 'action',
	},
	{
		id: 'lower',
		group: '通用动作',
		label: '下降',
		description: '降低承载机构并释放货物',
		kind: 'action',
	},
	{
		id: 'fork-pick',
		group: '通用动作',
		label: '叉取',
		description: '叉取并固定目标货物',
		kind: 'action',
	},
	{
		id: 'drop',
		group: '通用动作',
		label: '放货',
		description: '将货物释放到目标位置',
		kind: 'action',
	},
	{
		id: 'roller-load',
		group: '通用动作',
		label: '辊筒接货',
		description: '驱动辊筒接收输送线货物',
		kind: 'action',
	},
	{
		id: 'roller-unload',
		group: '通用动作',
		label: '辊筒送货',
		description: '驱动辊筒向输送线发送货物',
		kind: 'action',
	},
	{
		id: 'charge',
		group: '通用动作',
		label: '开始充电',
		description: '确认充电连接并开始充电',
		kind: 'action',
	},
	{
		id: 'condition',
		group: '流程控制',
		label: '条件分支',
		description: '根据变量条件选择后续执行路径',
		kind: 'condition',
	},
	{
		id: 'http',
		group: '流程控制',
		label: 'HTTP 请求',
		description: '配置与外部服务交互的请求',
		kind: 'http',
	},
	{
		id: 'delay',
		group: '流程控制',
		label: '延时等待',
		description: '等待指定时长后继续下一步',
		kind: 'delay',
	},
	{
		id: 'end',
		group: '流程控制',
		label: '结束',
		description: '完成当前执行路径',
		kind: 'end',
	},
]

/** 新建节点始终生成独立标识；业务目标、请求地址和流程输入留空，由用户明确配置。 */
export function createWorkflowNode(
	kind: WorkflowKind,
	position: XYPosition,
	presetId?: string,
): WorkflowNode {
	const preset = ACTION_PRESETS.find(
		(item) => item.id === presetId && item.kind === kind,
	)
	const labels: Record<WorkflowKind, string> = {
		start: '开始',
		end: '结束',
		action: '动作节点',
		condition: '条件分支',
		http: 'HTTP 请求',
		delay: '延时等待',
	}
	return {
		id: `node-${crypto.randomUUID()}`,
		type: 'workflow',
		position,
		// 开始与结束是流程必备节点，菜单与画布快捷键统一读取此删除权限。
		deletable: kind !== 'start' && kind !== 'end',
		data: {
			kind,
			label: preset?.label ?? labels[kind],
			description: preset?.description ?? '',
			...(preset?.kind === 'action' ? { actionId: preset.id } : {}),
			...(preset?.id === 'efork-pick'
				? { pickup: { ...EMPTY_PICKUP } }
				: {}),
			target: '',
			timeout: 60,
			retries: 0,
			method: 'GET',
			url: '',
			body: '',
			duration: 5,
			branches:
				kind === 'condition'
					? [{ id: 'if', variable: '', operator: 'eq', value: '' }]
					: [],
			inputs: [],
		},
	}
}

/** 已有组合的相邻步骤按普通输入输出端口连接，新增流程不预建连线。 */
function createEdge(source: WorkflowNode, target: WorkflowNode): WorkflowEdge {
	return {
		id: `edge-${crypto.randomUUID()}`,
		source: source.id,
		target: target.id,
		sourceHandle: 'output',
		targetHandle: 'input',
		type: 'smoothstep',
	}
}

/** 新增默认提供开始、结束节点，留出中间编排空间；已有组合加载业务步骤与连接。 */
export function createWorkflowDocument(
	id: string,
	combination?: ActionCombination,
): WorkflowDocument {
	const start = createWorkflowNode('start', { x: 80, y: 180 })
	const end = createWorkflowNode('end', { x: 720, y: 180 })
	if (!combination) return { id, name: '', nodes: [start, end], edges: [] }
	const steps = combination.steps.map((step) => {
		const preset = ACTION_PRESETS.find(
			(item) => item.kind === 'action' && item.label === step.action,
		)
		const node = createWorkflowNode('action', { x: 0, y: 0 }, preset?.id)
		node.data = {
			...node.data,
			label: step.action,
			target: step.target,
			timeout: step.timeout,
		}
		return node
	})
	const nodes = [start, ...steps, end]
	const edges = nodes
		.slice(1)
		.map((node, index) => createEdge(nodes[index], node))
	return {
		id,
		name: combination.name,
		nodes: layoutWorkflow(nodes, edges),
		edges,
	}
}

/** 遍历使用显式队列与访问集合，遇到循环或大图时仍能终止，避免递归栈溢出。 */
function collectReachable(
	initialIds: string[],
	adjacency: Map<string, string[]>,
): Set<string> {
	const visited = new Set<string>()
	const queue = [...initialIds]
	for (let index = 0; index < queue.length; index += 1) {
		const id = queue[index]
		if (visited.has(id)) continue
		visited.add(id)
		queue.push(...(adjacency.get(id) ?? []))
	}
	return visited
}

/** 为前向和反向检查创建邻接表；不存在的端点留给连线校验报告，不污染有效节点的图。 */
function buildAdjacency(
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
	reverse = false,
): Map<string, string[]> {
	const adjacency = new Map(nodes.map((node) => [node.id, [] as string[]]))
	edges.forEach((edge) => {
		const from = reverse ? edge.target : edge.source
		const to = reverse ? edge.source : edge.target
		if (adjacency.has(from) && adjacency.has(to))
			adjacency.get(from)!.push(to)
	})
	return adjacency
}

/** 开始不能有输入、结束不能有输出；输出端口仅容纳一条边，输入端口允许不同执行路径汇合。 */
export function canConnect(
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
	connection: Connection,
): boolean {
	const source = nodes.find((node) => node.id === connection.source)
	const target = nodes.find((node) => node.id === connection.target)
	if (
		!source ||
		!target ||
		source.id === target.id ||
		source.data.kind === 'end' ||
		target.data.kind === 'start'
	)
		return false
	const sourceHandle = connection.sourceHandle ?? 'output'
	const targetHandle = connection.targetHandle ?? 'input'
	const sourceHandles =
		source.data.kind === 'condition'
			? [...source.data.branches.map((branch) => branch.id), 'else']
			: ['output']
	if (!sourceHandles.includes(sourceHandle) || targetHandle !== 'input')
		return false
	if (
		edges.some(
			(edge) =>
				edge.source === source.id &&
				(edge.sourceHandle ?? 'output') === sourceHandle,
		)
	)
		return false
	// 新边的目标若已能到达起点，将闭合一个环，因此在连接落入画布前拒绝。
	return !collectReachable([target.id], buildAdjacency(nodes, edges)).has(
		source.id,
	)
}

/** 校验错误保留节点标识供界面定位；文案全部作为中文翻译键返回，不在模型层绑定语言。 */
export function validateWorkflow(
	doc: WorkflowDocument,
	motors: AxisMotor[],
): { nodeId?: string; message: string }[] {
	const issues: { nodeId?: string; message: string }[] = []
	const add = (message: string, nodeId?: string) => {
		issues.push({ nodeId, message })
	}
	if (!doc.name.trim()) add('请输入动作组合名称')
	const starts = doc.nodes.filter((node) => node.data.kind === 'start')
	const ends = doc.nodes.filter((node) => node.data.kind === 'end')
	if (starts.length !== 1) add('工作流必须包含且仅包含一个开始节点')
	if (ends.length === 0) add('请添加至少一个结束节点')
	if (!doc.nodes.some((node) => node.data.kind === 'action'))
		add('请添加至少一个动作节点')
	if (new Set(doc.nodes.map((node) => node.id)).size !== doc.nodes.length)
		add('节点标识重复，请删除重复节点')
	if (new Set(doc.edges.map((edge) => edge.id)).size !== doc.edges.length)
		add('连线标识重复，请重新连接')

	// 逐条接纳边即可检测非法端口、占用和循环；可达性仍使用全图，以补充无出口等具体错误。
	const accepted: WorkflowEdge[] = []
	doc.edges.forEach((edge) => {
		if (
			!canConnect(doc.nodes, accepted, {
				source: edge.source,
				target: edge.target,
				sourceHandle: edge.sourceHandle ?? null,
				targetHandle: edge.targetHandle ?? null,
			})
		) {
			add('连线无效：请检查端口占用、节点方向或循环连接', edge.source)
		} else accepted.push(edge)
	})
	const reachable = collectReachable(
		starts.map((node) => node.id),
		buildAdjacency(doc.nodes, doc.edges),
	)
	// 反向邻接表同时服务结束可达性和变量来源校验，避免各条件节点重复构建整张图。
	const reverseAdjacency = buildAdjacency(doc.nodes, doc.edges, true)
	const canFinish = collectReachable(
		ends.map((node) => node.id),
		reverseAdjacency,
	)
	doc.nodes.forEach((node) => {
		const { data, id } = node
		if (data.kind !== 'action' && !data.label.trim())
			add('请输入节点名称', id)
		if (!reachable.has(id)) add('节点无法从开始节点到达', id)
		if (!canFinish.has(id)) add('此执行路径无法到达结束节点', id)
		if (
			doc.nodes.length > 1 &&
			!doc.edges.some((edge) => edge.source === id || edge.target === id)
		)
			add('节点尚未连接到工作流', id)
		if (data.kind !== 'end') {
			const handles =
				data.kind === 'condition'
					? [...data.branches.map((branch) => branch.id), 'else']
					: ['output']
			if (
				handles.some(
					(handle) =>
						!doc.edges.some(
							(edge) =>
								edge.source === id &&
								(edge.sourceHandle ?? 'output') === handle,
						),
				)
			)
				add('请连接所有输出分支的下一步节点', id)
		}
		if (data.kind === 'http') {
			if (
				!Number.isInteger(data.timeout) ||
				data.timeout < 1 ||
				data.timeout > 86400
			)
				add('超时时间必须是 1 到 86400 之间的整数', id)
			if (
				!Number.isInteger(data.retries) ||
				data.retries < 0 ||
				data.retries > 10
			)
				add('重试次数必须是 0 到 10 之间的整数', id)
		}
		if (data.kind === 'action')
			validateActionConfiguration(data, motors).forEach((message) =>
				add(message, id),
			)
		if (data.kind === 'http') {
			try {
				const url = new URL(data.url)
				if (!['http:', 'https:'].includes(url.protocol))
					add('请输入有效的 HTTP 或 HTTPS 请求地址', id)
			} catch {
				add('请输入有效的 HTTP 或 HTTPS 请求地址', id)
			}
			if (
				![
					'GET',
					'POST',
					'PUT',
					'PATCH',
					'DELETE',
					'HEAD',
					'OPTIONS',
				].includes(data.method)
			)
				add('请选择有效的 HTTP 请求方法', id)
			// 请求体是可选 JSON；任何非空内容都必须可解析，防止发布后才暴露格式错误。
			if (data.body) {
				try {
					JSON.parse(data.body)
				} catch {
					add('请求体必须是有效的 JSON', id)
				}
			}
		}
		if (
			data.kind === 'delay' &&
			(!Number.isInteger(data.duration) ||
				data.duration < 1 ||
				data.duration > 86400)
		)
			add('等待时长必须是 1 到 86400 之间的整数', id)
		if (data.kind === 'condition') {
			if (data.branches.length === 0) add('请添加至少一个判断条件', id)
			if (
				new Set(data.branches.map((branch) => branch.id)).size !==
					data.branches.length ||
				data.branches.some(
					(branch) => !branch.id || branch.id === 'else',
				)
			)
				add('条件分支标识重复或无效', id)
			if (data.branches.some((branch) => !branch.variable.trim()))
				add('请填写条件变量', id)
			if (data.branches.some((branch) => !branch.value.trim()))
				add('请填写条件比较值', id)
			// 只接受配置面板列出的上游顶层变量；删除节点、断线或移除开始输入后，旧引用必须重新选择。
			const upstreamIds = collectReachable([id], reverseAdjacency)
			upstreamIds.delete(id)
			const variables = new Set(
				doc.nodes
					.filter((item) => upstreamIds.has(item.id))
					.flatMap((item) => {
						if (item.data.kind === 'start')
							return item.data.inputs.map((input) => input.name)
						if (item.data.kind === 'action')
							return [`${item.id}.success`, `${item.id}.result`]
						if (item.data.kind === 'http')
							return [`${item.id}.status_code`, `${item.id}.body`]
						return []
					}),
			)
			if (
				data.branches.some(
					(branch) =>
						branch.variable.trim() &&
						!variables.has(branch.variable),
				)
			)
				add('条件变量不存在于上游节点，请重新选择', id)
		}
		if (data.kind === 'start') {
			if (
				data.inputs.some(
					(input) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(input.name),
				)
			)
				add(
					'输入变量名须以字母或下划线开头，并仅包含字母、数字和下划线',
					id,
				)
			if (
				new Set(data.inputs.map((input) => input.name)).size !==
				data.inputs.length
			)
				add('输入变量名称不能重复', id)
		}
	})
	return issues
}

/** 使用拓扑层级从左向右排布，分支按稳定节点顺序分行；循环残留统一放在尾部，布局本身不会卡死。 */
export function layoutWorkflow(
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
): WorkflowNode[] {
	const adjacency = buildAdjacency(nodes, edges)
	const inDegree = new Map(nodes.map((node) => [node.id, 0]))
	const levels = new Map(nodes.map((node) => [node.id, 0]))
	adjacency.forEach((targets) =>
		targets.forEach((target) =>
			inDegree.set(target, inDegree.get(target)! + 1),
		),
	)
	const queue = nodes
		.filter((node) => inDegree.get(node.id) === 0)
		.map((node) => node.id)
	for (let index = 0; index < queue.length; index += 1) {
		const id = queue[index]
		adjacency.get(id)?.forEach((target) => {
			levels.set(
				target,
				Math.max(levels.get(target)!, levels.get(id)! + 1),
			)
			inDegree.set(target, inDegree.get(target)! - 1)
			if (inDegree.get(target) === 0) queue.push(target)
		})
	}
	const unresolvedLevel = Math.max(0, ...levels.values()) + 1
	const rows = new Map<number, number>()
	return nodes.map((node) => {
		const level =
			inDegree.get(node.id)! > 0 ? unresolvedLevel : levels.get(node.id)!
		const row = rows.get(level) ?? 0
		rows.set(level, row + 1)
		// 预留 320 像素层距和 220 像素行距，使普通卡片及条件输出拥有可读的连线空间。
		return {
			...node,
			position: { x: 80 + level * 320, y: 180 + row * 220 },
		}
	})
}
