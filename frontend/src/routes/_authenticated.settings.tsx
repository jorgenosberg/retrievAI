import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <div className="min-h-full bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">Settings coming soon...</p>
          <a href="/chat" className="text-blue-600 hover:underline mt-4 inline-block">← Back to Chat</a>
        </div>
      </div>
    </div>
  )
}
