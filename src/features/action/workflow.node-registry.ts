import type { ComponentType } from 'react'
import type { WorkflowKind, WorkflowNodeData } from './workflow.model'
import type { WorkflowSummaryProps } from './workflow.components.types'
import { StartNodeSummary } from './components/nodes/StartNodeSummary/StartNodeSummary'
import { ActionNodeSummary } from './components/nodes/ActionNodeSummary/ActionNodeSummary'
import { ConditionNodeSummary } from './components/nodes/ConditionNodeSummary/ConditionNodeSummary'
import { HttpNodeSummary } from './components/nodes/HttpNodeSummary/HttpNodeSummary'
import { DelayNodeSummary } from './components/nodes/DelayNodeSummary/DelayNodeSummary'
import { EndNodeSummary } from './components/nodes/EndNodeSummary/EndNodeSummary'
import { EForkPickupNodeSummary } from './components/nodes/EForkPickupNodeSummary/EForkPickupNodeSummary'
/** 六类节点必须全部注册；参数契约一致的预制动作复用通用动作组件。 */
const kindComponents: Record<
	WorkflowKind,
	ComponentType<WorkflowSummaryProps>
> = {
	start: StartNodeSummary,
	action: ActionNodeSummary,
	condition: ConditionNodeSummary,
	http: HttpNodeSummary,
	delay: DelayNodeSummary,
	end: EndNodeSummary,
}

/** 只有实际存在专属参数的动作覆盖通用实现，不创建空包装组件。 */
const actionComponents: Partial<
	Record<string, ComponentType<WorkflowSummaryProps>>
> = {
	'efork-pick': EForkPickupNodeSummary,
}

/** 动作先查专属组件，其余按节点类型分派；组件定义保持模块级稳定，编辑不会重新挂载。 */
export function getWorkflowSummary(data: WorkflowNodeData) {
	return (
		(data.kind === 'action' && data.actionId
			? actionComponents[data.actionId]
			: undefined) ?? kindComponents[data.kind]
	)
}
