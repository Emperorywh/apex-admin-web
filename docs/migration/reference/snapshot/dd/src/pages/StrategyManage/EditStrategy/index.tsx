import { Form, Input, InputNumber, message, Modal } from "antd"
import { dropStrategyType, PickStrategyType } from "../type"
import { useEffect } from "react"
import { saveActionStrategy, updateActionStrategy } from "@/api"
import { useI18n } from "@/hooks/useI18n";

interface propType {
    showEditModal: boolean
    strategyData: PickStrategyType | dropStrategyType | null
    setShowWditModal: Function,
    strategyType: 'pick' | 'drop', // 表示是取货还是放货
    getTableData:Function, // 刷新表单数据
}

const defaultStrategy : PickStrategyType | dropStrategyType = {
    // 策略名称
    strategyName:'',
    // 偏转横向偏移
    lateralOffset: 0,
    // 偏转纵向偏移
    verticalOffset: 0,
    // 叉尺抬升高度
    forkLiftHeightDeviation: 0.05,
    // 叉尺提前抬升距离
    forkLiftAdvanceHeight: 0.8,
    // 托盘抬升高度
    trayLiftHeight: 0.2,
    // 货架层高补偿
    shelfHeightCompensation: 0,
    // 安全检测尺寸
    safetyInspectionDimensions: 1.2,
}

export default ({ showEditModal, strategyData, setShowWditModal, strategyType,getTableData }: propType) => {

    /* 国际化翻译方法 */
    const { t } = useI18n();
    const [messageApi, contextHolder] = message.useMessage();
    const [form] = Form.useForm()

    const handleOk = async () => {
        try{
            await form.validateFields()
        }catch(e){
            return
        }

        try {
            console.log(Object.assign({ strategyType }, form.getFieldsValue()))
            const actionStrategyParam:dropStrategyType = Object.assign({ strategyType }, form.getFieldsValue(true))
            let code, message
            if(strategyData){
                // 编辑
                ({ code, message } = await updateActionStrategy(actionStrategyParam))
            }else{
                // 新增
                ({ code, message } = await saveActionStrategy(actionStrategyParam))
            }
            if (code !== 200) {
                messageApi.warning(t('保存策略数据失败') + ',' + message)
                return
            }
            messageApi.success(t('保存策略数据成功'))
            getTableData()
            setShowWditModal(false)
            form.resetFields()
        } catch (e) {
            messageApi.error(t('保存策略数据失败') + ',' + message)
        }

    }
    const handleCancel = () => {
        setShowWditModal(false)
    }
    // 关闭回调清除数据
    const handleClose = () => {
    }

    useEffect(() => {
        if (showEditModal) {
            // console.log({strategyData})
            strategyData ? form.setFieldsValue(strategyData) : form.resetFields()
        }
    }, [strategyData])

    return (
        <>
            {contextHolder}
            <Modal
                title={strategyData ? t("编辑策略") : t("新增策略")}
                open={showEditModal}
                onOk={handleOk}
                onCancel={handleCancel}
                afterClose={handleClose}
            >
                <Form
                    labelCol={{ span: 8 }}
                    wrapperCol={{ span: 16 }}
                    style={{ maxWidth: 600 }}
                    form={form}
                    autoComplete="off"
                    labelAlign="left"
                    initialValues={defaultStrategy}
                >
                    <Form.Item
                        label={t('策略名称')}
                        name='strategyName'
                        rules={[{ required: true, message: t("请输入策略名称") }]}
                    >
                        <Input placeholder={t("请输入策略名称")}></Input>
                    </Form.Item>
                    <Form.Item
                        label={t('偏转横向偏移')}
                        name='lateralOffset'
                        rules={[{ required: true, message: t("请输入偏转横向偏移") }]}
                        tooltip={t('单位/米')}
                    >
                        <InputNumber step={0.1} style={{ width: '100%' }} placeholder={t("请输入偏转横向偏移")} ></InputNumber>
                    </Form.Item>
                    <Form.Item
                        label={t('偏转纵向偏移')}
                        name='verticalOffset'
                        rules={[{ required: true, message: t("请输入偏转纵向偏移") }]}
                        tooltip={t('单位/米')}
                    >
                        <InputNumber step={0.1} style={{ width: '100%' }}  placeholder={t("请输入偏转纵向偏移")}></InputNumber>
                    </Form.Item>
                    <Form.Item
                        label={t('叉尺抬升高度')}
                        name='forkLiftHeightDeviation'
                        rules={[{ required: true, message: t("请输入叉尺抬升高度") }]}
                        tooltip={t('单位/米')}
                    >
                        <InputNumber step={0.1} style={{ width: '100%' }}  placeholder={t("请输入叉尺抬升高度")}></InputNumber>
                    </Form.Item>
                    <Form.Item
                        label={t('叉尺提前抬升距离')}
                        name='forkLiftAdvanceHeight'
                        rules={[{ required: true, message: t("请输入叉尺提前抬升距离") }]}
                        tooltip={t('单位/米')}
                    >
                        <InputNumber step={0.1} style={{ width: '100%' }}  placeholder={t("请输入叉尺提前抬升距离")}></InputNumber>
                    </Form.Item>
                    <Form.Item
                        label={t('托盘抬升高度')}
                        name='trayLiftHeight'
                        rules={[{ required: true, message: t("请输入托盘抬升高度") }]}
                        tooltip={t('单位/米')}
                    >
                        <InputNumber step={0.1} style={{ width: '100%' }}  placeholder={t("请输入托盘抬升高度")}></InputNumber>
                    </Form.Item>
                    <Form.Item
                        label={t('货架层高补偿')}
                        name='shelfHeightCompensation'
                        rules={[{ required: true, message: t("请输入货架层高补偿") }]}
                        tooltip={t('单位/米')}
                    >
                        <InputNumber step={0.1} style={{ width: '100%' }}  placeholder={t("请输入货架层高补偿")}></InputNumber>
                    </Form.Item>
                    <Form.Item
                        label={t('安全检测尺寸')}
                        name='safetyInspectionDimensions'
                        rules={[{ required: true, message: t("请输入安全检测尺寸") }]}
                        tooltip={t('单位/米')}
                    >
                        <InputNumber step={0.1} style={{ width: '100%' }}  placeholder={t("请输入安全检测尺寸")}></InputNumber>
                    </Form.Item>
                </Form>
            </Modal></>
    )
}