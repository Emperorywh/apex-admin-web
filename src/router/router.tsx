/**
 * Data Router 装配。禁止以 index.tsx 承载实现。
 */

import { createBrowserRouter } from 'react-router'
import { accessRoutes } from '@/router/projections'

export const appRouter = createBrowserRouter(accessRoutes)
