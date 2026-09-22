import { useEffect, useRef, useState } from 'react'
import {
	Button,
	Checkbox,
	Dropdown,
	Input,
	InputNumber,
	Select,
	Tabs,
	Tooltip,
} from 'antd'
import {
	ArrowRight,
	Braces,
	Copy,
	Ellipsis,
	FlaskConical,
	Link2Off,
	Plus,
	Trash2,
	X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AxisMotor } from '../../../axis-motor/axisMotor.types'
import {
	ACTION_PRESETS,
	type WorkflowEdge,
	type WorkflowNode,
	type WorkflowNodeData,
} from '../../workflow.model'
import { EForkPickupConfig } from '../EForkPickupConfig/EForkPickupConfig'
import { WorkflowNodeTest } from '../WorkflowNodeTest/WorkflowNodeTest'
import { WorkflowIcon } from '../WorkflowIcon/WorkflowIcon'
import styles from './WorkflowInspector.module.css'

/** 配置面板只编辑选中节点；画布、连线与历史记录统一由父级维护。 */
interface WorkflowInspectorProps {
	node: WorkflowNode
	nodes: WorkflowNode[]
	edges: WorkflowEdge[]
	motors: AxisMotor[]
	motorStorageWarning: boolean
	/** 参数仅应用于当前流程，未应用的输入也必须参与页面离开提醒。 */
	onApply: (data: Partial<WorkflowNodeData>) => boolean
	onPendingChange: (pending: boolean) => void
	onChange: (data: Partial<WorkflowNodeData>) => void
	onClose: () => void
	onDelete: () => void
	onDuplicate: () => void
	onAddNext: (handle: string) => void
	onSelectNode: (id: string) => void
	onDisconnect: (edgeId: string) => void
}

/** 右侧固定宽度编辑区沿用画布节点颜色；所有表单即时更新草稿，不触发设备执行。 */
export function WorkflowInspector({
	node,
	nodes,
	edges,
	motors,
	motorStorageWarning,
	onApply,
	onPendingChange,
	onChange,
	onClose,
	onDelete,
	onDuplicate,
	onAddNext,
	onSelectNode,
	onDisconnect,
}: WorkflowInspectorProps) {
	const { t } = useTranslation('action')
	const data = node.data
	const panelRef = useRef<HTMLElement>(null)
	const [activeTab, setActiveTab] = useState('settings')
	const [testRequest, setTestRequest] = useState(0)
	// 等配置页签渲染后定位测试区；不自动启动，保留参数校验与用户明确点击的测试动作。
	useEffect(() => {
		if (testRequest > 0 && activeTab === 'settings')
			panelRef.current
				?.querySelector('[data-workflow-test]')
				?.scrollIntoView({ block: 'nearest' })
	}, [testRequest, activeTab])
	const fieldId = (name: string) => `workflow-${node.id}-${name}`
	const preset = ACTION_PRESETS.find((item) => item.id === data.actionId)
	const outgoing = edges.filter((edge) => edge.source === node.id)
	const ports =
		data.kind === 'condition'
			? [
					...data.branches.map((branch, index) => ({
						id: branch.id,
						label: index === 0 ? 'IF' : `ELIF ${index}`,
					})),
					{ id: 'else', label: 'ELSE' },
				]
			: data.kind === 'end'
				? []
				: [{ id: 'output', label: t('执行完成后') }]

	// 变量选择仅包含上游来源；显示业务节点名称，将稳定的内部引用保存在节点数据中。
	const upstreamIds = new Set<string>()
	const pending = [node.id]
	while (pending.length) {
		const target = pending.pop()
		edges
			.filter((edge) => edge.target === target)
			.forEach((edge) => {
				if (!upstreamIds.has(edge.source) && edge.source !== node.id) {
					upstreamIds.add(edge.source)
					pending.push(edge.source)
				}
			})
	}
	const variableOptions = nodes
		.filter((item) => upstreamIds.has(item.id))
		.flatMap((item) => {
			if (item.data.kind === 'start')
				return item.data.inputs.map((input) => ({
					value: input.name,
					label: `${t(item.data.label)} / ${input.name}`,
				}))
			if (item.data.kind === 'action')
				return ['success', 'result'].map((name) => ({
					value: `${item.id}.${name}`,
					label: `${t(item.data.label)} / ${name}`,
				}))
			if (item.data.kind === 'http')
				return ['status_code', 'body'].map((name) => ({
					value: `${item.id}.${name}`,
					label: `${t(item.data.label)} / ${name}`,
				}))
			return []
		})

	// 分支和输入使用独立标识维护，重命名与排序不会让已有端口误连到其他分支。
	const updateInput = (
		id: string,
		patch: Partial<WorkflowNodeData['inputs'][number]>,
	) =>
		onChange({
			inputs: data.inputs.map((input) =>
				input.id === id ? { ...input, ...patch } : input,
			),
		})
	const updateBranch = (
		id: string,
		patch: Partial<WorkflowNodeData['branches'][number]>,
	) =>
		onChange({
			branches: data.branches.map((branch) =>
				branch.id === id ? { ...branch, ...patch } : branch,
			),
		})
	const removeBranch = (id: string) => {
		// 父级一次更新同时清理失效端口的连线，让撤销能完整恢复分支与连接。
		onChange({
			branches: data.branches.filter((branch) => branch.id !== id),
		})
	}
	const outputVariables =
		data.kind === 'start'
			? data.inputs.map((input) => ({
					name: input.name,
					type: input.type,
					description: input.required
						? t('必填输入变量')
						: t('可选输入变量'),
				}))
			: data.kind === 'action'
				? [
						{
							name: 'success',
							type: 'boolean',
							description: t('动作是否执行成功'),
						},
						{
							name: 'result',
							type: 'object',
							description: t('动作返回的数据'),
						},
					]
				: data.kind === 'http'
					? [
							{
								name: 'status_code',
								type: 'number',
								description: t('HTTP 响应状态码'),
							},
							{
								name: 'body',
								type: 'string',
								description: t('HTTP 响应正文'),
							},
						]
					: []

	/** 动作与 HTTP 共享超时及重试约束，秒数必须为正整数，重试次数允许为零。 */
	const executionFields = (
		<div className={styles.twoColumns}>
			<div className={styles.field}>
				<label htmlFor={fieldId('timeout')}>{t('超时时间')}</label>
				<InputNumber
					id={fieldId('timeout')}
					min={1}
					max={86400}
					precision={0}
					value={data.timeout}
					suffix={t('秒')}
					onChange={(value) => {
						if (value !== null) onChange({ timeout: value })
					}}
				/>
			</div>
			<div className={styles.field}>
				<label htmlFor={fieldId('retries')}>{t('失败重试')}</label>
				<InputNumber
					id={fieldId('retries')}
					min={0}
					max={10}
					precision={0}
					value={data.retries}
					suffix={t('次')}
					onChange={(value) => {
						if (value !== null) onChange({ retries: value })
					}}
				/>
			</div>
		</div>
	)

	const configuration = (
		<div className={styles.body}>
			<section className={styles.section}>
				<div className={styles.field}>
					<label htmlFor={fieldId('label')}>
						{t('节点名称')}
						<span className={styles.required}>*</span>
					</label>
					<Input
						id={fieldId('label')}
						value={t(data.label)}
						maxLength={48}
						placeholder={t('请输入节点名称')}
						status={!data.label.trim() ? 'error' : undefined}
						onChange={(event) =>
							onChange({ label: event.target.value })
						}
					/>
				</div>
				<div className={styles.field}>
					<label htmlFor={fieldId('description')}>
						{t('描述')}
						<span className={styles.optional}>{t('选填')}</span>
					</label>
					<Input.TextArea
						id={fieldId('description')}
						value={t(data.description)}
						maxLength={300}
						autoSize={{ minRows: 2, maxRows: 4 }}
						placeholder={t('添加节点的用途说明…')}
						onChange={(event) =>
							onChange({ description: event.target.value })
						}
					/>
				</div>
			</section>

			{data.kind === 'start' && (
				<section className={styles.section}>
					<div className={styles.sectionHeading}>
						<h3>{t('输入变量')}</h3>
						<span>{data.inputs.length}</span>
					</div>
					<p className={styles.hint}>
						{t('定义工作流启动时需要传入的参数。')}
					</p>
					{data.inputs.map((input, index) => (
						<div key={input.id} className={styles.variableEditor}>
							<div className={styles.itemHeading}>
								<span className={styles.codeLabel}>
									{t('变量 {{index}}', { index: index + 1 })}
								</span>
								<Tooltip title={t('删除变量')}>
									<Button
										type="text"
										size="small"
										aria-label={t('删除变量')}
										icon={<Trash2 size={13} />}
										onClick={() =>
											onChange({
												inputs: data.inputs.filter(
													(item) =>
														item.id !== input.id,
												),
											})
										}
									/>
								</Tooltip>
							</div>
							<div className={styles.field}>
								<label htmlFor={fieldId(`input-${input.id}`)}>
									{t('变量名')}
								</label>
								<Input
									id={fieldId(`input-${input.id}`)}
									value={input.name}
									placeholder="variable_name"
									maxLength={64}
									onChange={(event) =>
										updateInput(input.id, {
											name: event.target.value,
										})
									}
								/>
							</div>
							<div className={styles.inputOptions}>
								<div className={styles.field}>
									<label
										htmlFor={fieldId(`type-${input.id}`)}
									>
										{t('类型')}
									</label>
									<Select
										id={fieldId(`type-${input.id}`)}
										value={input.type}
										options={[
											{
												value: 'string',
												label: t('文本'),
											},
											{
												value: 'number',
												label: t('数字'),
											},
											{
												value: 'boolean',
												label: t('布尔值'),
											},
										]}
										onChange={(type) =>
											updateInput(input.id, { type })
										}
									/>
								</div>
								<Checkbox
									checked={input.required}
									onChange={(event) =>
										updateInput(input.id, {
											required: event.target.checked,
										})
									}
								>
									{t('必填')}
								</Checkbox>
							</div>
						</div>
					))}
					<Button
						block
						type="dashed"
						icon={<Plus size={14} />}
						onClick={() =>
							onChange({
								inputs: [
									...data.inputs,
									{
										id: crypto.randomUUID(),
										name: '',
										type: 'string',
										required: true,
									},
								],
							})
						}
					>
						{t('添加输入变量')}
					</Button>
				</section>
			)}

			{data.kind === 'action' && (
				<section className={styles.section}>
					<h3>{t('动作配置')}</h3>
					<div className={styles.source}>
						<WorkflowIcon kind="action" actionId={data.actionId} />
						<div>
							<span>{t(preset?.group ?? '预制动作库')}</span>
							<strong>{t(preset?.label ?? '未选择动作')}</strong>
						</div>
					</div>
					{/* E叉取货使用轴目标，其余动作继续使用各自的业务位置标识。 */}
					{data.actionId !== 'efork-pick' && (
						<div className={styles.field}>
							<label htmlFor={fieldId('target')}>
								{t('目标位置')}
								<span className={styles.required}>*</span>
							</label>
							<Input
								id={fieldId('target')}
								value={data.target}
								placeholder={t('输入站点、库位或设备标识')}
								onChange={(event) =>
									onChange({ target: event.target.value })
								}
							/>
						</div>
					)}
					{executionFields}
					<p className={styles.hint}>
						{t('动作超时且重试失败时，工作流将停止执行。')}
					</p>
					{motorStorageWarning && data.actionId === 'efork-pick' && (
						<p className={styles.hint} role="alert">
							{t(
								'轴电机数据读取异常，请检查浏览器存储后重新进入编辑器。',
							)}
						</p>
					)}
					{data.actionId === 'efork-pick' ? (
						<EForkPickupConfig
							key={JSON.stringify(data.pickup)}
							nodeId={node.id}
							data={data}
							motors={motors}
							onApply={onApply}
							onPendingChange={onPendingChange}
						/>
					) : (
						<WorkflowNodeTest
							key={JSON.stringify(data)}
							data={data}
							motors={motors}
						/>
					)}
				</section>
			)}

			{data.kind === 'condition' && (
				<section className={styles.section}>
					<h3>{t('分支条件')}</h3>
					<p className={styles.hint}>
						{t('按顺序判断条件，执行第一个匹配的分支。')}
					</p>
					{data.branches.map((branch, index) => (
						<div key={branch.id} className={styles.branch}>
							<div className={styles.itemHeading}>
								<strong>
									{index === 0 ? 'IF' : 'ELIF'}
									<span className={styles.branchIndex}>
										{String(index + 1).padStart(2, '0')}
									</span>
								</strong>
								{index > 0 && (
									<Tooltip title={t('移除分支')}>
										<Button
											type="text"
											size="small"
											aria-label={t('移除分支')}
											icon={<Trash2 size={13} />}
											onClick={() =>
												removeBranch(branch.id)
											}
										/>
									</Tooltip>
								)}
							</div>
							<div className={styles.field}>
								<label
									htmlFor={fieldId(`variable-${branch.id}`)}
								>
									{t('条件变量')}
								</label>
								<Select
									id={fieldId(`variable-${branch.id}`)}
									value={branch.variable || undefined}
									options={variableOptions}
									allowClear
									showSearch={{ optionFilterProp: 'label' }}
									placeholder={t('选择上游变量')}
									onChange={(variable) =>
										updateBranch(branch.id, {
											variable: variable ?? '',
										})
									}
								/>
							</div>
							<div className={styles.conditionValues}>
								<div className={styles.field}>
									<label
										htmlFor={fieldId(
											`operator-${branch.id}`,
										)}
									>
										{t('运算符')}
									</label>
									<Select
										id={fieldId(`operator-${branch.id}`)}
										value={branch.operator}
										options={[
											{ value: 'eq', label: t('等于') },
											{
												value: 'neq',
												label: t('不等于'),
											},
											{ value: 'gt', label: t('大于') },
											{ value: 'lt', label: t('小于') },
											{
												value: 'contains',
												label: t('包含'),
											},
										]}
										onChange={(operator) =>
											updateBranch(branch.id, {
												operator,
											})
										}
									/>
								</div>
								<div className={styles.field}>
									<label
										htmlFor={fieldId(`value-${branch.id}`)}
									>
										{t('比较值')}
									</label>
									<Input
										id={fieldId(`value-${branch.id}`)}
										value={branch.value}
										placeholder={t('输入比较值')}
										onChange={(event) =>
											updateBranch(branch.id, {
												value: event.target.value,
											})
										}
									/>
								</div>
							</div>
						</div>
					))}
					<Button
						block
						type="dashed"
						icon={<Plus size={14} />}
						onClick={() =>
							onChange({
								branches: [
									...data.branches,
									{
										id: crypto.randomUUID(),
										variable: '',
										operator: 'eq',
										value: '',
									},
								],
							})
						}
					>
						{t('添加 ELIF 分支')}
					</Button>
					<div className={styles.elseBranch}>
						<strong>ELSE</strong>
						<p className={styles.hint}>
							{t('当以上条件均不满足时，执行此分支。')}
						</p>
					</div>
				</section>
			)}

			{data.kind === 'http' && (
				<section className={styles.section}>
					<h3>{t('请求配置')}</h3>
					<div className={styles.field}>
						<label htmlFor={fieldId('method')}>
							{t('请求方法')}
						</label>
						<Select
							id={fieldId('method')}
							value={data.method}
							options={[
								'GET',
								'POST',
								'PUT',
								'PATCH',
								'DELETE',
							].map((method) => ({
								value: method,
								label: method,
							}))}
							onChange={(method) => onChange({ method })}
						/>
					</div>
					<div className={styles.field}>
						<label htmlFor={fieldId('url')}>
							{t('请求地址')}
							<span className={styles.required}>*</span>
						</label>
						<Input
							id={fieldId('url')}
							value={data.url}
							placeholder="https://api.example.com/endpoint"
							onChange={(event) =>
								onChange({ url: event.target.value })
							}
						/>
					</div>
					<div className={styles.field}>
						<label htmlFor={fieldId('body')}>
							{t('请求体')}
							<span className={styles.optional}>JSON</span>
						</label>
						<Input.TextArea
							id={fieldId('body')}
							className={styles.codeInput}
							value={data.body}
							autoSize={{ minRows: 5, maxRows: 12 }}
							placeholder="{}"
							onChange={(event) =>
								onChange({ body: event.target.value })
							}
						/>
					</div>
					{executionFields}
				</section>
			)}

			{data.kind === 'delay' && (
				<section className={styles.section}>
					<h3>{t('等待配置')}</h3>
					<div className={styles.field}>
						<label htmlFor={fieldId('duration')}>
							{t('等待时长')}
						</label>
						<InputNumber
							id={fieldId('duration')}
							min={1}
							max={86400}
							precision={0}
							value={data.duration}
							suffix={t('秒')}
							onChange={(value) => {
								if (value !== null)
									onChange({ duration: value })
							}}
						/>
					</div>
					<p className={styles.hint}>
						{t('等待指定时间后，继续执行下一个节点。')}
					</p>
				</section>
			)}

			{data.kind === 'end' && (
				<section className={styles.section}>
					<h3>{t('流程输出')}</h3>
					<p className={styles.hint}>
						{t(
							'流程到达此节点时结束，并返回前序节点的执行结果。结束节点不能连接下一步。',
						)}
					</p>
				</section>
			)}

			{/* 下一步按照真实出边展示；空端口打开动作选择器，断开连接保留目标节点。 */}
			{ports.length > 0 && (
				<section className={`${styles.section} ${styles.nextSection}`}>
					<h3>{t('下一步')}</h3>
					<p className={styles.hint}>
						{t('添加此节点之后要执行的步骤。')}
					</p>
					<div className={styles.nextTree}>
						<WorkflowIcon
							kind={data.kind}
							actionId={data.actionId}
						/>
						<div className={styles.nextBranches}>
							{ports.map((port) => {
								const connections = outgoing.filter(
									(edge) =>
										(edge.sourceHandle ?? 'output') ===
										port.id,
								)
								return (
									<div
										key={port.id}
										className={styles.nextBranch}
									>
										<span className={styles.portLabel}>
											{port.label}
										</span>
										{connections.length ? (
											connections.map((edge) => {
												const target = nodes.find(
													(item) =>
														item.id === edge.target,
												)
												return target ? (
													<div
														key={edge.id}
														className={
															styles.connectedNode
														}
													>
														<button
															type="button"
															onClick={() =>
																onSelectNode(
																	target.id,
																)
															}
														>
															<WorkflowIcon
																kind={
																	target.data
																		.kind
																}
																actionId={
																	target.data
																		.actionId
																}
																size={12}
															/>
															<span>
																{t(
																	target.data
																		.label,
																)}
															</span>
															<ArrowRight
																size={12}
															/>
														</button>
														<Tooltip
															title={t(
																'断开连接',
															)}
														>
															<Button
																type="text"
																size="small"
																aria-label={t(
																	'断开连接',
																)}
																icon={
																	<Link2Off
																		size={
																			13
																		}
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
												onClick={() =>
													onAddNext(port.id)
												}
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
			)}
		</div>
	)

	return (
		<aside
			ref={panelRef}
			className={styles.inspector}
			aria-label={t('节点配置')}
		>
			<header className={styles.header}>
				<WorkflowIcon
					kind={data.kind}
					actionId={data.actionId}
					size={17}
				/>
				<strong title={t(data.label)}>
					{t(data.label) || t('未命名节点')}
				</strong>
				<div className={styles.headerActions}>
					{data.kind === 'action' && (
						<Tooltip title={t('打开节点测试')}>
							<Button
								type="text"
								size="small"
								aria-label={t('打开节点测试')}
								icon={<FlaskConical size={16} />}
								onClick={() => {
									setActiveTab('settings')
									setTestRequest((count) => count + 1)
								}}
							/>
						</Tooltip>
					)}
					{data.kind !== 'start' && (
						<Dropdown
							trigger={['click']}
							menu={{
								items: [
									{
										key: 'duplicate',
										icon: <Copy size={14} />,
										label: t('复制节点'),
									},
									{
										key: 'delete',
										icon: <Trash2 size={14} />,
										label: t('删除节点'),
										danger: true,
									},
								],
								onClick: ({ key }) => {
									if (key === 'duplicate') onDuplicate()
									else onDelete()
								},
							}}
						>
							<Button
								type="text"
								size="small"
								aria-label={t('节点操作')}
								icon={<Ellipsis size={17} />}
							/>
						</Dropdown>
					)}
					<Tooltip title={t('关闭配置面板')}>
						<Button
							type="text"
							size="small"
							aria-label={t('关闭配置面板')}
							icon={<X size={16} />}
							onClick={onClose}
						/>
					</Tooltip>
				</div>
			</header>
			<Tabs
				className={styles.tabs}
				activeKey={activeTab}
				onChange={setActiveTab}
				items={[
					{
						key: 'settings',
						label: t('配置'),
						children: configuration,
					},
					{
						key: 'outputs',
						label: t('输出变量'),
						children: (
							<div className={styles.body}>
								<section className={styles.section}>
									<h3>{t('输出变量')}</h3>
									<p className={styles.hint}>
										{t('后续节点可以引用以下变量。')}
									</p>
									{outputVariables.length > 0 ? (
										<div className={styles.outputVariables}>
											{outputVariables.map(
												(variable, index) => (
													<div
														key={`${variable.name}-${index}`}
														className={
															styles.outputVariable
														}
													>
														<div>
															<Braces size={13} />
															<code>
																{variable.name ||
																	t(
																		'未命名变量',
																	)}
															</code>
															<span>
																{variable.type}
															</span>
														</div>
														<p>
															{
																variable.description
															}
														</p>
													</div>
												),
											)}
										</div>
									) : (
										<div className={styles.empty}>
											<Braces size={25} />
											<p>
												{t('此节点不产生额外输出变量')}
											</p>
										</div>
									)}
								</section>
							</div>
						),
					},
				]}
			/>
		</aside>
	)
}
