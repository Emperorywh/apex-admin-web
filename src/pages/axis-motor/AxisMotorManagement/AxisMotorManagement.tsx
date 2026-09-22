import { useState } from 'react'
import {
	Alert,
	App,
	Badge,
	Button,
	Card,
	Col,
	Empty,
	Flex,
	Input,
	Row,
	Space,
	Tree,
	Typography,
} from 'antd'
import type { TreeDataNode } from 'antd'
import { AddMotorModal } from '@/features/axis-motor/components/AddMotorModal'
import { MotorCard } from '@/features/axis-motor/components/MotorCard'
import {
	axisMotorData,
	getMotorAction,
} from '@/features/axis-motor/axisMotor.model'
import type { MotorAttributes } from '@/features/axis-motor/axisMotor.types'
import { useAxisMotors } from '@/features/axis-motor/hooks/useAxisMotors'
import styles from '@/pages/axis-motor/AxisMotorManagement/AxisMotorManagement.module.css'

/** 轴电机工作区：分类树筛选本地配置，卡片分别承担属性维护、标定和模拟测试。 */
export default function AxisMotorManagement() {
	const { message } = App.useApp()
	const { motors, storageWarning, saveAttributes, saveParameters, addMotor } =
		useAxisMotors()
	const [selectedKey, setSelectedKey] = useState('all')
	const [keyword, setKeyword] = useState('')
	const [addActionType, setAddActionType] = useState<string | null>(null)

	// 树节点使用类别/动作前缀区分语义；空类别仍可选中并通过新增流程建立配置。
	const treeData: TreeDataNode[] = axisMotorData.categories.map(
		(category) => ({
			key: `category:${category.id}`,
			title: (
				<Space size={8}>
					{category.label}
					<Typography.Text type="secondary">
						{
							motors.filter(
								(motor) =>
									getMotorAction(motor.actionType)
										.categoryId === category.id,
							).length
						}
					</Typography.Text>
				</Space>
			),
			children: axisMotorData.actions
				.filter((action) => action.categoryId === category.id)
				.map((action) => ({
					key: `action:${action.id}`,
					title: action.label,
					isLeaf: true,
				})),
		}),
	)

	const selectedAction = axisMotorData.actions.find(
		(action) => selectedKey === `action:${action.id}`,
	)
	const selectedCategory = axisMotorData.categories.find(
		(category) => selectedKey === `category:${category.id}`,
	)
	const selectionLabel =
		selectedAction?.label ?? selectedCategory?.label ?? '全部轴电机'
	const defaultActionType =
		selectedAction?.id ??
		axisMotorData.actions.find(
			(action) => action.categoryId === selectedCategory?.id,
		)?.id ??
		motors[0]?.actionType ??
		axisMotorData.actions[0].id
	const query = keyword.trim().toLocaleLowerCase()
	const visibleMotors = motors.filter((motor) => {
		const action = getMotorAction(motor.actionType)
		const inSelection =
			selectedKey === 'all' ||
			selectedKey === `category:${action.categoryId}` ||
			selectedKey === `action:${action.id}`
		const matchesKeyword =
			`${motor.name} ${action.label} ${action.axisNumber}`
				.toLocaleLowerCase()
				.includes(query)
		return inSelection && matchesKeyword
	})

	/** 创建成功后定位到新动作分类并清空搜索，确保新增结果立即可见。 */
	const handleCreate = (values: MotorAttributes) => {
		const motor = addMotor(values)
		if (!motor) {
			void message.error('新增失败，请检查轴属性和本地存储状态')
			return false
		}
		setSelectedKey(`action:${motor.actionType}`)
		setKeyword('')
		setAddActionType(null)
		void message.success('轴电机已新增并保存到本地')
		return true
	}

	return (
		<Flex vertical className={styles.page}>
			{storageWarning && (
				<Alert
					className={styles.notice}
					type="warning"
					showIcon
					title={storageWarning}
				/>
			)}

			<Flex className={styles.workspace} gap={16} align="start">
				<Card
					className={styles.navigation}
					size="small"
					title="电机分类"
					extra={
						<Typography.Text type="secondary">
							{axisMotorData.categories.length} 类
						</Typography.Text>
					}
				>
					<Button
						block
						className={styles.allMotors}
						type={selectedKey === 'all' ? 'primary' : 'text'}
						onClick={() => setSelectedKey('all')}
					>
						<Flex
							justify="space-between"
							align="center"
							style={{ width: '100%' }}
						>
							全部轴电机
							<Badge
								count={motors.length}
								showZero
								color="var(--app-blue)"
							/>
						</Flex>
					</Button>
					{/* 分类默认全部收起；点击箭头手动展开，选中类别仍独立控制电机筛选。 */}
					<Tree.DirectoryTree
						aria-label="电机分类"
						blockNode
						expandAction={false}
						selectedKeys={
							selectedKey === 'all' ? [] : [selectedKey]
						}
						treeData={treeData}
						onSelect={(keys) =>
							setSelectedKey(String(keys[0] ?? 'all'))
						}
					/>
				</Card>

				<Flex vertical className={styles.content}>
					<Flex
						className={styles.toolbar}
						justify="space-between"
						align="center"
						gap={12}
						wrap
					>
						<Space>
							<Typography.Text strong>
								{selectionLabel}
							</Typography.Text>
							<Typography.Text type="secondary">
								共 {visibleMotors.length} 台
							</Typography.Text>
						</Space>
						{/* 搜索与新增作为一个操作组靠右排列，避免工具栏将两个入口分散。 */}
						<Flex
							className={styles.toolbarActions}
							align="center"
							gap={8}
						>
							<Input.Search
								aria-label="搜索轴电机"
								placeholder="搜索动作名称 / 轴编号"
								allowClear
								className={styles.search}
								value={keyword}
								onChange={(event) =>
									setKeyword(event.target.value)
								}
							/>
							<Button
								type="primary"
								onClick={() =>
									setAddActionType(defaultActionType)
								}
							>
								新增轴电机
							</Button>
						</Flex>
					</Flex>
					{/* 筛选保留表单草稿并暂停隐藏卡片模拟；超宽屏才并排卡片，为水平字段预留输入宽度。 */}
					<Row gutter={[16, 16]}>
						{motors.map((motor) => {
							const visible = visibleMotors.some(
								(item) => item.id === motor.id,
							)
							return (
								<Col
									xs={24}
									xxl={12}
									key={motor.id}
									style={{
										display: visible ? undefined : 'none',
									}}
								>
									<MotorCard
										motor={motor}
										visible={visible}
										onSaveAttributes={saveAttributes}
										onSaveParameters={saveParameters}
										onAdd={setAddActionType}
									/>
								</Col>
							)
						})}
					</Row>
					{visibleMotors.length === 0 && (
						<Flex className={styles.empty} justify="center">
							<Empty
								image={Empty.PRESENTED_IMAGE_SIMPLE}
								description={
									query
										? '没有找到匹配的轴电机'
										: '该分类下暂无轴电机'
								}
							>
								{query ? (
									<Button onClick={() => setKeyword('')}>
										清空搜索
									</Button>
								) : (
									<Button
										type="primary"
										onClick={() =>
											setAddActionType(defaultActionType)
										}
									>
										新增轴电机
									</Button>
								)}
							</Empty>
						</Flex>
					)}
				</Flex>
			</Flex>

			<AddMotorModal
				open={addActionType !== null}
				initialActionType={addActionType ?? undefined}
				onCancel={() => setAddActionType(null)}
				onCreate={handleCreate}
			/>
		</Flex>
	)
}
