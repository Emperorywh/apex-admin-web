/**
 * @description 可拖拽的标签
 * @param props 
 * @returns 
 */
import { Tag } from "antd";
import { useSortable } from "@dnd-kit/sortable";
import type { ActionRecord } from "@/types/ActionControl/AGVActions";

const commonStyle: React.CSSProperties = {
    cursor: "move",
    transition: "unset", // Prevent element from shaking after drag
};

interface DraggableTagProps {
    tag: ActionRecord;
}

const DraggableTag: React.FC<DraggableTagProps> = (props) => {
    const { tag } = props;
    const { listeners, transform, transition, isDragging, setNodeRef } = useSortable({ id: tag.id });

    const style = transform
        ? {
            ...commonStyle,
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
            transition: isDragging ? "unset" : transition, // Improve performance/visual effect when dragging
        }
        : commonStyle;

    return (
        <Tag style={style} ref={setNodeRef} {...listeners}>
            {tag.actionDescription}
        </Tag>
    );
};

export default DraggableTag;