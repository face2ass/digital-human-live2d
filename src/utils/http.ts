// src/libs/api-client.ts
import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

// 添加API密钥拦截器
// apiClient.interceptors.request.use(config => {
//   const apiKey = localStorage.getItem('DIFY_API_KEY')
//   if (apiKey) {
//     config.headers.Authorization = `Bearer ${apiKey}`
//   }
//   return config
// })

export default apiClient