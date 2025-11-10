import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { apiClient } from '@/lib/api'
import { AuthenticatedLayout } from '@/components/AuthenticatedLayout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const token = apiClient.getToken()
    if (!token) {
      throw redirect({ to: '/login' })
    }
    try {
      await apiClient.getCurrentUser()
    } catch {
      apiClient.clearToken()
      throw redirect({ to: '/login' })
    }
  },
  component: () => (
    <AuthenticatedLayout>
      <Outlet />
    </AuthenticatedLayout>
  ),
})
