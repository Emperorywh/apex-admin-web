/**
 * @description 批量拖动的组件
 * @date 2025-9-30
 */
import { useRef, memo, useMemo } from "react";
import { Transformer } from "react-konva";
import type Konva from "konva";

interface TransformerProps {
  selectShapes: Konva.Shape[];
}

export default memo((props: TransformerProps) => {

  const { selectShapes } = props;

  const transformerRef = useRef<Konva.Transformer>(null);

  useMemo(() => {
    const dragShapes = selectShapes.filter(shape => shape.attrs?.enableSelect === "node");
    transformerRef.current?.nodes(dragShapes);
  }, [selectShapes])

  return (
    <Transformer
      ref={transformerRef}
      keepRatio={false}
      resizeEnabled={false}
      rotateEnabled={false}
      rotateLineVisible={false}
      borderEnabled={false}
      ignoreStroke={true}
      boundBoxFunc={(oldBox, newBox) => {
        // 限制最小尺寸
        if (newBox.width < 10 || newBox.height < 10) {
          return oldBox;
        }
        return newBox;
      }}
      enabledAnchors={[
        "top-left", "top-center", "top-right",
        "middle-left", "middle-right",
        "bottom-left", "bottom-center", "bottom-right"
      ]}
    />
  )
});
