import type { ComponentType } from 'react'
import type { WorkflowKind, WorkflowNodeData } from './workflow.model'
import type { WorkflowConfigProps } from './workflow.components.types'
import { StartNodeConfig } from './components/panels/StartNodeConfig/StartNodeConfig'
import { ActionNodeConfig } from './components/panels/ActionNodeConfig/ActionNodeConfig'
import { ConditionNodeConfig } from './components/panels/ConditionNodeConfig/ConditionNodeConfig'
import { HttpNodeConfig } from './components/panels/HttpNodeConfig/HttpNodeConfig'
import { DelayNodeConfig } from './components/panels/DelayNodeConfig/DelayNodeConfig'
import { EndNodeConfig } from './components/panels/EndNodeConfig/EndNodeConfig'
import { EForkPickupNodeConfig } from './components/panels/EForkPickupNodeConfig/EForkPickupNodeConfig'
/** 六类节点必须全部注册；参数契约一致的预制动作复用通用动作组件。 */
const kindComponents: Record<
	WorkflowKind,
	ComponentType<WorkflowConfigProps>
> = {
	start: StartNodeConfig,
	action: ActionNodeConfig,
	condition: ConditionNodeConfig,
	http: HttpNodeConfig,
	delay: DelayNodeConfig,
	end: EndNodeConfig,
}

/** 只有实际存在专属参数的动作覆盖通用实现，不创建空包装组件。 */
const actionComponents: Partial<
	Record<string, ComponentType<WorkflowConfigProps>>
> = {
	'efork-pick': EForkPickupNodeConfig,
}

/** 动作先查专属组件，其余按节点类型分派；组件定义保持模块级稳定，编辑不会重新挂载。 */
export function getWorkflowConfig(data: WorkflowNodeData) {
	return (
		(data.kind === 'action' && data.actionId
			? actionComponents[data.actionId]
			: undefined) ?? kindComponents[data.kind]
	)
}
