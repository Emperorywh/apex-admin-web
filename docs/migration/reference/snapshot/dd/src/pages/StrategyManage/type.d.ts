// 放货策略
interface dropStrategyType {
    id?: number;

    strategyType?:'pick' | 'drop'
    // 策略名称
    strategyName: string
    // 偏转横向偏移
    lateralOffset: number

    // 偏转纵向偏移
    verticalOffset: number

    // 叉尺抬升高度
    forkLiftHeightDeviation: number

    // 叉尺提前抬升距离
    forkLiftAdvanceHeight: number

    // 托盘抬升高度
    trayLiftHeight: number
    // 货架层高补偿
    shelfHeightCompensation: number

    // 安全检测尺寸
    safetyInspectionDimensions: number
}


// 取货策略
interface PickStrategyType extends dropStrategyType {
}

interface PageParams {
    pageSize?:number
    pageNo?:number
    strategyType?:'pick' | 'drop'
    query?:string
}

export interface DeleteStrategyType {
    id: number;
}

export { dropStrategyType, PickStrategyType ,PageParams}