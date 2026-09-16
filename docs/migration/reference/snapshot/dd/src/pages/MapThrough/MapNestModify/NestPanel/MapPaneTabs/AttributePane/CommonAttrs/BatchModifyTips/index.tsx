/**
 * @description 批量编辑时的提示
 * @date 2025-8-11
 */

import { Alert, Tooltip, Button } from "antd";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface TipProps {
    selectShapes: Konva.Shape[];
}

export default (props: TipProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    if (selectShapes?.length !== 1) {
        return (
            <Alert
                type="warning"
                showIcon
                closable
                message={t("批量编辑提示")}
                action={
                    <Tooltip
                        placement="top"
                        title={t("批量编辑时默认显示选择框左上角选中元素的属性，修改时会修改所有选中元素的属性。")}
                    >
                        <Button
                            type="link"
                            size="small"
                        >
                            {t("提示")}
                        </Button>
                    </Tooltip>
                }
            />
        )
    }
    return null;
};
