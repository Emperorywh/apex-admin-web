import { useEffect, useRef, useState } from 'react'
import { Button, Progress } from 'antd'
import { ArrowDown, ArrowUp, FlaskConical, Play, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AxisMotor } from '../../../../axis-motor/axisMotor.types'
import type { WorkflowNodeData } from '../../../workflow.model'
import {
	encoderToHeight,
	getPickupMotors,
	validateActionConfiguration,
} from '../../../workflow.action'
import styles from './WorkflowNodeTest.module.css'

/** 父级用配置快照作为 key；改参数、换节点或关闭面板会卸载测试并清理计时器。 */
interface WorkflowNodeTestProps {
	data: WorkflowNodeData
	motors: AxisMotor[]
	pending?: boolean
}

/** 所有动作共享独立模拟测试；E叉额外提供正反向与停止控制，运行值从不写回轴标定或草稿。 */
export function WorkflowNodeTest({
	data,
	motors,
	pending = false,
}: WorkflowNodeTestProps) {
	const { t } = useTranslation('action')
	const isPickup = data.actionId === 'efork-pick'
	const motor = getPickupMotors(motors).find(
		(item) => item.id === data.pickup?.motorId,
	)
	const [status, setStatus] = useState<
		'idle' | 'running' | 'done' | 'stopped' | 'failed'
	>('idle')
	const [errors, setErrors] = useState<string[]>([])
	const [progress, setProgress] = useState(0)
	const [encoder, setEncoder] = useState(
		motor
			? Math.max(
					motor.parameters.lowerEncoder,
					Math.min(
						motor.parameters.upperEncoder,
						motor.currentEncoder,
					),
				)
			: 0,
	)
	const [direction, setDirection] = useState<'up' | 'down'>('up')
	const timer = useRef<ReturnType<typeof setInterval> | null>(null)
	const running = status === 'running'
	const disabled = isPickup && data.pickup?.enabled === false
	const statusLabels = {
		idle: '等待测试',
		running: '模拟运行中',
		done: '模拟测试完成',
		stopped: '模拟测试已停止',
		failed: '测试未通过',
	}

	// 清理仅取消本地模拟；不调用任何设备控制接口，后台不遗留运动或计时状态。
	useEffect(
		() => () => {
			if (timer.current !== null) clearInterval(timer.current)
		},
		[],
	)

	/** 单次运行锁定当前已应用配置，校验失败不启动计时；超时和停止都能终止模拟。 */
	const start = (nextDirection: 'up' | 'down' = 'up') => {
		if (timer.current !== null || pending || disabled) return
		const issues = validateActionConfiguration(data, motors)
		// 上升测试不能反向下降到更低目标；先下降再上升可覆盖完整标定行程。
		if (
			motor &&
			nextDirection === 'up' &&
			data.pickup?.encoderValue != null &&
			encoder > data.pickup.encoderValue
		)
			issues.push('模拟位置高于目标高度，请先执行下降测试')
		setErrors(issues)
		if (issues.length) {
			setStatus('failed')
			return
		}
		setDirection(nextDirection)
		setProgress(0)
		setStatus('running')
		const from = encoder
		const to = motor
			? nextDirection === 'up'
				? data.pickup!.encoderValue!
				: motor.parameters.lowerEncoder
			: 0
		const duration = motor ? 2400 : 1200
		const startedAt = performance.now()
		timer.current = setInterval(() => {
			const elapsed = performance.now() - startedAt
			const fraction = Math.min(1, elapsed / duration)
			setProgress(Math.round(fraction * 100))
			if (motor) setEncoder(Math.round(from + (to - from) * fraction))
			if (
				elapsed >= data.timeout * 1000 &&
				data.timeout * 1000 < duration
			) {
				clearInterval(timer.current!)
				timer.current = null
				setErrors(['模拟测试超时，请调整超时时间后重试'])
				setStatus('failed')
			} else if (fraction === 1) {
				clearInterval(timer.current!)
				timer.current = null
				setStatus('done')
			}
		}, 80)
	}

	/** 停止保留当前位置，下一次上升或下降从该模拟位置继续。 */
	const stop = () => {
		if (timer.current !== null) clearInterval(timer.current)
		timer.current = null
		setStatus('stopped')
	}

	return (
		<section
			className={styles.test}
			data-workflow-test
			aria-label={t('节点测试')}
		>
			<div className={styles.heading}>
				<strong>
					<FlaskConical size={14} />
					{t('节点测试')}
				</strong>
				<span>{t('本地模拟')}</span>
			</div>
			<p className={styles.hint}>
				{t('检查当前节点配置并模拟执行，不向设备下发指令。')}
			</p>
			{pending && (
				<p className={styles.notice}>
					{t('请先应用轴绑定和参数，再开始测试')}
				</p>
			)}
			{disabled && (
				<p className={styles.notice}>{t('动作已停用，请先启用动作')}</p>
			)}
			<Button
				block
				type="primary"
				icon={<Play size={13} />}
				disabled={running || pending || disabled}
				onClick={() => start()}
			>
				{t('测试节点')}
			</Button>
			{isPickup && (
				<div className={styles.directions}>
					<Button
						size="small"
						icon={<ArrowUp size={13} />}
						disabled={
							running ||
							pending ||
							disabled ||
							(data.pickup?.encoderValue != null &&
								encoder >= data.pickup.encoderValue)
						}
						onClick={() => start('up')}
					>
						{t('顶升上升测试')}
					</Button>
					<Button
						size="small"
						icon={<ArrowDown size={13} />}
						disabled={
							running ||
							pending ||
							disabled ||
							(!!motor &&
								encoder <= motor.parameters.lowerEncoder)
						}
						onClick={() => start('down')}
					>
						{t('顶升下降测试')}
					</Button>
				</div>
			)}
			<div className={styles.statusRow}>
				<span role="status" aria-live="polite" data-status={status}>
					{t(statusLabels[status])}
					{running && isPickup
						? ` · ${t(direction === 'up' ? '上升' : '下降')}`
						: ''}
				</span>
				<Button
					size="small"
					danger
					icon={<Square size={11} />}
					disabled={!running}
					onClick={stop}
				>
					{t(isPickup ? '顶升停止' : '停止测试')}
				</Button>
			</div>
			{status !== 'idle' && (
				<Progress
					percent={progress}
					size="small"
					status={
						status === 'failed'
							? 'exception'
							: status === 'done'
								? 'success'
								: 'normal'
					}
				/>
			)}
			{motor && (
				<div className={styles.telemetry}>
					<div>
						<span>{t('模拟高度')}</span>
						<strong>
							{encoderToHeight(motor, encoder)}
							<small>mm</small>
						</strong>
					</div>
					<div>
						<span>{t('模拟编码器值')}</span>
						<strong>{encoder}</strong>
					</div>
				</div>
			)}
			{errors.length > 0 && (
				<ul className={styles.errors} role="alert">
					{errors.map((error) => (
						<li key={error}>{t(error)}</li>
					))}
				</ul>
			)}
			{status === 'done' && (
				<p className={styles.hint}>
					{t(
						'配置校验通过，模拟执行完成；设备实际结果需接入执行服务。',
					)}
				</p>
			)}
		</section>
	)
}
