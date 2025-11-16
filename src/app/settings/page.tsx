'use client';

import { Card } from '@/components/ui/Card';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configure application settings
        </p>
      </div>

      <Card>
        <div className="text-center py-12">
          <span className="text-6xl">⚙️</span>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            System Settings
          </h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Settings management UI coming soon. Use environment variables to configure the application.
          </p>
        </div>
      </Card>
    </div>
  );
}
