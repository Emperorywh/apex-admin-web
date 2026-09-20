/**
 * cron 六段构建器 Tabs（旧 CronExpress/CronTabs 等价迁移）：
 * 秒 / 分 / 时 / 日 / 月 / 周六个 Tab，默认定位「秒」（旧 activeKey 同款）；
 * 各 Tab 的模式状态在 Tabs 内独立持有（旧每 Tab 组件各自 useState 同边界）。
 */

import { useState } from 'react'
import { Tabs } from 'antd'
import type { TabsProps } from 'antd'
import { useTranslation } from 'react-i18next'
import {
  CRON_FIELD_CONFIGS,
} from '@/features/mission-cluster/components/cron/cronConfig'
import { CronFieldTab } from '@/features/mission-cluster/components/cron/CronFieldTab'
import { CronWeekTab } from '@/features/mission-cluster/components/cron/CronWeekTab'

interface CronTabsProps {
  /** 当前完整表达式（内部态） */
  expression: string
  /** 表达式更新回调（写回 CronExpress 内部态并同步表单） */
  triggerChange: (value: string) => void
}

export function CronTabs({ expression, triggerChange }: CronTabsProps) {
  const { t } = useTranslation('orderFlow')

  // 默认展示秒 Tab（旧 activeKey "second" 同款）
  const [activeKey, setActiveKey] = useState<string>('second')

  const handleTabsChange: TabsProps['onChange'] = (value) => setActiveKey(value)

  const items: TabsProps['items'] = [
    {
      key: 'second',
      label: t('秒'),
      children: (
        <CronFieldTab
          config={CRON_FIELD_CONFIGS.second}
          expression={expression}
          triggerChange={triggerChange}
        />
      ),
    },
    {
      key: 'minute',
      label: t('分'),
      children: (
        <CronFieldTab
          config={CRON_FIELD_CONFIGS.minute}
          expression={expression}
          triggerChange={triggerChange}
        />
      ),
    },
    {
      key: 'hour',
      label: t('时'),
      children: (
        <CronFieldTab
          config={CRON_FIELD_CONFIGS.hour}
          expression={expression}
          triggerChange={triggerChange}
        />
      ),
    },
    {
      key: 'day',
      label: t('日'),
      children: (
        <CronFieldTab
          config={CRON_FIELD_CONFIGS.day}
          expression={expression}
          triggerChange={triggerChange}
        />
      ),
    },
    {
      key: 'month',
      label: t('月'),
      children: (
        <CronFieldTab
          config={CRON_FIELD_CONFIGS.month}
          expression={expression}
          triggerChange={triggerChange}
        />
      ),
    },
    {
      key: 'week',
      label: t('周'),
      children: <CronWeekTab expression={expression} triggerChange={triggerChange} />,
    },
  ]

  return <Tabs activeKey={activeKey} items={items} onChange={handleTabsChange} />
}
