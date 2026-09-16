// 画布用来保存提示信息的
import { useState } from "react";
import { DEFAULT_TOOLTIP } from "@/constants/graph/tooltip";
import type { TooltipTypes } from "@/types/OverLook";

const useTooltip = () => {
  const [tooltip, setTooltip] = useState<TooltipTypes>(DEFAULT_TOOLTIP);

  return {
    tooltip,
    setTooltip
  };
};

export default useTooltip;
