/**
 * @description AGV车辆动作组
 * @date 2025-9-12
 */
import { useEffect, useState } from "react";
import { Input, Space, Button, Table, message, Tag, Popconfirm, Flex } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { GetProps, TableProps, PaginationProps } from "antd";
import styles from "./index.less";
import ActionGroupModal from "./ActionGroupModal";
import { pageAGVActionGroups, deleteAGVActionGroup, updateAGVActionGroup } from "@/api";
import { PageAGVActionGroupType, AgvActionGroups, AgvGroupRecord, AGVActionGroupType } from "@/types/ActionControl/AGVActionGroup";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import DraggableTag from "@/components/DraggableTag";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

const { Search } = Input;

type SearchProps = GetProps<typeof Input.Search>;

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();

    /* 按钮级权限判定（SPEC §8.3）：动作分组 新增/编辑/删除（编辑含拖拽排序） */
    const { hasPerm } = useAccess();
    const canAdd = hasPerm(PERM_BUTTON.ACTION_GROUP_ADD); // 新增分组（§7.1）
    const canUpdate = hasPerm(PERM_BUTTON.ACTION_GROUP_UPDATE); // 编辑分组（§7.2）；拖拽排序同属 update 写操作
    const canDelete = hasPerm(PERM_BUTTON.ACTION_GROUP_DELETE); // 删除分组（§7.2）

    const [openModal, setOpenModal] = useState<boolean>(false);
    // 查询参数
    const [searchParams, setSearchparams] = useState<PageAGVActionGroupType>({
        pageNo: 1,
        pageSize: 10,
        query: ""
    });
    // 分页参数
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        pageSize: 10,
        current: 1,
        total: 0
    });
    // 表格数据
    const [agvGroupRecord, setAgvGroupRecord] = useState<AgvGroupRecord[]>([]);
    // 当前的编辑行
    const [modifyRow, setModifyRow] = useState<AgvGroupRecord>();

    const sensors = useSensors(useSensor(PointerSensor));
    // 无编辑权限时禁用拖拽排序（拖拽即调用 update 接口，属 update 写操作）
    const sortableSensors = canUpdate ? sensors : [];

    // 分页查询表格数据
    const getAgvActionGroups = () => {
        pageAGVActionGroups(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: AgvActionGroups = res?.data;
                const { records, total, size, current } = data;
                setAgvGroupRecord(records);
                setPaginationProps({
                    pageSize: size,
                    current,
                    total
                });
            } else {
                message.warning(t("查询车辆动作组出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询车辆动作组出错") + err?.message);
            }
        })
    };

    // 搜索事件
    const onActionGroupSearch: SearchProps["onSearch"] = (value) => {
        setSearchparams({
            ...searchParams,
            query: value,
            pageNo: 1
        });
    };

    // 改变表格
    const onTableChange: TableProps<AgvGroupRecord>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchparams({
            ...searchParams,
            pageNo: current,
            pageSize
        });
    };

    // 新增动作组事件
    const handleAddActionGroup = () => {
        setModifyRow(undefined);
        setOpenModal(true);
    };

    // 编辑动作组事件
    const handleModifyActionGroup = (record: AgvGroupRecord) => {
        setModifyRow(record);
        setOpenModal(true);
    };

    // 删除动作组事件
    const deleteConfirm = (record: AgvGroupRecord) => {
        const { id } = record;
        deleteAGVActionGroup({ id }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getAgvActionGroups();
                message.success(t("删除车辆动作组成功"));
            } else {
                message.warning(t("删除车辆动作组出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除车辆动作组出错") + err?.message);
            }
        })
    };

    // 动作组动作的拖拽排序事件
    const handleDragEnd = (event: DragEndEvent, record: AgvGroupRecord) => {
        // 权限兜底：无编辑权限不允许拖拽排序（传感器已禁用，此处双重保险）
        if (!canUpdate) return;
        const { active, over } = event;
        if (!over) {
            return;
        }
        if (active.id !== over.id) {
            const data = record.agvActions;
            const oldIndex = data.findIndex((item) => item.id === active.id);
            const newIndex = data.findIndex((item) => item.id === over.id);
            const sortedAction = arrayMove(data, oldIndex, newIndex);
            const values: AGVActionGroupType = {
                id: record.id,
                agvActionGroupName: record.actionGroupName,
                agvActionIds: sortedAction.map(action => action.id)
            };
            updateAGVActionGroup(values).then(res => {
                if (res.code === 200 && res.message === "success") {
                    getAgvActionGroups();
                    message.success(t("编辑动作组成功"));
                } else {
                    message.warning(t("编辑动作组出错") + res?.message);
                }
            }).catch(err => {
                if (err) {
                    message.error(t("编辑动作组出错") + err?.message);
                }
            })
        }
    };

    const columns: TableProps<AgvGroupRecord>["columns"] = [
        {
            title: t("动作组名称"),
            dataIndex: "actionGroupName",
            ellipsis: { showTitle: true }
        },
        {
            title: t("动作组动作"),
            dataIndex: "agvActions",
            render: (value: AgvGroupRecord["agvActions"], record) => (
                <DndContext sensors={sortableSensors} onDragEnd={(event) => handleDragEnd(event, record)} collisionDetection={closestCenter}>
                    <SortableContext items={value} strategy={horizontalListSortingStrategy}>
                        <Flex gap="4px 0" wrap>
                            {value.map<React.ReactNode>((item) => (
                                <DraggableTag tag={item} key={item.id} />
                            ))}
                        </Flex>
                    </SortableContext>
                </DndContext>
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            width: 200,
            fixed: "right",
            render: (_, record) => (
                <Space>
                    {/* 编辑分组：无权限隐藏（§7.2） */}
                    {canUpdate && (
                        <Button
                            type="primary"
                            onClick={() => handleModifyActionGroup(record)}
                        >
                            {t("编辑")}
                        </Button>
                    )}
                    {/* 删除分组：无权限隐藏（§7.2） */}
                    {canDelete && (
                        <Popconfirm
                            title={t("删除")}
                            description={t("确认删除当前数据?")}
                            onConfirm={() => deleteConfirm(record)}
                            okText={t("确认")}
                            cancelText={t("取消")}
                        >
                            <Button danger>{t("删除")}</Button>
                        </Popconfirm>
                    )}
                </Space>
            ),
            ellipsis: { showTitle: true }
        }
    ];

    useEffect(() => {
        getAgvActionGroups();
    }, [searchParams])

    return (
        <div className={styles.agv_action_group}>
            <div className={styles.actions}>
                <Search
                    style={{ width: 360 }}
                    placeholder={t("查询车辆动作分组")}
                    onSearch={onActionGroupSearch}
                    enterButton
                />
                <Space>
                    {/* 新增分组：无权限隐藏（§7.1） */}
                    {canAdd && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleAddActionGroup}
                        >
                            {t("新增分组")}
                        </Button>
                    )}
                </Space>
            </div>
            <Table<AgvGroupRecord>
                style={{ marginTop: 10 }}
                columns={columns}
                dataSource={agvGroupRecord}
                rowKey={r => r.id as number}
                scroll={{ x: 800, y: "calc(100vh - 250px)" }}
                pagination={{
                    ...paginationProps,
                    showTotal: (total) => t("总数{total}条", { total }),
                    showSizeChanger: true,
                    hideOnSinglePage: false
                }}
                onChange={onTableChange}
            />
            <ActionGroupModal
                open={openModal}
                modifyRow={modifyRow}
                setOpenModal={setOpenModal}
                setModifyRow={setModifyRow}
                getAgvActionGroups={getAgvActionGroups}
            />
        </div>
    )
};
