import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { apiClient } from '@/lib/api'

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(1, 'Full name is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type RegisterForm = z.infer<typeof registerSchema>

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true)
    setError(null)
    try {
      await apiClient.register(data.email, data.password, data.fullName)
      setSuccess(true)
      setTimeout(() => { window.location.href = '/login' }, 2000)
    } catch (_err: unknown) {
      setError('Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-indigo-100 dark:from-primary-900/20 dark:to-indigo-900/20 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md p-8 text-center">
          <div className="text-green-600 dark:text-green-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Registration Successful!</h2>
          <p className="text-gray-600 dark:text-zinc-300">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-indigo-100 dark:from-primary-900/20 dark:to-indigo-900/20 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">RetrievAI</h1>
          <p className="text-gray-600 dark:text-zinc-300 mt-2">Create your account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 text-danger-600 dark:text-danger-300 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Full Name</label>
            <input {...register('fullName')} type="text" id="fullName" className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400" placeholder="John Doe" />
            {errors.fullName && <p className="text-danger-600 dark:text-danger-400 text-sm mt-1">{errors.fullName.message}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Email</label>
            <input {...register('email')} type="email" id="email" className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400" placeholder="you@example.com" />
            {errors.email && <p className="text-danger-600 dark:text-danger-400 text-sm mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Password</label>
            <input {...register('password')} type="password" id="password" className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400" placeholder="••••••••" />
            {errors.password && <p className="text-danger-600 dark:text-danger-400 text-sm mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Confirm Password</label>
            <input {...register('confirmPassword')} type="password" id="confirmPassword" className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400" placeholder="••••••••" />
            {errors.confirmPassword && <p className="text-danger-600 dark:text-danger-400 text-sm mt-1">{errors.confirmPassword.message}</p>}
          </div>

          <button type="submit" disabled={loading} className={`w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400 disabled:opacity-50 ${loading ? 'cursor-progress' : 'cursor-pointer'} disabled:cursor-not-allowed`}>
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/login" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm">Already have an account? Sign in</a>
        </div>
      </div>
    </div>
  )
}
