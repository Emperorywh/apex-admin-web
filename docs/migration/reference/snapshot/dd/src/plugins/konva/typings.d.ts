export interface PathProperty {
    stroke: string;
    lineWidth: number;
    labelFill: string;
}

export interface RobotProperty {
    robotFill: {
        IDLE: string;
        TRAFFIC: string;
        PROCESSING: string;
        CHARGE: string;
        AVOID: string;
        ERROR: string;
        BRAKE: string;
        OFFLINE: string;
        PAUSED: string;
    };
    pathFill: {
        IDLE: string;
        TRAFFIC: string;
        PROCESSING: string;
        CHARGE: string;
        AVOID: string;
        ERROR: string;
        BRAKE: string;
        OFFLINE: string;
    };
    load: {
        stroke: string;
        strokeWidth: number;
    };
    order: {
        fill: string;
    };
    textFill: string;
    strokeStyle: {
        IDLE: string;
        TRAFFIC: string;
        PROCESSING: string;
        CHARGE: string;
        AVOID: string;
        ERROR: string;
        BRAKE: string;
        OFFLINE: string;
        PAUSED: string;
    };
    strokeWidth: number;
    opacity: number;
    focus: {
        stroke: string;
        strokeWidth: number;
        lineDash: number[];
    };
    localizationWarning: {
        fill: string;
        threshold: number;
        padding: number;
    };
    errorWarning: {
        fill: string;
    };
}

export interface KonvaConfig {
    maxCount: number;
    minZoom: number;
    maxZoom: number;
}

export interface TrafficItem {
    fill: string;
    stroke: string;
    strokeWidth: number;
    dash: number[];
}

export interface TrafficProperty {
    applyProperty: TrafficItem;
    lockedProperty: TrafficItem;
}

export interface NodeStyle {
    fill: string;
    stroke: string;
    radius: number;
    lineWidth: number;
    showArrow: boolean;
    labelFill: string;
}

export interface SelectedState {
    radius: number;
    lineWidth: number;
}
