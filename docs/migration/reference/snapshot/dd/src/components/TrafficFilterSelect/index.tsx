/**
 * @description 交管白名单筛选多选 Select（Overlook / RecordPlayback 共用）
 * @date 2026-7-16
 *
 * 仅展示选中车辆的交管信息（白名单）。空选 = 显示全部
 * （由调用方在 TrafficGroup 层短路实现，本组件不感知）。
 *
 * 本组件只负责多选 UI（搜索 / tag 折叠 / 全选 / 反选 / 清空 / 计数），不负责：
 *   - 全局开关联动（setOverlayVisible）—— 调用方在 onChange 包装函数里做（见 SPEC §3.2）
 *   - options 数据构建（在线 ∪ 已选去重）—— 调用方传入（见 SPEC §3.5）
 */
import { memo, useMemo, type ReactNode, type CSSProperties } from "react";
import { Select, Button, Space, Divider } from "antd";
import { useI18n } from "@/hooks/useI18n";

export interface TrafficFilterOption {
    /** 车辆 agvKey，作为 Select value */
    value: string;
    /** 展示文案，在线车取 agvName||agvKey，离线已选车回退为 agvKey */
    label: string;
}

interface TrafficFilterSelectProps {
    /** 选中的 agvKey 数组（白名单） */
    value: string[];
    /** 选中集合变更回调 */
    onChange: (value: string[]) => void;
    /** 可选项：当前在线/在帧车辆 ∪ 已选(含离线)，按 value 去重 */
    options: TrafficFilterOption[];
    /** 全屏兼容弹层挂载容器 */
    getPopupContainer?: () => HTMLElement;
    /** 宽度，默认 220 */
    width?: number;
    /** 占位文案，默认 t("交管筛选") */
    placeholder?: string;
    /** Select 尺寸（Overlook 顶部常驻需与 ChangeMap 一致传 "large"） */
    size?: "large" | "middle" | "small";
    /** 透传内联样式（Overlook 顶部绝对定位用） */
    style?: CSSProperties;
}

export default memo((props: TrafficFilterSelectProps) => {

    const { value, onChange, options, getPopupContainer, width = 220, placeholder, size, style } = props;

    /* 国际化翻译方法，用于将计数、按钮等文案进行多语言转换 */
    const { t } = useI18n();

    // 当前可选项全集的 value（全选 / 反选均作用于当前 options = 在线 ∪ 已选）
    const allValues = useMemo(() => options.map(o => o.value), [options]);

    // 下拉底部：已选计数 + 全选 + 反选 + 清空
    // 不使用 Select 自带 allowClear，改用下拉里的「清空」按钮，语义更明确
    const dropdownRender = (menu: ReactNode): ReactNode => (
        <>
            {menu}
            <Divider style={{ margin: "4px 0" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 8px 8px" }}>
                <div style={{ fontSize: 12, color: "var(--ant-color-text-secondary)" }}>
                    {t("已选 {n}/{m}", { n: value.length, m: allValues.length })}
                </div>
                <Space size={4}>
                    <Button size="small" type="link" onClick={() => onChange(allValues)}>
                        {t("全选")}
                    </Button>
                    {/* 反选：当前 options 全集中剔除已选 */}
                    <Button
                        size="small"
                        type="link"
                        onClick={() => onChange(allValues.filter(k => !value.includes(k)))}
                    >
                        {t("反选")}
                    </Button>
                    {/* 清空 → 触发空选全显（SPEC §3.1） */}
                    <Button size="small" type="link" danger onClick={() => onChange([])}>
                        {t("清空")}
                    </Button>
                </Space>
            </div>
        </>
    );

    return (
        <Select
            mode="multiple"
            showSearch
            optionFilterProp="label"
            maxTagCount="responsive"
            value={value}
            onChange={onChange}
            options={options}
            size={size}
            placeholder={placeholder || t("交管筛选")}
            notFoundContent={t("暂无车辆")}
            dropdownRender={dropdownRender}
            getPopupContainer={getPopupContainer}
            // 下拉区域宽度 = 触发器宽度 × 1.5（默认 220 → 面板 330），避免长 agvName 被截断
            popupMatchSelectWidth={Math.round(width * 1.5)}
            // flexShrink:0 防止在 flex 工具栏（如 RecordPlayback TopBar 的 left_section）
            // 中因空间不足被压缩，确保宽度恒定为 width
            style={{ width, flexShrink: 0, ...style }}
        />
    );
});
