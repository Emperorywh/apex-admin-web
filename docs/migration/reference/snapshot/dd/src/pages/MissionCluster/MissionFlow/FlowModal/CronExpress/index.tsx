/**
 * @description 时间表达式的组件
 * @date 2025-10-30
 */
import { useState } from "react";
import { Input, Popover, Button, Row, Col } from "antd";
import { TableOutlined } from "@ant-design/icons";
import CronTabs from "./CronTabs";
import { useI18n } from "@/hooks/useI18n";

interface CronExpressProps {
    id?: string;
    value?: string;
    onChange?: (value: string) => void;
}

export default (props: CronExpressProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { id, value, onChange } = props;

    const [cronValue, setCronValue] = useState<string>("* * * * * ?");

    // 触发更新
    const triggerChange = (value: string) => {
        setCronValue(value);
        onChange?.(value);
    };

    return (
        <Row>
            <Col span={18}>
                <Input
                    value={value || cronValue}
                    placeholder={t("请选择时间表达式")}
                    onChange={e => onChange?.(e.target.value)}
                />
            </Col>
            <Col span={2} offset={2}>
                <Popover
                    id={id}
                    content={
                        <CronTabs
                            triggerChange={triggerChange}
                            cronValue={cronValue}
                        />
                    }
                >
                    <Button
                        type="primary"
                        icon={<TableOutlined />}
                    >
                        {t("表达式")}
                    </Button>
                </Popover>
            </Col>
        </Row>
    )
};