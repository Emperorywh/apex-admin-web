export const routes = [
  {
    id: 'login',
    loadPage: () => import('@/features/auth/components/LoginForm/LoginForm'),
    meta: { title: '登录' },
  },
]
