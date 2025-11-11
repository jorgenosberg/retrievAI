import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { apiClient } from '@/lib/api'
import { AuthenticatedLayout } from '@/components/AuthenticatedLayout'
import {
  ensureCurrentUser,
  getStoredToken,
  getStoredRefreshToken,
  resetAuthCache,
  getCachedUser,
} from '@/lib/authSession'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    // Check if we have tokens
    const token = apiClient.getToken() ?? getStoredToken()
    const refreshToken = apiClient.getRefreshToken() ?? getStoredRefreshToken()

    if (!token && !refreshToken) {
      resetAuthCache()
      throw redirect({ to: '/login' })
    }

    // Set tokens in apiClient if not already set
    if (!apiClient.getToken() && token) {
      apiClient.setToken(token)
    }

    // Check if we have a cached user (reduces /auth/me calls)
    const cachedUser = getCachedUser()
    if (cachedUser) {
      // We have a valid cached user, skip the API call
      return
    }

    // No cached user, validate with backend
    try {
      await ensureCurrentUser(() => apiClient.getCurrentUser())
    } catch (error) {
      // If authentication fails, clear everything and redirect
      resetAuthCache()
      apiClient.clearTokens()
      throw redirect({ to: '/login' })
    }
  },
  component: () => (
    <AuthenticatedLayout>
      <Outlet />
    </AuthenticatedLayout>
  ),
})
