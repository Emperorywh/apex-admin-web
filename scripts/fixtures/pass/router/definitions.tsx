import { BasicLayout } from '@/layouts/BasicLayout/BasicLayout'

export const routes = [
  {
    id: 'login',
    loadPage: () => import('@/pages/auth/Login/Login'),
    meta: { title: '登录' },
  },
]

export const layout = BasicLayout
