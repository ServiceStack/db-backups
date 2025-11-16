'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function RestoresPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Restore History</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View database restore operations
          </p>
        </div>
        <Button>
          <span className="mr-2">♻️</span> New Restore
        </Button>
      </div>

      <Card>
        <div className="text-center py-12">
          <span className="text-6xl">♻️</span>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            Restore Operations
          </h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Restore management UI coming soon. Use the API to perform restore operations.
          </p>
        </div>
      </Card>
    </div>
  );
}
