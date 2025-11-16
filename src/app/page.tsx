'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Stats {
  totalDatabases: number;
  totalBackups: number;
  last24hBackups: number;
  failedBackups: number;
  totalSize: number;
}

interface RecentBackup {
  Id: string;
  DatabaseConfigId: string;
  Status: string;
  FileName: string;
  FileSizeBytes: number;
  StartedAt: string;
  DurationSeconds: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentBackups, setRecentBackups] = useState<RecentBackup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      // Fetch databases
      const dbRes = await fetch('/api/databases');
      const dbData = await dbRes.json();
      const databases = dbData.data || [];

      // Fetch backups
      const backupsRes = await fetch('/api/backups?limit=100');
      const backupsData = await backupsRes.json();
      const backups = backupsData.data || [];

      // Calculate stats
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const last24h = backups.filter((b: RecentBackup) => new Date(b.StartedAt) > yesterday);
      const failed = backups.filter((b: RecentBackup) => b.Status === 'failed');
      const totalSize = backups.reduce((sum: number, b: RecentBackup) => sum + (b.FileSizeBytes || 0), 0);

      setStats({
        totalDatabases: databases.length,
        totalBackups: backups.length,
        last24hBackups: last24h.length,
        failedBackups: failed.length,
        totalSize,
      });

      setRecentBackups(backups.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Overview of your database backup and restore operations
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-4xl">🗄️</span>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Databases</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.totalDatabases || 0}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-4xl">💾</span>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Backups</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.totalBackups || 0}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-4xl">📈</span>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Last 24h</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.last24hBackups || 0}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-4xl">⚠️</span>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Failed Backups</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats?.failedBackups || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Total Storage */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Storage Used</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
              {formatBytes(stats?.totalSize || 0)}
            </p>
          </div>
          <span className="text-5xl">💿</span>
        </div>
      </Card>

      {/* Recent Backups */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Backups</h2>
          <Link href="/backups">
            <Button variant="secondary" size="sm">View All</Button>
          </Link>
        </div>

        {recentBackups.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">No backups yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    File Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {recentBackups.map((backup) => (
                  <tr key={backup.Id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {backup.FileName || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        variant={
                          backup.Status === 'completed'
                            ? 'success'
                            : backup.Status === 'failed'
                            ? 'error'
                            : backup.Status === 'running'
                            ? 'info'
                            : 'default'
                        }
                      >
                        {backup.Status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatBytes(backup.FileSizeBytes || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(new Date(backup.StartedAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <Card>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/databases/new">
            <Button variant="primary" className="w-full">
              <span className="mr-2">➕</span> Add Database
            </Button>
          </Link>
          <Link href="/schedules/new">
            <Button variant="primary" className="w-full">
              <span className="mr-2">⏰</span> Create Schedule
            </Button>
          </Link>
          <Link href="/backups">
            <Button variant="success" className="w-full">
              <span className="mr-2">▶️</span> Run Backup
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
