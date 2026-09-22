import { Badge, Flex, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import data from '@/features/device/data/devices.json'
import type {
	CanDevice,
	DeviceData,
	GpioDevice,
	SerialDevice,
} from '@/features/device/device.types'
import { DeviceSection } from '@/features/device/components/DeviceSection'
import {
	CanDeviceFields,
	GpioDeviceFields,
	SerialDeviceFields,
} from '@/features/device/components/DeviceFields'
import styles from './DeviceManagement.module.css'

/** JSON 是预制记录的唯一来源，类型检查覆盖三类设备的字段，不发起接口请求。 */
const devices: DeviceData = data

/** 状态同时使用文字和颜色，避免仅凭颜色区分设备异常。 */
const renderAlarm = (alarm: boolean) => (
	<Badge
		status={alarm ? 'warning' : 'success'}
		text={alarm ? '告警' : '正常'}
	/>
)
const renderOptional = (value: string) =>
	value || <Typography.Text type="secondary">/</Typography.Text>

/** 表格字段与原型顺序一致；名称列吸收剩余宽度，保证三组操作列等宽对齐，空配置显示斜线。 */
const canColumns: TableColumnsType<CanDevice> = [
	{ title: '电机类型', dataIndex: 'model', width: 150 },
	{
		title: '电机执行器',
		dataIndex: 'actuator',
		width: 120,
		render: renderOptional,
	},
	{
		title: '电机编码器',
		dataIndex: 'encoder',
		width: 120,
		render: renderOptional,
	},
	{ title: 'CAN 通讯设备名称', dataIndex: 'name' },
	{ title: 'CAN 硬件接口', dataIndex: 'port', width: 130 },
	{ title: 'CAN 设备 ID', dataIndex: 'canId', width: 115 },
	{ title: '设备状态', dataIndex: 'alarm', width: 110, render: renderAlarm },
]

/** GPIO 名称列自适应剩余宽度；“触发”只是信号状态，不直接渲染为故障告警。 */
const gpioColumns: TableColumnsType<GpioDevice> = [
	{ title: 'GPIO 类型', dataIndex: 'type', width: 110 },
	{ title: 'GPIO 名称', dataIndex: 'name' },
	{ title: 'GPIO 功能', dataIndex: 'purpose', width: 150 },
	{
		title: 'GPIO 状态',
		dataIndex: 'triggered',
		width: 120,
		render: (triggered: boolean) => (
			<Badge
				status={triggered ? 'processing' : 'default'}
				text={triggered ? '触发' : '未触发'}
			/>
		),
	},
	{
		title: '高低电平生效',
		dataIndex: 'activeHigh',
		width: 130,
		render: (activeHigh: boolean) => (activeHigh ? '高电平' : '低电平'),
	},
]

/** 灯光与语音共用 RS485 列定义，名称列伸展填满表格，原型省略号不作为真实记录。 */
const serialColumns: TableColumnsType<SerialDevice> = [
	{ title: 'RS485 硬件接口', dataIndex: 'port', width: 170 },
	{ title: '名称', dataIndex: 'name' },
	{ title: '状态', dataIndex: 'alarm', width: 130, render: renderAlarm },
]

/** 三组配置纵向排列并统一占满宽度；当前页面缓存保留编辑结果，刷新恢复 JSON。 */
export default function DeviceManagement() {
	return (
		<Flex vertical className={styles.page} gap={28}>
			<DeviceSection<CanDevice>
				title="电机 / 电池管理"
				deviceLabel="设备"
				initialRecords={devices.can}
				defaults={{
					model: '',
					actuator: '',
					encoder: '',
					name: '',
					port: '',
					canId: 1,
					alarm: false,
				}}
				columns={canColumns}
				fields={<CanDeviceFields />}
				scrollWidth={1089}
				getName={(record) => record.name}
			/>
			<DeviceSection<GpioDevice>
				title="GPIO 管理"
				deviceLabel="GPIO"
				initialRecords={devices.gpio}
				defaults={{
					type: 'NPN',
					name: '',
					purpose: '',
					triggered: false,
					activeHigh: true,
				}}
				columns={gpioColumns}
				fields={<GpioDeviceFields />}
				scrollWidth={830}
				getName={(record) => `${record.name}（${record.purpose}）`}
			/>
			<DeviceSection<SerialDevice>
				title="485 灯光 / 语音管理"
				deviceLabel="485 设备"
				initialRecords={devices.serial}
				defaults={{ port: '', name: '', alarm: false }}
				columns={serialColumns}
				fields={<SerialDeviceFields />}
				scrollWidth={640}
				getName={(record) => record.name}
			/>
			<Typography.Text type="secondary" className={styles.dataNote}>
				本地模拟数据 · 修改仅在当前页面保留，刷新后恢复预制数据
			</Typography.Text>
		</Flex>
	)
}
