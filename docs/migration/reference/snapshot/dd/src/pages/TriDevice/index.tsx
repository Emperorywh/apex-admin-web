/**
 * @description 三方设备
 * @date 2025-7-21
 */
import { useState } from "react";
import { Outlet } from "@umijs/max";
import { Tabs } from "antd";
import type { TabsProps } from "antd";
import AutoDoor from "./AutoDoor";
import Elevator from "./Elevator";
// import AirShowerDoor from "./AirShowerDoor";

export default () => {

    // const [activeKey, setActiveKey] = useState<string>("elevator");

    // const items: TabsProps["items"] = [
    //     {
    //         key: "elevator",
    //         label: '电梯',
    //         children: <Elevator />
    //     },
    //     {
    //         key: "autoDoor",
    //         label: "自动门",
    //         children: <AutoDoor />
    //     },
    //     {
    //         key: "AirShowerDoor",
    //         label: "风淋门",
    //         children: <AirShowerDoor />
    //     },
    // ];

    // const onTabsChange: TabsProps["onChange"] = (key) => {
    //     setActiveKey(key);
    // };

    return (
        <Outlet />
        // <Tabs
        //     style={{ padding: 20 }}
        //     activeKey={activeKey}
        //     items={items}
        //     onChange={onTabsChange}
        // />
    )
};
