/**
 * @description 调度监控页面
 * @date 2025-5-19
 */
import { useState } from "react";
import { Splitter } from "antd";
import styles from "./index.less";
import ForceGraph from "./ForceGraph";
import PanelTabs from "./PanelTabs";
import type { SplitterProps } from "antd";
import { useLocalStorageState } from "ahooks";
import Konva from "konva";

export default () => {

    // 画布舞台Stage
    const [stage, setStage] = useState<Konva.Stage | null>(null);

    // 把panel的值存到localStroage
    const [sizes, setSizes] = useLocalStorageState<number>("overLookSizes", {
        defaultValue: 350,
        listenStorageChange: true
    });

    // 重新设置了宽度后存到本地
    const onSplitterResizeEnd: SplitterProps["onResizeEnd"] = (sizes) => {
        const [_, panelSize] = sizes;
        setSizes(panelSize);
    };

    return (
        <div className={styles.over_look}>
            <Splitter
                className={styles.map_splitter}
                lazy
                onResizeEnd={onSplitterResizeEnd}
            >
                <Splitter.Panel>
                    <ForceGraph
                        stage={stage}
                        setStage={setStage}
                    />
                </Splitter.Panel>

                <Splitter.Panel defaultSize={sizes} min={0} max={600} collapsible>
                    <PanelTabs
                        stage={stage}
                    />
                </Splitter.Panel>

            </Splitter>
        </div>
    )
};
