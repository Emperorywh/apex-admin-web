import { useTranslation } from 'react-i18next'
import { Button, Tooltip } from 'antd'
import { ArrowRight, Link2Off, Plus } from 'lucide-react'
import type { WorkflowConfigProps } from '../../../workflow.components.types'
import { getWorkflowPorts } from '../../../workflow.presentation'
import { WorkflowIcon } from '../../WorkflowIcon/WorkflowIcon'
import styles from './WorkflowNextSteps.module.css'
import formStyles from '../workflowForm.module.css'

/** 下一步按真实端口和出边展示；添加、切换和断开操作交回父级，断开时保留目标节点。 */
export function WorkflowNextSteps({
	node,
	nodes,
	edges,
	onAddNext,
	onSelectNode,
	onDisconnect,
}: Pick<WorkflowConfigProps, 'node' | 'nodes' | 'edges'> & {
	onAddNext: (handle: string) => void
	onSelectNode: (id: string) => void
	onDisconnect: (edgeId: string) => void
}) {
	const { t } = useTranslation('action')
	const data = node.data
	const outgoing = edges.filter((edge) => edge.source === node.id)
	const ports = getWorkflowPorts(data)
	if (!ports.length) return null
	return (
		<section className={`${formStyles.section} ${styles.nextSection}`}>
			<h3>{t('下一步')}</h3>
			<p className={formStyles.hint}>
				{t('添加此节点之后要执行的步骤。')}
			</p>
			<div className={styles.nextTree}>
				<WorkflowIcon kind={data.kind} actionId={data.actionId} />
				<div className={styles.nextBranches}>
					{ports.map((port) => {
						const connections = outgoing.filter(
							(edge) =>
								(edge.sourceHandle ?? 'output') === port.id,
						)
						return (
							<div key={port.id} className={styles.nextBranch}>
								<span className={styles.portLabel}>
									{t(port.label)}
								</span>
								{connections.length ? (
									connections.map((edge) => {
										const target = nodes.find(
											(item) => item.id === edge.target,
										)
										return target ? (
											<div
												key={edge.id}
												className={styles.connectedNode}
											>
												<button
													type="button"
													onClick={() =>
														onSelectNode(target.id)
													}
												>
													<WorkflowIcon
														kind={target.data.kind}
														actionId={
															target.data.actionId
														}
														size={12}
													/>
													<span>
														{t(target.data.label)}
													</span>
													<ArrowRight size={12} />
												</button>
												<Tooltip title={t('断开连接')}>
													<Button
														type="text"
														size="small"
														aria-label={t(
															'断开连接',
														)}
														icon={
															<Link2Off
																size={13}
															/>
														}
														onClick={() =>
															onDisconnect(
																edge.id,
															)
														}
													/>
												</Tooltip>
											</div>
										) : null
									})
								) : (
									<button
										type="button"
										className={styles.addNext}
										onClick={() => onAddNext(port.id)}
									>
										<Plus size={14} />
										{t('选择下一个节点')}
									</button>
								)}
							</div>
						)
					})}
				</div>
			</div>
		</section>
	)
}
