import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import App from '@/App/App'
import { bootstrapRouter } from '@/router/bootstrap'
import { persistor, store } from '@/store/store'
import '@/i18n/i18n'
import '@/styles/globals.css'

// 先完成路由启动引导（基础命名空间就绪）再挂载，避免首屏文案闪空
void bootstrapRouter().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <App />
        </PersistGate>
      </Provider>
    </StrictMode>,
  )
})
