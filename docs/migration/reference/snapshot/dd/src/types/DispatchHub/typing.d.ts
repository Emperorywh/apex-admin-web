export interface ChildConfig {
    id: number;
    configType: string;
    configTypeName: string;
    configKey: string;
    configKeyName: string;
    configValueType: "int" | "bool" | "enum" | "string" | "select" | "double"; // enmu 单选 select 多选 double 小数
    configValue: string;
    defaultConfigValue: string;
    configValueUnit: string;
    configValueRange: string;
    childTaskConfigs: ChildConfig[];
}

export interface StrategyConfigTypes {
    id: string | null;
    configType: string;
    configTypeName: string;
    configKey: null;
    configKeyName: null;
    configValueType: null;
    configValue: null;
    defaultConfigValue: null;
    configValueUnit: null;
    configValueRange: null;
    childTaskConfigs: ChildConfig[];
}

export interface EditConfigParams {
    configKey: string;
    configValue: string;
}
