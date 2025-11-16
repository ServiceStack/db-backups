'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import type { DatabaseConfig } from '@/types';

export default function DatabasesPage() {
  const [databases, setDatabases] = useState<DatabaseConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDatabase, setEditingDatabase] = useState<DatabaseConfig | null>(null);
  const [formData, setFormData] = useState({
    Name: '',
    Type: 'postgresql' as 'postgresql' | 'mysql',
    Host: '',
    Port: 5432,
    DatabaseName: '',
    Username: '',
    Password: '',
    DockerContainerName: '',
    Enabled: true,
  });

  useEffect(() => {
    fetchDatabases();
  }, []);

  async function fetchDatabases() {
    try {
      const res = await fetch('/api/databases');
      const data = await res.json();
      if (data.success) {
        setDatabases(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch databases:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingDatabase(null);
    setFormData({
      Name: '',
      Type: 'postgresql',
      Host: '',
      Port: 5432,
      DatabaseName: '',
      Username: '',
      Password: '',
      DockerContainerName: '',
      Enabled: true,
    });
    setIsModalOpen(true);
  }

  function openEditModal(db: DatabaseConfig) {
    setEditingDatabase(db);
    setFormData({
      Name: db.Name,
      Type: db.Type,
      Host: db.Host,
      Port: db.Port,
      DatabaseName: db.DatabaseName,
      Username: db.Username,
      Password: '', // Don't populate password for security
      DockerContainerName: db.DockerContainerName || '',
      Enabled: db.Enabled,
    });
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const url = editingDatabase
        ? `/api/databases/${editingDatabase.Id}`
        : '/api/databases';

      const method = editingDatabase ? 'PUT' : 'POST';

      const body = { ...formData };
      // Don't send empty password on edit
      if (editingDatabase && !formData.Password) {
        delete (body as any).Password;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        setIsModalOpen(false);
        fetchDatabases();
      } else {
        alert(data.error?.message || 'Failed to save database');
      }
    } catch (error) {
      console.error('Failed to save database:', error);
      alert('Failed to save database');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this database configuration?')) {
      return;
    }

    try {
      const res = await fetch(`/api/databases/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        fetchDatabases();
      } else {
        alert(data.error?.message || 'Failed to delete database');
      }
    } catch (error) {
      console.error('Failed to delete database:', error);
      alert('Failed to delete database');
    }
  }

  async function handleTestConnection(id: string) {
    try {
      const res = await fetch(`/api/databases/${id}/test-connection`, {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success && data.data.success) {
        alert(`Connection successful!\nVersion: ${data.data.version || 'Unknown'}`);
      } else {
        alert(`Connection failed: ${data.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to test connection:', error);
      alert('Failed to test connection');
    }
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Databases</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your database configurations
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <span className="mr-2">➕</span> Add Database
        </Button>
      </div>

      {databases.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <span className="text-6xl">🗄️</span>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              No databases configured
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Get started by adding your first database configuration.
            </p>
            <div className="mt-6">
              <Button onClick={openCreateModal}>Add Database</Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {databases.map((db) => (
            <Card key={db.Id}>
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {db.Name}
                    </h3>
                    <Badge variant={db.Type === 'postgresql' ? 'info' : 'success'}>
                      {db.Type === 'postgresql' ? 'PostgreSQL' : 'MySQL'}
                    </Badge>
                  </div>
                  <Badge variant={db.Enabled ? 'success' : 'default'}>
                    {db.Enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Host:</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {db.Host}:{db.Port}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Database:</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {db.DatabaseName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Username:</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {db.Username}
                    </span>
                  </div>
                  {db.DockerContainerName && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Container:</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {db.DockerContainerName}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => handleTestConnection(db.Id)}
                  >
                    Test
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => openEditModal(db)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    className="flex-1"
                    onClick={() => handleDelete(db.Id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDatabase ? 'Edit Database' : 'Add Database'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingDatabase ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            required
            value={formData.Name}
            onChange={(e) => setFormData({ ...formData, Name: e.target.value })}
            placeholder="My Production Database"
          />

          <Select
            label="Type"
            required
            value={formData.Type}
            onChange={(e) =>
              setFormData({
                ...formData,
                Type: e.target.value as 'postgresql' | 'mysql',
                Port: e.target.value === 'postgresql' ? 5432 : 3306,
              })
            }
            options={[
              { value: 'postgresql', label: 'PostgreSQL' },
              { value: 'mysql', label: 'MySQL' },
            ]}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Host"
              required
              value={formData.Host}
              onChange={(e) => setFormData({ ...formData, Host: e.target.value })}
              placeholder="localhost"
            />

            <Input
              label="Port"
              type="number"
              required
              value={formData.Port}
              onChange={(e) =>
                setFormData({ ...formData, Port: parseInt(e.target.value) })
              }
            />
          </div>

          <Input
            label="Database Name"
            required
            value={formData.DatabaseName}
            onChange={(e) =>
              setFormData({ ...formData, DatabaseName: e.target.value })
            }
            placeholder="myapp"
          />

          <Input
            label="Username"
            required
            value={formData.Username}
            onChange={(e) => setFormData({ ...formData, Username: e.target.value })}
            placeholder="postgres"
          />

          <Input
            label="Password"
            type="password"
            required={!editingDatabase}
            value={formData.Password}
            onChange={(e) => setFormData({ ...formData, Password: e.target.value })}
            placeholder={editingDatabase ? 'Leave blank to keep current' : ''}
            helperText={
              editingDatabase
                ? 'Leave blank to keep the current password'
                : undefined
            }
          />

          <Input
            label="Docker Container Name (Optional)"
            value={formData.DockerContainerName}
            onChange={(e) =>
              setFormData({ ...formData, DockerContainerName: e.target.value })
            }
            placeholder="postgres"
          />

          <div className="flex items-center">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.Enabled}
              onChange={(e) =>
                setFormData({ ...formData, Enabled: e.target.checked })
              }
              className="mr-2"
            />
            <label htmlFor="enabled" className="text-sm text-gray-700 dark:text-gray-300">
              Enable this database configuration
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
