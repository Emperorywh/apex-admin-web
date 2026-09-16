/**
 * @description Dashboard 特性所需的 ECharts 最小注册集合（§9.1）
 *
 * 本模块只由 Dashboard 路由入口导入，不提升到全局 app.tsx。
 * 按需注册本规格实际使用的图表和组件，禁止以"预留"为由注册未使用能力。
 * option 新增组件时必须同步补注册并补测试。
 */
import * as echarts from "echarts/core";
import { AriaComponent, DataZoomComponent, GraphicComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
    AriaComponent,
    /*
     * 车辆状态堆叠图使用滑块与内置缩放，便于查看大量车辆。
     * 同时注册两种缩放组件，确保按需构建后交互仍然可用。
     */
    DataZoomComponent,
    GraphicComponent,
    GridComponent,
    LegendComponent,
    MarkLineComponent,
    TooltipComponent,
    BarChart,
    LineChart,
    PieChart,
    LabelLayout,
    CanvasRenderer,
]);

export { echarts };
