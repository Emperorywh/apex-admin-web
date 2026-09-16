/**
 * ApexTable 统一消费入口（T021 交付）：
 * 业务页面只从 `@/components/ApexTable` 导入表格与适配能力。
 *
 * - 先加载库入口（自带结构/主题样式），再加载本目录主题桥，
 *   保证 `--apex-table-*` → `--app-*` 的覆盖顺序；
 * - 统一出口避免页面散落引用库名与各自拼 locale/主题。
 */

import 'apex-table-react'
import './apexTableTheme.css'

export * from 'apex-table-react'
export * from './apexTableLocales'
export * from './useApexTableLocale'
export * from './tableColumnPreferences'
export * from './legacyTableRequest'
