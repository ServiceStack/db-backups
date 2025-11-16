'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function RetentionPoliciesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Retention Policies</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configure backup retention rules
          </p>
        </div>
        <Button>
          <span className="mr-2">➕</span> Create Policy
        </Button>
      </div>

      <Card>
        <div className="text-center py-12">
          <span className="text-6xl">📋</span>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            Retention Policy Management
          </h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Retention policy management UI coming soon. Currently using default policy (24h/7d/4w/12m).
          </p>
        </div>
      </Card>
    </div>
  );
}
