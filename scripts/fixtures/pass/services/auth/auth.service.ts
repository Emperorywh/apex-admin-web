import { request } from '../request/request'

export const authApi = { login: () => request.get('/auth/login') }
