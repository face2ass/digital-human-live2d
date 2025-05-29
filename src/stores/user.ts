// src/store/user.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Ref } from 'vue'
import http from '@/utils/http'

interface User {
  id: number
  name: string
  avatar: string
}

export const useUserStore = defineStore('user', () => {
  // State
  const userInfo: Ref<User | null> = ref(null)
  const token = ref('')

  // Actions
  const login = async (credentials: { username: string; password: string }) => {
    try {
      const { token: responseToken } = await http.post<{ token: string }>('/login', credentials)
      token.value = responseToken
      localStorage.setItem('token', responseToken)
      await fetchUserInfo()
    } catch (error) {
      throw error
    }
  }

  const fetchUserInfo = async () => {
    try {
      userInfo.value = await http.get<User>('/user/info')
    } catch (error) {
      logout()
    }
  }

  const logout = () => {
    userInfo.value = null
    token.value = ''
    localStorage.removeItem('token')
  }

  return {
    // State
    userInfo,
    token,

    // Actions
    login,
    fetchUserInfo,
    logout
  }
})