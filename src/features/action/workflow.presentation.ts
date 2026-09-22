import type { WorkflowKind, WorkflowNodeData } from './workflow.model'

/** 公共外壳只读取交互能力；节点类型的差异集中维护，避免在卡片和面板重复判断。 */
export const WORKFLOW_NODE_BEHAVIOR = {
	start: {
		hasInput: false,
		editable: false,
		output: 'single',
		testable: false,
	},
	action: {
		hasInput: true,
		editable: true,
		output: 'single',
		testable: true,
	},
	condition: {
		hasInput: true,
		editable: true,
		output: 'branches',
		testable: false,
	},
	http: { hasInput: true, editable: true, output: 'single', testable: false },
	delay: {
		hasInput: true,
		editable: true,
		output: 'single',
		testable: false,
	},
	end: { hasInput: true, editable: true, output: 'none', testable: false },
} as const satisfies Record<
	WorkflowKind,
	{
		hasInput: boolean
		editable: boolean
		output: 'single' | 'branches' | 'none'
		testable: boolean
	}
>

/** 端口标识参与实际连线；标签保留翻译键，由界面按当前语言显示。 */
export function getWorkflowPorts(data: WorkflowNodeData) {
	const output = WORKFLOW_NODE_BEHAVIOR[data.kind].output
	if (output === 'none') return []
	if (output === 'branches')
		return [
			...data.branches.map((branch, index) => ({
				id: branch.id,
				label: index === 0 ? 'IF' : `ELIF ${index}`,
			})),
			{ id: 'else', label: 'ELSE' },
		]
	return [{ id: 'output', label: '执行完成后' }]
}

/** 输出契约同时服务输出页签和上游变量选择，描述在消费组件中翻译。 */
interface WorkflowOutput {
	name: string
	type: string
	description: string
}
const outputDefinitions: Record<
	WorkflowKind,
	(data: WorkflowNodeData) => WorkflowOutput[]
> = {
	start: (data) =>
		data.inputs.map((input) => ({
			name: input.name,
			type: input.type,
			description: input.required ? '必填输入变量' : '可选输入变量',
		})),
	action: () => [
		{ name: 'success', type: 'boolean', description: '动作是否执行成功' },
		{ name: 'result', type: 'object', description: '动作返回的数据' },
	],
	http: () => [
		{ name: 'status_code', type: 'number', description: 'HTTP 响应状态码' },
		{ name: 'body', type: 'string', description: 'HTTP 响应正文' },
	],
	condition: () => [],
	delay: () => [],
	end: () => [],
}

/** 返回当前节点的输出字段；无输出的节点保持空数组，不制造占位变量。 */
export function getWorkflowOutputs(data: WorkflowNodeData) {
	return outputDefinitions[data.kind](data)
}
