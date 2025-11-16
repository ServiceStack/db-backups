'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function S3ConfigsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">S3 Configurations</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage S3 storage settings
          </p>
        </div>
        <Button>
          <span className="mr-2">➕</span> Add S3 Config
        </Button>
      </div>

      <Card>
        <div className="text-center py-12">
          <span className="text-6xl">☁️</span>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            S3 Configuration Management
          </h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            S3 configuration UI coming soon. Use environment variables to configure S3.
          </p>
        </div>
      </Card>
    </div>
  );
}
