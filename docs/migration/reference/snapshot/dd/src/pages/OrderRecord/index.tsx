/**
 * @description 车辆工作的历史记录
 * @date 2025-6-10
 */
import OrderStatistics from "./OrderStatistics";
import RecordTable from "./RecordTable";
import styles from "./index.less";

export default () => {
    return (
        <div className={styles.history_record}>
            <OrderStatistics />
            <RecordTable />
        </div>
    )
};
