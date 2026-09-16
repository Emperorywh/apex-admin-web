/**
 * @description 地图推送记录
 *
 * 功能说明：
 * 1. 分页查询地图推送记录（每条记录 = 一次推送批次，含多台车辆子记录）
 * 2. 主表「推送结果」列汇总该批次下各子记录的推送状态计数
 * 3. 展开记录行查看子记录明细（车辆 / 状态 / 完成时间 / 失败原因 / 等待原因），
 *    子记录表格支持纯前端条件查询（车辆名称关键字 + 推送状态）与纯前端分页
 *    （一个批次可能包含大量车辆子记录，接口无子级查询/分页参数，故全部在前端做）
 * 4. 记录级「重新推送」：不传子记录 id，后端对该批次下全部车辆重推
 * 5. 子记录级「重推」：仅传单个子记录 id，对单台车辆重推
 * 6. 「取消推送」：对接 cancelPushMap，仅等待/推送中的子记录可取消
 *    （记录级取消整批未完成推送，子记录级取消单台车辆）
 *
 * 权限：重新推送与取消推送按钮统一受 PERM_BUTTON.MAP_PUSH_RECORD_RE_PUSH 控制
 * （后端暂未提供取消推送专用按钮码，先与重推共用同一按钮码）
 * @date 2026-7-16
 */
import { useEffect, useMemo, useState } from "react";
import { Button, Space, Table, Tag, Tooltip, Popconfirm, message, Input, Select } from "antd";
import type { TableProps, PaginationProps } from "antd";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { pageMapPushRecords, rePushMap, cancelPushMap } from "@/api";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";
import type {
    MapPushRecord,
    MapPushSubRecord,
    MapPushState,
    PageMapPushRecordsParams,
} from "@/types/MapPushRecord";
import styles from "./index.less";

/**
 * 推送状态 → Tag 语义色映射
 * 成功绿 / 失败红 / 进行中蓝 / 等待橙 / 已取消灰
 */
const STATE_COLOR_MAP: Record<MapPushState, string> = {
    WAITING: "orange",
    RUNNING: "processing",
    FAILED: "error",
    SUCCEEDED: "success",
    CANCELLED: "default",
};

/**
 * 推送状态 → 文案 key（组件内用 t() 翻译，跟随界面语言）
 * 这里的中文同时也是 locale 的 key
 */
const STATE_LABEL_KEY: Record<MapPushState, string> = {
    WAITING: "等待",
    RUNNING: "推送中",
    FAILED: "失败",
    SUCCEEDED: "成功",
    CANCELLED: "已取消",
};

/**
 * 判断子记录当前是否可取消推送：
 * 仅「等待 / 推送中」存在未完成的推送任务，取消才有意义；
 * 已成功 / 失败 / 已取消的记录推送已结束，不再展示取消按钮
 */
const isCancellable = (state: MapPushState) => state === "WAITING" || state === "RUNNING";

/**
 * 展开行内的子记录表格（独立小组件，每个展开行单独持有一份筛选/分页状态，互不干扰）：
 * - 条件查询：车辆名称关键字模糊匹配 + 推送状态精确匹配，纯前端筛选
 * - 分页：对筛选结果本地切片，纯前端分页
 * - 筛选条件变化时自动回到第一页；数据刷新后变少时页码兜底回退，避免停留在空页
 */
function SubRecordTable({
    subs,
    columns,
}: {
    /** 该推送批次下的全部子记录，作为筛选与分页的完整数据源 */
    subs: MapPushSubRecord[];
    /** 子记录表格列定义（含重推/取消操作列，由页面组件构建后传入） */
    columns: TableProps<MapPushSubRecord>["columns"];
}) {
    const { t } = useI18n();
    /* 筛选条件：车辆名称关键字 + 推送状态（undefined 表示不过滤该条件） */
    const [keyword, setKeyword] = useState("");
    const [stateFilter, setStateFilter] = useState<MapPushState | undefined>(undefined);
    /* 前端分页状态：当前页码 + 每页条数 */
    const [pageNo, setPageNo] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    /* 纯前端条件筛选：名称包含关键字（忽略首尾空格）且状态等于所选值 */
    const filtered = useMemo(() => {
        const kw = keyword.trim();
        return subs.filter((s) => {
            if (kw && !s.vehicleName.includes(kw)) {
                return false;
            }
            if (stateFilter && s.mapPushState !== stateFilter) {
                return false;
            }
            return true;
        });
    }, [subs, keyword, stateFilter]);

    /* 筛选条件变化时重置回第一页，避免停留在越界页码上看到空表 */
    useEffect(() => {
        setPageNo(1);
    }, [keyword, stateFilter]);

    /* 页码兜底：刷新/重推后子记录变少时回退到最后一页，保证当前页始终有数据 */
    const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(pageNo, maxPage);

    /* 纯前端分页：对筛选结果按当前页码切片 */
    const paged = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize]);

    /* 推送状态下拉选项：label 常量为中文，在组件层用 t() 翻译以跟随界面语言 */
    const stateOptions = (Object.keys(STATE_LABEL_KEY) as MapPushState[]).map((s) => ({
        value: s,
        label: t(STATE_LABEL_KEY[s]),
    }));

    return (
        <div className={styles.sub_table_wrap}>
            {/* 条件查询区：车辆名称关键字 + 推送状态，均为即时前端筛选 */}
            <div className={styles.sub_filter_bar}>
                <Input
                    allowClear
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder={t("请输入车辆名称")}
                    prefix={<SearchOutlined />}
                />
                <Select
                    allowClear
                    value={stateFilter}
                    onChange={(v) => setStateFilter(v)}
                    placeholder={t("请选择推送状态")}
                    options={stateOptions}
                />
            </div>
            <Table<MapPushSubRecord>
                columns={columns}
                dataSource={paged}
                rowKey={(s) => s.id}
                size="small"
                pagination={{
                    current: currentPage,
                    pageSize,
                    total: filtered.length,
                    showSizeChanger: true,
                    showTotal: (total) => t("总数{total}条", { total }),
                    onChange: (page, size) => {
                        setPageNo(page);
                        setPageSize(size);
                    },
                }}
            />
        </div>
    );
}

export default function MapPushNotificationRecords() {
    const { t } = useI18n();
    /* 推送操作按钮权限：重新推送与取消推送共用同一按钮码（后端暂无取消专用码） */
    const { hasPerm } = useAccess();
    const canOperate = hasPerm(PERM_BUTTON.MAP_PUSH_RECORD_RE_PUSH);

    /* 分页查询参数：接口仅支持分页，无搜索关键字 */
    const [searchParams, setSearchParams] = useState<PageMapPushRecordsParams>({
        pageNo: 1,
        pageSize: 10,
    });
    /* 分页器配置 */
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        current: 1,
        pageSize: 10,
        total: 0,
    });
    /* 推送记录列表 */
    const [records, setRecords] = useState<MapPushRecord[]>([]);
    /* 列表 loading */
    const [loading, setLoading] = useState<boolean>(false);
    /* 正在重推的节点 key 集合：记录级用 record-<id>，子记录级用 sub-<id>，用于按钮 loading 防重复点击 */
    const [rePushingKeys, setRePushingKeys] = useState<Set<string>>(new Set());
    /* 正在取消推送的节点 key 集合：key 规则同 rePushingKeys，独立维护避免与重推按钮 loading 互相干扰 */
    const [cancellingKeys, setCancellingKeys] = useState<Set<string>>(new Set());

    /* 分页查询推送记录 */
    const fetchRecords = () => {
        setLoading(true);
        pageMapPushRecords(searchParams)
            .then((res: any) => {
                if (res?.code === 200 && res?.message === "success") {
                    const data = res.data ?? {};
                    setRecords((data.records ?? []) as MapPushRecord[]);
                    setPaginationProps({
                        current: data.current ?? 1,
                        pageSize: data.size ?? searchParams.pageSize,
                        total: data.total ?? 0,
                    });
                } else {
                    message.warning(t("查询推送记录出错：{msg}", { msg: res?.message ?? "" }));
                }
            })
            .catch((err: any) => {
                if (err) {
                    message.error(t("查询推送记录出错：{msg}", { msg: err?.message ?? "" }));
                }
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchRecords();
    }, [searchParams]);

    /* 表格分页变化 */
    const onTableChange: TableProps<MapPushRecord>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({ pageNo: current, pageSize });
    };

    /**
     * 统一执行重新推送
     * - 记录级：不传 mapPushSubRecordIds，后端对该记录下全部子记录重推
     * - 子记录级：传单个子记录 id，仅重推该车辆
     */
    const doRePush = (
        key: string,
        params: { mapPushRecordId: number; mapPushSubRecordIds?: number[] },
    ) => {
        setRePushingKeys((prev) => new Set(prev).add(key));
        rePushMap(params)
            .then((res: any) => {
                if (res?.code === 200 && res?.message === "success") {
                    message.success(t("已发起重新推送"));
                    fetchRecords();
                } else {
                    message.warning(t("重新推送出错：{msg}", { msg: res?.message ?? "" }));
                }
            })
            .catch((err: any) => {
                if (err) {
                    message.error(t("重新推送出错：{msg}", { msg: err?.message ?? "" }));
                }
            })
            .finally(() => {
                setRePushingKeys((prev) => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                });
            });
    };

    /**
     * 统一执行取消推送（结构同 doRePush）
     * - 记录级：不传 mapPushSubRecordIds，后端对该记录下全部子记录取消推送
     * - 子记录级：传单个子记录 id，仅取消该车辆推送
     */
    const doCancelPush = (
        key: string,
        params: { mapPushRecordId: number; mapPushSubRecordIds?: number[] },
    ) => {
        setCancellingKeys((prev) => new Set(prev).add(key));
        cancelPushMap(params)
            .then((res: any) => {
                if (res?.code === 200 && res?.message === "success") {
                    message.success(t("已发起取消推送"));
                    fetchRecords();
                } else {
                    message.warning(t("取消推送出错：{msg}", { msg: res?.message ?? "" }));
                }
            })
            .catch((err: any) => {
                if (err) {
                    message.error(t("取消推送出错：{msg}", { msg: err?.message ?? "" }));
                }
            })
            .finally(() => {
                setCancellingKeys((prev) => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                });
            });
    };

    /* 主表「推送结果」列：按状态汇总该批次下各子记录计数，用 Tag 直观展示 */
    const renderStateSummary = (subs: MapPushSubRecord[] = []) => {
        if (subs.length === 0) {
            return <span className={styles.empty}>-</span>;
        }
        const counts: Partial<Record<MapPushState, number>> = {};
        subs.forEach((s) => {
            counts[s.mapPushState] = (counts[s.mapPushState] ?? 0) + 1;
        });
        return (
            <Space size={4} wrap>
                {(Object.keys(counts) as MapPushState[]).map((state) => (
                    <Tag key={state} color={STATE_COLOR_MAP[state]}>
                        {t(STATE_LABEL_KEY[state])} {counts[state]}
                    </Tag>
                ))}
            </Space>
        );
    };

    /* 子记录表格列定义（展开行内嵌） */
    const subColumns: TableProps<MapPushSubRecord>["columns"] = [
        {
            title: t("车辆名称"),
            dataIndex: "vehicleName",
            width: 250,
            /* 车辆名形如 test-<雪花id>，普遍较长；加宽并开启 ellipsis，
               由 antd 补上原生 title 悬浮提示，避免被全局省略规则截断成 ... 后无法看全 */
            ellipsis: true,
        },
        {
            title: t("推送状态"),
            dataIndex: "mapPushState",
            width: 100,
            render: (state: MapPushState) => (
                <Tag color={STATE_COLOR_MAP[state]}>{t(STATE_LABEL_KEY[state])}</Tag>
            ),
        },
        {
            title: t("完成时间"),
            dataIndex: "finishTime",
            width: 170,
            render: (text?: string) => (text ? text : <span className={styles.empty}>-</span>),
        },
        {
            title: t("失败原因"),
            dataIndex: "failReason",
            ellipsis: { showTitle: false },
            render: (text?: string) =>
                text ? (
                    <Tooltip title={text}>
                        <span>{text}</span>
                    </Tooltip>
                ) : (
                    <span className={styles.empty}>-</span>
                ),
        },
        {
            /*
             * 等待原因展示方式与失败原因一致：长文案截断后靠 Tooltip 悬浮看全文
             * 后端字段调整：原 cancelReason（取消原因）改为 waitReason（等待原因），
             * 如「车辆不是禁用状态」，解释该子记录为何仍处于等待推送状态
             */
            title: t("等待原因"),
            dataIndex: "waitReason",
            ellipsis: { showTitle: false },
            render: (text?: string) =>
                text ? (
                    <Tooltip title={text}>
                        <span>{text}</span>
                    </Tooltip>
                ) : (
                    <span className={styles.empty}>-</span>
                ),
        },
        {
            title: t("操作"),
            /* 重推 + 取消推送两个 link 小按钮并列，100 放不下会挤压出省略号 */
            width: 200,
            render: (_, sub) => {
                if (!canOperate) {
                    return null;
                }
                const key = `sub-${sub.id}`;
                return (
                    <Space size={0}>
                        <Popconfirm
                            title={t("重推")}
                            description={t("确定对该车辆重新推送地图吗？")}
                            onConfirm={() =>
                                doRePush(key, {
                                    mapPushRecordId: sub.mapPushRecordId,
                                    mapPushSubRecordIds: [sub.id],
                                })
                            }
                            okText={t("确定")}
                            cancelText={t("取消")}
                        >
                            <Button type="link" size="small" loading={rePushingKeys.has(key)}>
                                {t("重推")}
                            </Button>
                        </Popconfirm>
                        {/* 仅等待/推送中的子记录可取消，已结束的推送不再展示取消按钮 */}
                        {isCancellable(sub.mapPushState) && (
                            <Popconfirm
                                title={t("取消推送")}
                                description={t("确定对该车辆取消推送地图吗？")}
                                onConfirm={() =>
                                    doCancelPush(key, {
                                        mapPushRecordId: sub.mapPushRecordId,
                                        mapPushSubRecordIds: [sub.id],
                                    })
                                }
                                okText={t("确定")}
                                cancelText={t("取消")}
                            >
                                <Button
                                    type="link"
                                    size="small"
                                    danger
                                    loading={cancellingKeys.has(key)}
                                >
                                    {t("取消推送")}
                                </Button>
                            </Popconfirm>
                        )}
                    </Space>
                );
            },
        },
    ];

    /* 主表列定义 */
    const columns: TableProps<MapPushRecord>["columns"] = [
        {
            title: t("地图名称"),
            dataIndex: "mapName",
            width: 170,
            /* 全局 .ant-table-cell 已强制省略；此处开启 ellipsis 让 antd 补上原生 title，
               地图名偶尔较长被截断时，鼠标悬停仍可看全名 */
            ellipsis: true,
        },
        {
            title: t("地图版本"),
            dataIndex: "mapVersion",
            width: 150,
            /* 版本号如 V1784014836012 较长，加宽并开启悬浮提示，避免默认截断 */
            ellipsis: true,
        },
        {
            title: t("推送SLAM底图"),
            dataIndex: "enabledPushSlamMap",
            width: 120,
            render: (v: boolean) => (v ? t("是") : t("否")),
        },
        {
            title: t("推送结果"),
            dataIndex: "mapPushSubRecords",
            render: (subs: MapPushSubRecord[]) => renderStateSummary(subs),
        },
        { title: t("创建时间"), dataIndex: "createTime", width: 170, ellipsis: true },
        {
            title: t("操作"),
            /* 重新推送（primary）+ 取消推送（link）并列，140 放不下会换行挤压 */
            width: 250,
            fixed: "right",
            render: (_, record) => {
                if (!canOperate) {
                    return null;
                }
                const key = `record-${record.id}`;
                /* 整批取消仅在存在等待/推送中的子记录时才有意义，否则隐藏取消按钮 */
                const hasCancellable = (record.mapPushSubRecords ?? []).some((s) =>
                    isCancellable(s.mapPushState),
                );
                return (
                    <Space size={4}>
                        <Popconfirm
                            title={t("重新推送")}
                            description={t("确定对该推送记录下的全部车辆重新推送吗？")}
                            onConfirm={() => doRePush(key, { mapPushRecordId: record.id })}
                            okText={t("确定")}
                            cancelText={t("取消")}
                        >
                            <Button type="primary" loading={rePushingKeys.has(key)}>
                                {t("重新推送")}
                            </Button>
                        </Popconfirm>
                        {hasCancellable && (
                            <Popconfirm
                                title={t("取消推送")}
                                description={t("确定取消该推送记录下未完成的推送吗？")}
                                onConfirm={() =>
                                    doCancelPush(key, { mapPushRecordId: record.id })
                                }
                                okText={t("确定")}
                                cancelText={t("取消")}
                            >
                                <Button
                                    type="link"
                                    danger
                                    loading={cancellingKeys.has(key)}
                                >
                                    {t("取消推送")}
                                </Button>
                            </Popconfirm>
                        )}
                    </Space>
                );
            },
        },
    ];

    return (
        <div className={styles.map_push_records}>
            <div className={styles.toolbar}>
                <Button icon={<ReloadOutlined />} onClick={fetchRecords} loading={loading}>
                    {t("刷新")}
                </Button>
            </div>
            <Table<MapPushRecord>
                columns={columns}
                dataSource={records}
                loading={loading}
                rowKey={(r) => r.id}
                /* 列宽合计约 860（含展开图标列 50）+ 推送结果自适应；x 设为 1120 保证各列不被压缩出现省略号 */
                scroll={{ x: 1120, y: "calc(100vh - 320px)" }}
                pagination={{
                    ...paginationProps,
                    showSizeChanger: true,
                    showTotal: (total) => t("总数{total}条", { total }),
                }}
                onChange={onTableChange}
                expandable={{
                    /* 展开图标列固定宽度，避免 table-layout:fixed 下与首列争抢空间，
                       导致图标被裁切或邻列紧贴图标出现 ... */
                    columnWidth: 50,
                    /* 展开行渲染子记录表格（内含前端条件查询与前端分页）；无子记录时显示占位文案 */
                    expandedRowRender: (record) =>
                        record.mapPushSubRecords && record.mapPushSubRecords.length > 0 ? (
                            <SubRecordTable
                                subs={record.mapPushSubRecords}
                                columns={subColumns}
                            />
                        ) : (
                            <span className={styles.empty}>{t("暂无子记录")}</span>
                        ),
                    /* 无子记录的行不展示展开箭头 */
                    rowExpandable: (record) => (record.mapPushSubRecords?.length ?? 0) > 0,
                }}
            />
        </div>
    );
}
