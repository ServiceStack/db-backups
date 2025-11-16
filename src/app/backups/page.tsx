'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';
import type { BackupExecution, DatabaseConfig } from '@/types';

export default function BackupsPage() {
  const [backups, setBackups] = useState<BackupExecution[]>([]);
  const [databases, setDatabases] = useState<DatabaseConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState('');
  const [backupType, setBackupType] = useState('manual');
  const [s3Upload, setS3Upload] = useState(true);
  const [filter, setFilter] = useState({ databaseId: '', status: '', type: '' });

  useEffect(() => {
    fetchData();
  }, [filter]);

  async function fetchData() {
    try {
      // Fetch databases
      const dbRes = await fetch('/api/databases');
      const dbData = await dbRes.json();
      if (dbData.success) {
        setDatabases(dbData.data || []);
      }

      // Fetch backups with filters
      let url = '/api/backups?limit=100';
      if (filter.databaseId) url += `&databaseId=${filter.databaseId}`;
      if (filter.status) url += `&status=${filter.status}`;
      if (filter.type) url += `&type=${filter.type}`;

      const backupsRes = await fetch(url);
      const backupsData = await backupsRes.json();
      if (backupsData.success) {
        setBackups(backupsData.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunBackup() {
    if (!selectedDatabase) {
      alert('Please select a database');
      return;
    }

    try {
      const res = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          DatabaseConfigId: selectedDatabase,
          BackupType: backupType,
          S3UploadEnabled: s3Upload,
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert('Backup started successfully!');
        setIsBackupModalOpen(false);
        fetchData();
      } else {
        alert(data.error?.message || 'Failed to start backup');
      }
    } catch (error) {
      console.error('Failed to start backup:', error);
      alert('Failed to start backup');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this backup?')) {
      return;
    }

    try {
      const res = await fetch(`/api/backups/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        fetchData();
      } else {
        alert(data.error?.message || 'Failed to delete backup');
      }
    } catch (error) {
      console.error('Failed to delete backup:', error);
      alert('Failed to delete backup');
    }
  }

  function formatBytes(bytes: number): string {
    if (!bytes) return 'N/A';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  function getDatabaseName(id: string): string {
    const db = databases.find((d) => d.Id === id);
    return db?.Name || 'Unknown';
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Backups</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View and manage your database backups
          </p>
        </div>
        <Button onClick={() => setIsBackupModalOpen(true)}>
          <span className="mr-2">▶️</span> Run Backup
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Database"
            value={filter.databaseId}
            onChange={(e) => setFilter({ ...filter, databaseId: e.target.value })}
            options={[
              { value: '', label: 'All Databases' },
              ...databases.map((db) => ({ value: db.Id, label: db.Name })),
            ]}
          />
          <Select
            label="Status"
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'completed', label: 'Completed' },
              { value: 'failed', label: 'Failed' },
              { value: 'running', label: 'Running' },
            ]}
          />
          <Select
            label="Type"
            value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
            options={[
              { value: '', label: 'All Types' },
              { value: 'hourly', label: 'Hourly' },
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'manual', label: 'Manual' },
            ]}
          />
        </div>
      </Card>

      {/* Backups Table */}
      <Card padding={false}>
        {backups.length === 0 ? (
          <div className="text-center py-12 px-6">
            <span className="text-6xl">💾</span>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              No backups found
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Run your first backup to get started.
            </p>
            <div className="mt-6">
              <Button onClick={() => setIsBackupModalOpen(true)}>Run Backup</Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Database
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    File Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    S3
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {backups.map((backup) => (
                  <tr key={backup.Id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {getDatabaseName(backup.DatabaseConfigId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {backup.FileName || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="default">{backup.BackupType}</Badge>
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
                      {formatBytes(backup.FileSizeBytes)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={backup.S3Uploaded ? 'success' : 'default'}>
                        {backup.S3Uploaded ? '✓' : '✗'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(new Date(backup.StartedAt), {
                        addSuffix: true,
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        {backup.Status === 'completed' && (
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => {
                              alert('Restore functionality coming soon!');
                            }}
                          >
                            Restore
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(backup.Id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Run Backup Modal */}
      <Modal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        title="Run Backup"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsBackupModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRunBackup}>Run Backup</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Database"
            required
            value={selectedDatabase}
            onChange={(e) => setSelectedDatabase(e.target.value)}
            options={[
              { value: '', label: 'Select a database' },
              ...databases
                .filter((db) => db.Enabled)
                .map((db) => ({ value: db.Id, label: db.Name })),
            ]}
          />

          <Select
            label="Backup Type"
            value={backupType}
            onChange={(e) => setBackupType(e.target.value)}
            options={[
              { value: 'manual', label: 'Manual' },
              { value: 'hourly', label: 'Hourly' },
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
          />

          <div className="flex items-center">
            <input
              type="checkbox"
              id="s3Upload"
              checked={s3Upload}
              onChange={(e) => setS3Upload(e.target.checked)}
              className="mr-2"
            />
            <label
              htmlFor="s3Upload"
              className="text-sm text-gray-700 dark:text-gray-300"
            >
              Upload to S3 after backup
            </label>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              The backup will be executed immediately. This may take a few minutes
              depending on the database size.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
