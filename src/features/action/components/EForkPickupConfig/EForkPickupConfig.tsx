import { useEffect, useState } from 'react'
import { App, Button, Input, InputNumber, Select, Switch } from 'antd'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getMotorAction } from '../../../axis-motor/axisMotor.model'
import type { AxisMotor } from '../../../axis-motor/axisMotor.types'
import type { WorkflowNodeData } from '../../workflow.model'
import { EFORK_PICKUP_CODE, EMPTY_PICKUP, encoderToHeight, getPickupMotors, heightToEncoder, validatePickup, type EForkPickupSettings } from '../../workflow.action'
import { WorkflowNodeTest } from '../WorkflowNodeTest/WorkflowNodeTest'
import styles from './EForkPickupConfig.module.css'

/** 参数仅应用到当前节点；电机清单只读，不持久化流程或覆盖电机本身的标定。 */
interface EForkPickupConfigProps {
  nodeId: string
  data: WorkflowNodeData
  motors: AxisMotor[]
  onApply: (patch: Partial<WorkflowNodeData>) => boolean
  onPendingChange: (pending: boolean) => void
}

/** 表单输入与已应用参数分离；父级以节点配置为 key，使撤销、重做和切换节点恢复对应值。 */
export function EForkPickupConfig({ nodeId, data, motors, onApply, onPendingChange }: EForkPickupConfigProps) {
  const { t } = useTranslation('action')
  const { message } = App.useApp()
  const applied = data.pickup ?? EMPTY_PICKUP
  const [draft, setDraft] = useState<EForkPickupSettings>({ ...applied })
  const options = getPickupMotors(motors)
  const motor = options.find((item) => item.id === draft.motorId)
  const bindingDirty = draft.motorId !== applied.motorId
  const parametersDirty = draft.liftHeight !== applied.liftHeight || draft.encoderValue !== applied.encoderValue
  // 尚未应用的输入也会在离开时丢失；卸载表单时撤销该表单的待处理标记。
  useEffect(() => {
    onPendingChange(bindingDirty || parametersDirty)
    return () => onPendingChange(false)
  }, [bindingDirty, parametersDirty, onPendingChange])
  const fieldId = (name: string) => `${nodeId}-pickup-${name}`

  /** 更换轴后清空目标，必须按新轴标定重新应用，避免沿用其他轴的行程参数。 */
  const applyBinding = () => {
    if (!motor) return
    if (onApply({ pickup: { ...applied, motorId: motor.id, liftHeight: null, encoderValue: null } })) void message.success(t('轴电机绑定已应用到当前节点'))
  }

  /** 参数应用前校验标定范围和单位换算；不自动启动任何测试。 */
  const applyParameters = () => {
    const errors = validatePickup(draft, motors)
    if (errors.length) { void message.error(t(errors[0])); return }
    if (onApply({ pickup: { ...draft } })) void message.success(t('动作参数已应用到当前节点'))
  }

  return <div className={styles.config}>
    <div className={styles.field}><label htmlFor={fieldId('code')}>{t('动作所属编号')}<span>{t('由动作类型自动确定')}</span></label><Input id={fieldId('code')} value={EFORK_PICKUP_CODE} readOnly /></div>
    <div className={styles.field}><label htmlFor={fieldId('motor')}>{t('动作轴绑定')}</label><Select id={fieldId('motor')} value={motor?.id} placeholder={t('选择顶升轴电机')} showSearch={{ optionFilterProp: 'label' }}
      options={options.map((item) => ({ value: item.id, label: `${t(item.name)} · ${t('轴 {{number}}', { number: getMotorAction(item.actionType).axisNumber })}` }))}
      notFoundContent={t('当前车体暂无可用顶升轴，请先配置轴电机')} onChange={(motorId) => setDraft({ ...draft, motorId, liftHeight: null, encoderValue: null })} /></div>
    <p className={styles.hint}>{t('仅显示轴电机配置中已添加的顶升轴。')}</p>
    {!!applied.motorId && !options.some((item) => item.id === applied.motorId) && <p className={styles.error} role="alert">{t('原绑定轴已不可用，请重新选择')}</p>}
    <Button block icon={<Check size={13} />} disabled={!motor || !bindingDirty} onClick={applyBinding}>{t('应用轴电机')}</Button>

    <div className={styles.parameters}>
      <h4>{t('轴电机参数')}{motor && <span>{t('轴 {{number}}', { number: getMotorAction(motor.actionType).axisNumber })}</span>}</h4>
      <div className={styles.field}><label htmlFor={fieldId('height')}>{t('顶升高度')}<span>mm</span></label><InputNumber id={fieldId('height')} disabled={!motor || bindingDirty} value={draft.liftHeight} min={motor?.parameters.lowerPosition} max={motor?.parameters.upperPosition} precision={2} placeholder={t('输入顶升高度')} onChange={(liftHeight) => setDraft({ ...draft, liftHeight, encoderValue: motor && liftHeight !== null ? heightToEncoder(motor, liftHeight) : null })} /></div>
      <div className={styles.field}><label htmlFor={fieldId('encoder')}>{t('编码器值')}</label><InputNumber id={fieldId('encoder')} disabled={!motor || bindingDirty} value={draft.encoderValue} min={motor?.parameters.lowerEncoder} max={motor?.parameters.upperEncoder} precision={0} placeholder={t('输入编码器值')} onChange={(encoderValue) => setDraft({ ...draft, encoderValue, liftHeight: motor && encoderValue !== null ? encoderToHeight(motor, encoderValue) : null })} /></div>
      {motor && <p className={styles.hint}>{t('行程范围：{{min}}–{{max}} mm', { min: motor.parameters.lowerPosition, max: motor.parameters.upperPosition })}<br />{t('高度与编码器按当前轴标定联动换算。')}</p>}
      <Button block icon={<Check size={13} />} disabled={!motor || bindingDirty || !parametersDirty} onClick={applyParameters}>{t('应用参数')}</Button>
    </div>
    <div className={styles.enable}><div><label htmlFor={fieldId('enabled')}>{t('动作是否启动')}</label><p>{t('停用后不能进行节点测试。')}</p></div><Switch id={fieldId('enabled')} checked={applied.enabled} disabled={bindingDirty || parametersDirty} checkedChildren={t('启用')} unCheckedChildren={t('停用')} onChange={(enabled) => onApply({ pickup: { ...applied, enabled } })} /></div>
    {(bindingDirty || parametersDirty) && <p className={styles.hint}>{t('有未应用的配置，切换节点将放弃这些修改。')}</p>}
    <WorkflowNodeTest key={JSON.stringify([data, motors, bindingDirty, parametersDirty])} data={data} motors={motors} pending={bindingDirty || parametersDirty} />
  </div>
}
