import type { AxisMotor } from '../axis-motor/axisMotor.types'
import type {
	WorkflowEdge,
	WorkflowNode,
	WorkflowNodeData,
} from './workflow.model'

/** 摘要读取已应用的数据；节点标识仅用于条件端口与追加节点操作。 */
export interface WorkflowSummaryProps {
	id: string
	data: WorkflowNodeData
}

/** 专属配置只提交数据补丁；节点、连线与撤销历史仍由编辑器统一维护。 */
export interface WorkflowConfigProps {
	node: WorkflowNode
	nodes: WorkflowNode[]
	edges: WorkflowEdge[]
	motors: AxisMotor[]
	motorStorageWarning: boolean
	onChange: (data: Partial<WorkflowNodeData>) => void
	/** E叉取货显式应用轴参数，并把未应用状态交给页面离开提醒。 */
	onApply: (data: Partial<WorkflowNodeData>) => boolean
	onPendingChange: (pending: boolean) => void
}
