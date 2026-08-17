/**
 * 多级菜单演示页面（规格 §14.2）：同一实现注册于三个层级叶子路由
 * （/demo/nested/level1、/demo/nested/level1/level2、/demo/nested/level1/level2/level3），
 * 由当前 pathname 识别层级；子树权限 demo:nested:view 声明在多级菜单目录节点（规格 §4.4 权限继承）。
 * 页面承担三类演示载体：
 * - 三级导航：层级步骤条与「进入下一级」按钮在相邻层级路由间导航（§19.1 三级菜单验收）；
 * - 面包屑链：展示当前匹配路径与层级链，布局层面包屑随导航实时更新；
 * - 页签缓存验证：表单输入由 Activity 页面缓存保留，切换页签或层级后返回本页签，输入内容不变（§19.1）。
 * 层级标题复用 menu 命名空间的路由标题文案，不在 demoNested 命名空间重复维护。
 */
import { Button, Form, Input, Space, Steps, Switch } from 'antd'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { DEMO_NESTED_I18N_NAMESPACE } from '@/constants/demo/demo.constants'
import { ROUTE_PATHS } from '@/constants/route.constants'
import { MENU_NAMESPACE } from '@/i18n/i18n'
import { PageCard } from '@/components/PageCard/PageCard'

/** 层级描述：路由路径与标题文案 key 一一对应（顺序即层级顺序） */
const DEMO_NESTED_LEVELS = [
  { path: ROUTE_PATHS.DEMO_NESTED_LEVEL1, titleKey: '一级页面' },
  { path: ROUTE_PATHS.DEMO_NESTED_LEVEL2, titleKey: '二级页面' },
  { path: ROUTE_PATHS.DEMO_NESTED_LEVEL3, titleKey: '三级页面' },
] as const

/** 当前 pathname 对应的层级下标；路由保证命中三者之一，末尾斜杠按同一路径归一 */
function resolveLevelIndex(pathname: string): number {
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  const index = DEMO_NESTED_LEVELS.findIndex((entry) => entry.path === normalized)
  return index >= 0 ? index : 0
}

export function NestedDemo() {
  const { t } = useTranslation(DEMO_NESTED_I18N_NAMESPACE)
  const translateMenu = (key: string): string => t(key, { ns: MENU_NAMESPACE })
  const navigate = useNavigate()
  const pathname = useLocation().pathname
  const current = resolveLevelIndex(pathname)
  const currentTitle = translateMenu(DEMO_NESTED_LEVELS[current].titleKey)

  const breadcrumbChain = [translateMenu('演示'), translateMenu('多级菜单'), currentTitle].join(' / ')

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* 单卡片骨架（SPEC_UI2 §7）：演示页两张纸面白卡 */}
      <PageCard title={t('多级菜单演示')}>
        <Steps
          current={current}
          onChange={(index) => void navigate(DEMO_NESTED_LEVELS[index].path)}
          items={DEMO_NESTED_LEVELS.map((entry) => ({ title: translateMenu(entry.titleKey) }))}
        />
        <Space wrap style={{ marginTop: 16 }}>
          {current < DEMO_NESTED_LEVELS.length - 1 && (
            <Button
              type="primary"
              onClick={() => void navigate(DEMO_NESTED_LEVELS[current + 1].path)}
            >
              {t('进入{{name}}', { name: translateMenu(DEMO_NESTED_LEVELS[current + 1].titleKey) })}
            </Button>
          )}
          <span>
            {t('当前路由')}：{pathname}
          </span>
          <span>
            {t('面包屑链')}：{breadcrumbChain}
          </span>
        </Space>
      </PageCard>
      <PageCard title={t('页签缓存验证')}>
        <p style={{ marginTop: 0 }}>{t('切换到其他页签或层级后返回本页签，下方表单内容保持不变（页面缓存由 Activity 保留）')}</p>
        <Form layout="vertical">
          <Form.Item label={t('演示输入框')} name="demoInput">
            <Input placeholder={t('在任意层级页签输入内容后离开再返回')} allowClear />
          </Form.Item>
          <Form.Item label={t('演示多行输入')} name="demoTextarea">
            <Input.TextArea rows={3} placeholder={t('多行输入同样随页签缓存保留')} />
          </Form.Item>
          <Form.Item label={t('演示开关')} name="demoSwitch" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </PageCard>
    </Space>
  )
}
