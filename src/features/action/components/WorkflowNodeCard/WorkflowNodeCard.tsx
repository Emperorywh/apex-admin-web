import { memo, useContext, useEffect } from 'react'
import {
	Handle,
	Position,
	useUpdateNodeInternals,
	type NodeProps,
} from '@xyflow/react'
import { Box, Clock3, Copy, Ellipsis, Plus, Trash2 } from 'lucide-react'
import { Dropdown, type MenuProps } from 'antd'
import { useTranslation } from 'react-i18next'
import type { WorkflowNode } from '../../workflow.model'
import { WorkflowNodeActions } from '../../workflow.context'
import { WorkflowIcon } from '../WorkflowIcon/WorkflowIcon'
import styles from './WorkflowNodeCard.module.css'

/** 紧凑节点卡片只展示参数摘要；完整配置由右侧面板维护，端口支持拖线和点击追加节点。 */
export const WorkflowNodeCard = memo(function WorkflowNodeCard({
	id,
	data,
	selected,
}: NodeProps<WorkflowNode>) {
	const { t } = useTranslation('action')
	const actions = useContext(WorkflowNodeActions)
	const updateInternals = useUpdateNodeInternals()
	const branchIds = data.branches.map((branch) => branch.id).join(',')
	// 动态增删条件端口后重新测量，避免连线仍指向已移除分支的位置。
	useEffect(() => {
		updateInternals(id)
	}, [id, branchIds, updateInternals])
	// 卡片只展示变量末段与比较值，完整来源在配置选择器中用节点名称表示，不暴露内部标识。
	const operators = { eq: '=', neq: '≠', gt: '>', lt: '<', contains: '⊃' }
	const ports =
		data.kind === 'condition'
			? [
					...data.branches.map((branch, index) => ({
						id: branch.id,
						label: index === 0 ? 'IF' : 'ELIF',
						value: branch.variable
							? `${branch.variable.split('.').at(-1)} ${operators[branch.operator]} ${branch.value}`
							: t('未配置条件'),
					})),
					{ id: 'else', label: 'ELSE', value: t('其他情况') },
				]
			: []
	// 右键与更多按钮共用菜单，始终操作当前卡片；开始节点保留唯一入口，不允许复制或删除。
	const menu: MenuProps = {
		items: [
			{
				key: 'copy',
				icon: <Copy size={14} />,
				label: t('复制'),
				disabled: data.kind === 'start',
			},
			{
				key: 'delete',
				icon: <Trash2 size={14} />,
				label: t('删除'),
				danger: true,
				disabled: data.kind === 'start',
			},
		],
		onClick: ({ key, domEvent }) => {
			domEvent.stopPropagation()
			if (key === 'copy') actions.onDuplicate(id)
			else if (key === 'delete') actions.onDelete(id)
		},
	}
	// 右键菜单跟随鼠标定位并接收键盘焦点；阻止默认菜单及事件冒泡，避免触发画布添加节点。
	return (
		<Dropdown trigger={['contextMenu']} menu={menu} autoFocus>
			<article
				className={`${styles.node} ${selected ? styles.selected : ''}`}
				onContextMenu={(event) => {
					event.preventDefault()
					event.stopPropagation()
				}}
			>
				{data.kind === 'start' && (
					<span className={styles.startLabel}>{t('流程入口')}</span>
				)}
				{data.kind !== 'start' && (
					<Handle
						type="target"
						position={Position.Left}
						id="input"
						className={styles.handle}
					/>
				)}
				<div className={styles.heading}>
					<WorkflowIcon kind={data.kind} actionId={data.actionId} />
					<strong title={t(data.label)}>{t(data.label)}</strong>
					{data.kind !== 'start' && (
						<Dropdown trigger={['click']} menu={menu}>
							<button
								className={`${styles.menu} nodrag nopan`}
								aria-label={t('节点操作')}
								onClick={(event) => event.stopPropagation()}
							>
								<Ellipsis size={16} />
							</button>
						</Dropdown>
					)}
				</div>
				{data.kind === 'start' && (
					<div className={styles.variables}>
						{data.inputs.map((input) => (
							<div key={input.id}>
								<span>
									<b>{'{x}'}</b> {input.name}
								</span>
								<small>
									{input.required ? t('必填') : t('可选')}
								</small>
							</div>
						))}
						{data.inputs.length === 0 && (
							<span>{t('工作流从这里开始')}</span>
						)}
					</div>
				)}
				{/* E叉取货摘要展示已应用的轴目标和启停状态，未配置时给出对应入口提示。 */}
				{data.kind === 'action' && (
					<div className={styles.summary}>
						<Box size={12} />
						<span>
							{data.actionId === 'efork-pick'
								? data.pickup?.enabled === false
									? t('动作已停用')
									: data.pickup?.liftHeight != null
										? t('顶升至 {{height}} mm', {
												height: data.pickup.liftHeight,
											})
										: t('请配置顶升轴与参数')
								: data.target || t('请配置目标位置')}
						</span>
					</div>
				)}
				{data.kind === 'condition' && (
					<div className={styles.branches}>
						{ports.map((port) => (
							<div key={port.id} className={styles.branch}>
								<span>{port.value}</span>
								<b>{port.label}</b>
								<Handle
									id={port.id}
									type="source"
									position={Position.Right}
									className={styles.handle}
								/>
								<button
									className={`${styles.addPort} nodrag nopan`}
									title={t('添加下一个节点')}
									aria-label={t('添加下一个节点')}
									onClick={(event) => {
										event.stopPropagation()
										actions.onAdd(id, port.id)
									}}
								>
									<Plus size={10} />
								</button>
							</div>
						))}
					</div>
				)}
				{data.kind === 'http' && (
					<div className={styles.summary}>
						<b>{data.method}</b>
						<span>{data.url || t('请配置请求地址')}</span>
					</div>
				)}
				{data.kind === 'delay' && (
					<div className={styles.summary}>
						<Clock3 size={12} />
						<span>
							{t('等待 {{seconds}} 秒', {
								seconds: data.duration,
							})}
						</span>
					</div>
				)}
				{data.kind === 'end' && (
					<div className={styles.endSummary}>{t('返回执行结果')}</div>
				)}
				{(data.kind === 'action' || data.kind === 'http') && (
					<div className={styles.footer}>
						<Clock3 size={11} />
						{t('{{seconds}} 秒超时', { seconds: data.timeout })}
						<span>·</span>
						{t('重试 {{count}} 次', { count: data.retries })}
					</div>
				)}
				{data.kind !== 'end' && data.kind !== 'condition' && (
					<>
						<Handle
							type="source"
							position={Position.Right}
							id="output"
							className={styles.handle}
						/>
						<button
							className={`${styles.addPort} ${styles.singlePort} nodrag nopan`}
							title={t('添加下一个节点')}
							aria-label={t('添加下一个节点')}
							onClick={(event) => {
								event.stopPropagation()
								actions.onAdd(id, 'output')
							}}
						>
							<Plus size={10} />
						</button>
					</>
				)}
			</article>
		</Dropdown>
	)
})
