/**
 * JSON 详情单元格（P28 操作日志页；旧实现 components/JsonViewer 等价迁移）。
 *
 * 旧版行为：字符串尝试 JSON.parse → 成功显示紧凑单行、点击 Popover 看格式化
 * JSON（标题带复制）；解析失败或空数据显示 emptyText「暂无数据」。
 *
 * 本实现按 P28 专项验收「日志详情区分缺失、空值和查询失败」与「保留服务器
 * 业务原文」收敛（差异已在交接记录登记）：
 * - 缺失（null/undefined/空串）→ 留白不可点击（AGENTS 第 3 节空值纪律）；
 * - JSON 空值（'null' 字面量/空对象 '{}'）→ 显示原文紧凑形态且可点开——
 *   「请求参数就是空」是真实业务记录，与「没有记录」可区分（旧版两者混为
 *   「暂无数据」）；
 * - 解析失败（非 JSON 文本）→ 保留服务器原文展示（单行省略+悬浮），不伪装
 *   成结构化数据，也不像旧版那样把原文吞成「暂无数据」；
 * - 解析成功 → 单元格紧凑单行，Popover 展示格式化 JSON（pre-wrap 可滚动），
 *   标题文案可复制（旧版 Typography.Text copyable 同语义，复制格式化文本）。
 * 查询失败（列表级）由 Apex 内建错误态呈现，不在单元格职责内。
 */

import { useMemo } from 'react'
import { Popover, Typography } from 'antd'
import { useTranslation } from 'react-i18next'

interface JsonPreviewCellProps {
  /** 字符串承载的 JSON 或服务器原文（协议原样，缺失为 null/undefined/空串） */
  value: string | null | undefined
  /** 弹层标题（也是复制按钮旁的文案，如「请求参数」） */
  title: string
}

/** 解析结果三分态：缺失（不渲染）/ 原文（非 JSON）/ 结构化 JSON */
interface ParsedJson {
  kind: 'raw' | 'json'
  /** 原文（raw 态）或解析出的 JSON 值（json 态） */
  raw?: string
  json?: unknown
}

/** 解析字符串承载的 JSON：仅「非空串且 parse 成功且结果非 null」算结构化 */
function parseJsonCell(value: string): ParsedJson {
  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed === null) {
      // 'null' 字面量：JSON 空值，按原文形态呈现（与缺失区分）
      return { kind: 'raw', raw: value }
    }
    return { kind: 'json', json: parsed }
  } catch {
    // 非 JSON 文本：保留服务器原文，不伪装成结构化数据
    return { kind: 'raw', raw: value }
  }
}

export default function JsonPreviewCell({ value, title }: JsonPreviewCellProps) {
  const { t } = useTranslation('operationLog')

  // 解析结果按引用稳定缓存：同一记录重复渲染不重复 parse
  const parsed = useMemo<ParsedJson | null>(() => {
    if (value === null || value === undefined || value === '') return null
    return parseJsonCell(value)
  }, [value])

  // 缺失：留白不可点击（空值纪律；与「JSON 空值」呈现明确区分）
  if (!parsed) return null

  // 弹层正文：结构化 JSON 格式化缩进；原文形态 pre-wrap 原样
  const formatted =
    parsed.kind === 'json' ? JSON.stringify(parsed.json, null, 4) : (parsed.raw ?? '')
  // 单元格紧凑单行：对象/数组紧凑序列化，原文形态原样
  const compact =
    parsed.kind === 'json' ? JSON.stringify(parsed.json) : (parsed.raw ?? '')

  return (
    <Popover
      trigger="click"
      placement="left"
      content={
        // 弹层正文样式与旧版 JsonViewer 同构（30vw×40vh 可滚动 pre-wrap），
        // 另加 wordBreak 与最小宽度防超长无空格原文撑破弹层
        <div
          style={{
            height: '40vh',
            width: '30vw',
            minWidth: 320,
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          {formatted}
        </div>
      }
      title={
        <Typography.Text copyable={{ text: formatted }}>
          {title}
        </Typography.Text>
      }
    >
      <div
        className="operation-log-json-cell"
        title={`${title} · ${t('点击查看详情')}`}
        style={{
          maxWidth: '100%',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          cursor: 'pointer',
        }}
      >
        {compact}
      </div>
    </Popover>
  )
}
