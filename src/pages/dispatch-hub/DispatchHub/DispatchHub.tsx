/**
 * 调度中心页（P13 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\DispatchHub）：antd Tabs 按配置类型分组 +
 * antd Table 行内编辑（EditableCell 点击编辑）+ 保存/重置确认 + 批量保存。
 * 本重写保持业务闭环等价并按样板升级基座：
 * - 表格迁移为 ApexTableReact data 模式（getTaskConfigs 一次全量、无分页、
 *   G09 不开放排序；稳定行 ID=configKey 协议唯一键），表格与列偏好封装在
 *   DispatchConfigTable（每分类一个实例，编辑控件/范围校验见该组件）；
 * - 「保存」走 batchEditConfigs 整批请求（不承诺原子事务，G13）：确认后先
 *   重新查询做预读冲突检查（服务端值≠页面基线即中止并列出冲突项、刷新基线、
 *   保留草稿，防止无条件覆盖他人修改），通过后提交；成功以本地提交值合成
 *   新基线（整批 200 = 服务端已确认），失败如实透传且输入全程保留；
 * - 「重置」语义按 TASKS.md P13 专项验收 = 草稿回退到最近一次确认保存的
 *   基线（纯前端放弃未保存修改；旧版「恢复默认值并写后端」的破坏性语义
 *   废弃，默认值列保留作参考）；
 * - 权限：无 save 码隐藏保存且单元格退化为只读文本（后端 dispatch-hub 下
 *   仅 save/reset 两按钮码，无独立编辑码，编辑唯一目的经保存提交，旧实现
 *   同边界）；reset 码控制重置入口；view 码挂路由守卫；
 * - 页签脏状态接入 useTabDirtyGuard（A13：切页保留、关页/刷新确认、
 *   LRU 不淘汰脏页签；草稿在组件内存，登出随会话清理销毁）；
 * - 旧版依赖英文 success 文案判断成败（res.message === "success"）废弃，
 *   成败统一由请求层业务码判定（A06）。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Space, Tabs } from 'antd'
import type { TabsProps } from 'antd'
import { useTranslation } from 'react-i18next'
import { ApexTableReact } from 'apex-table-react'
import { useApexLocale } from '@/hooks/useApexLocale'
import { usePermission } from '@/hooks/usePermission'
import { useTabDirtyGuard } from '@/hooks/useTabDirtyGuard'
import { confirmCommand } from '@/utils/command/commandConfirm'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import {
  batchEditConfigs,
  getTaskConfigs,
} from '@/services/dispatch-config/dispatch-config.service'
import type { TaskConfigDto } from '@/services/dispatch-config/dispatch-config.service.types'
import {
  fromEditorValue,
  isKnownValueType,
} from '@/features/dispatch-config/utils/configEditor'
import DispatchConfigTable from '@/features/dispatch-config/components/DispatchConfigTable'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './DispatchHub.module.css'

export default function DispatchHub() {
  // common 为常载基础命名空间：保存等公共词直接复用，页面私有词在 dispatchConfig
  // （本项目 nsSeparator 关闭，t() 一律不带 ns: 前缀，按数组顺序回退查找）
  const { t } = useTranslation(['dispatchConfig', 'common'], { nsMode: 'fallback' })
  const { message: uiMessage } = App.useApp()
  const apexLocale = useApexLocale()
  const { hasPerm } = usePermission()

  // 保存入口与单元格可编辑共用 save 码（后端无独立编辑码，旧实现同边界）
  const canSave = hasPerm(PERM_BUTTON.DISPATCH_HUB_SAVE)
  // 重置（草稿回退）入口按 reset 码控制显隐（旧实现同位置同权限码）
  const canReset = hasPerm(PERM_BUTTON.DISPATCH_HUB_RESET)

  /* --------------------------------- 配置加载 --------------------------------- */

  /** 基线：最近一次「确认保存」的服务端值（初次加载 / 冲突预读 / 保存成功合成后更新） */
  const [baseline, setBaseline] = useState<TaskConfigDto[]>([])
  /** 各分类的当前编辑行（草稿）；key=configType，value=该分类行数组（configValue 为草稿值） */
  const [tabRows, setTabRows] = useState<Record<string, TaskConfigDto[]>>({})
  const [activeKey, setActiveKey] = useState<string>('')
  const [initialLoading, setInitialLoading] = useState(true)
  /** 初次加载失败：页面渲染单表格错误态（重试按钮为 Apex 内建，符合按钮纪律） */
  const [loadError, setLoadError] = useState<unknown>(null)
  /** 保存命令在途（预读 + 提交两阶段）：保存/重置按钮统一禁用防连点 */
  const [committing, setCommitting] = useState(false)

  /** 初次加载（含错误重试）：全量拉取并初始化基线与各分类草稿行 */
  const loadConfigs = useCallback(async (signal?: AbortSignal) => {
    setInitialLoading(true)
    setLoadError(null)
    try {
      const groups = await getTaskConfigs({ signal })
      setBaseline(groups ?? [])
      const rows: Record<string, TaskConfigDto[]> = {}
      for (const group of groups ?? []) {
        if (group.configType !== undefined && group.configType !== null) {
          rows[group.configType] = (group.childTaskConfigs ?? []).map((row) => ({ ...row }))
        }
      }
      setTabRows(rows)
      // 默认落在第一个分类（旧实现同行为）
      setActiveKey((prev) => prev || groups?.[0]?.configType || '')
    } catch (error) {
      if (!isCancelledError(error)) {
        // A11：失败清空远端数据区并显示错误态；本页无草稿输入，无保留项
        setBaseline([])
        setTabRows({})
        setLoadError(error)
      }
    } finally {
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadConfigs(controller.signal)
    return () => controller.abort()
  }, [loadConfigs])

  /* ------------------------------ 草稿 diff 与脏状态 ------------------------------ */

  /** 统计某分类下草稿值 ≠ 基线值的行（确认框列名与脏判定共用） */
  const diffRows = useCallback(
    (configType: string): TaskConfigDto[] => {
      const base = baseline.find((group) => group.configType === configType)
      const baseValues = new Map<string, string>()
      for (const row of base?.childTaskConfigs ?? []) {
        baseValues.set(row.configKey ?? '', row.configValue ?? '')
      }
      return (tabRows[configType] ?? []).filter(
        (row) => (baseValues.get(row.configKey ?? '') ?? '') !== (row.configValue ?? ''),
      )
    },
    [baseline, tabRows],
  )

  /** 页面脏状态：任一分类存在未保存修改（驱动页签脏标记与按钮可用性） */
  const pageDirty = useMemo(
    () => Object.keys(tabRows).some((configType) => diffRows(configType).length > 0),
    [tabRows, diffRows],
  )

  // A13 草稿保护：脏页签不被 LRU 淘汰、关闭/刷新前列入确认
  useTabDirtyGuard(pageDirty, t('调度参数'))

  /* ------------------------------- 单元格写回 ------------------------------- */

  /** 草稿写回：编辑控件值 → 协议字符串后更新所属分类行（其余行引用不变） */
  const applyCellEdit = useCallback(
    (
      configType: string,
      configKey: string,
      valueType: TaskConfigDto['configValueType'],
      raw: unknown,
    ) => {
      if (!isKnownValueType(valueType)) return
      const text = fromEditorValue(valueType, raw)
      setTabRows((prev) => ({
        ...prev,
        [configType]: (prev[configType] ?? []).map((row) =>
          row.configKey === configKey ? { ...row, configValue: text } : row,
        ),
      }))
    },
    [],
  )

  /* ------------------------------- 保存与重置 ------------------------------- */

  /**
   * 保存当前分类（整批提交，两阶段）：
   * ① 预读冲突检查（G13）：重新拉取服务端值与页面基线比对，存在差异说明
   *    他人已修改——中止提交、列出冲突项、基线刷新为服务端值、草稿保留；
   *    用户核实后再次保存即知情覆盖（预读通过）。
   * ② batchEditConfigs 整批提交：成功以本地提交值合成新基线（200 = 服务端
   *    已确认），失败如实透传且输入保留；不承诺原子事务、不伪造逐项成败。
   */
  const handleSave = useCallback(() => {
    const configType = activeKey
    const rows = tabRows[configType] ?? []
    if (!canSave || rows.length === 0) return
    const typeName =
      baseline.find((group) => group.configType === configType)?.configTypeName ?? configType
    void confirmCommand({
      title: t('确定保存当前页调度参数吗?'),
      targets: rows.map((row) => row.configKeyName ?? row.configKey ?? ''),
      impact: t('将保存「{{tab}}」分类下全部 {{count}} 项调度参数（含未修改项），保存后立即生效', {
        tab: typeName,
        count: rows.length,
      }),
    }).then(async (confirmed) => {
      if (!confirmed) return
      setCommitting(true)
      try {
        // ① 预读：服务端最新值（他人并发修改检测）
        const fresh = await getTaskConfigs()
        const freshGroup = (fresh ?? []).find((group) => group.configType === configType)
        const freshValues = new Map<string, string>()
        for (const row of freshGroup?.childTaskConfigs ?? []) {
          freshValues.set(row.configKey ?? '', row.configValue ?? '')
        }
        const baseGroup = baseline.find((group) => group.configType === configType)
        const conflicts = (baseGroup?.childTaskConfigs ?? [])
          .filter((row) => (freshValues.get(row.configKey ?? '') ?? '') !== (row.configValue ?? ''))
          .map((row) => row.configKeyName ?? row.configKey ?? '')
        if (conflicts.length > 0) {
          // 冲突：中止提交；基线刷新为服务端值（再次保存即为知情覆盖）；草稿保留
          setBaseline(fresh ?? [])
          uiMessage.warning(
            t('配置已被其他用户修改，保存已中止，请核对后重试：{{keys}}', {
              keys: conflicts.slice(0, 5).join('、') + (conflicts.length > 5 ? '…' : ''),
            }),
          )
          return
        }
        // ② 整批提交（只含 key + 字符串值；select 多选已在写回时 ";" 连接）
        await batchEditConfigs(
          rows.map((row) => ({
            configKey: row.configKey ?? '',
            configValue: row.configValue ?? '',
          })),
        )
        // 成功：提交值即新基线（整批 200 = 服务端确认）；当前分类草稿清零
        setBaseline((prev) =>
          prev.map((group) =>
            group.configType === configType
              ? { ...group, childTaskConfigs: rows.map((row) => ({ ...row })) }
              : group,
          ),
        )
        setTabRows((prev) => ({
          ...prev,
          [configType]: rows.map((row) => ({ ...row })),
        }))
        uiMessage.success(t('保存调度参数成功'))
      } catch (error) {
        if (!isCancelledError(error)) {
          // 失败保留输入（草稿未动）；错误如实透传，不自动重试
          uiMessage.error(t('保存调度参数出错：{{msg}}', { msg: apiErrorMessage(error) }))
        }
      } finally {
        setCommitting(false)
      }
    })
  }, [activeKey, tabRows, baseline, canSave, t, uiMessage])

  /**
   * 重置当前分类草稿：回到最近一次确认保存的基线（纯前端放弃未保存修改，
   * 不发请求；旧版「恢复默认值并写后端」语义按 TASKS.md 专项验收废弃）。
   */
  const handleReset = useCallback(() => {
    const configType = activeKey
    const dirty = diffRows(configType)
    if (!canReset || dirty.length === 0) return
    const typeName =
      baseline.find((group) => group.configType === configType)?.configTypeName ?? configType
    void confirmCommand({
      title: t('确定要重置当前页调度参数吗?'),
      targets: dirty.map((row) => row.configKeyName ?? row.configKey ?? ''),
      impact: t(
        '将放弃「{{tab}}」分类下 {{count}} 项未保存修改，回到最近一次保存的值，该操作无法恢复',
        { tab: typeName, count: dirty.length },
      ),
      danger: true,
    }).then((confirmed) => {
      if (!confirmed) return
      const base = baseline.find((group) => group.configType === configType)
      setTabRows((prev) => ({
        ...prev,
        [configType]: (base?.childTaskConfigs ?? []).map((row) => ({ ...row })),
      }))
    })
  }, [activeKey, baseline, canReset, diffRows, t])

  /* --------------------------------- 渲染 --------------------------------- */

  // 初次加载中/失败：单表格呈现 loading / 内建错误重试（重试按钮只在表格内部）
  if (initialLoading || loadError) {
    return (
      <div className={styles.page}>
        <div className={styles.tableWrap}>
          <ApexTableReact
            columns={[]}
            data={[]}
            getRowId={() => ''}
            loading={initialLoading}
            error={loadError}
            onRetry={() => void loadConfigs()}
            locale={apexLocale}
            pagination={false}
            height="100%"
          />
        </div>
      </div>
    )
  }

  const tabItems: TabsProps['items'] = Object.keys(tabRows).map((configType) => {
    const group = baseline.find((item) => item.configType === configType)
    return {
      key: configType,
      // 分类名称为后端下发文案，协议原值展示不翻译
      label: group?.configTypeName ?? configType,
      children: (
        <DispatchConfigTable
          rows={tabRows[configType] ?? []}
          canSave={canSave}
          onEdit={(configKey, valueType, raw) =>
            applyCellEdit(configType, configKey, valueType, raw)
          }
        />
      ),
    }
  })

  return (
    <div className={styles.page}>
      <Tabs
        className={styles.tabs}
        activeKey={activeKey}
        items={tabItems}
        onChange={setActiveKey}
        tabBarExtraContent={{
          right: (
            <Space size={8} style={{ paddingRight: 8 }}>
              {canSave ? (
                <Button
                  type="primary"
                  loading={committing}
                  disabled={!pageDirty}
                  onClick={handleSave}
                >
                  {t('保存')}
                </Button>
              ) : null}
              {canReset ? (
                <Button
                  danger
                  loading={committing}
                  disabled={diffRows(activeKey).length === 0}
                  onClick={handleReset}
                >
                  {t('重置')}
                </Button>
              ) : null}
            </Space>
          ),
        }}
      />
    </div>
  )
}
