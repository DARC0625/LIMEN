'use client';

import { useState, useEffect } from 'react';
import { snapshotAPI } from '../lib/api';
import type { VMSnapshot } from '../lib/types';
import { useToast } from './ToastContainer';
import { logger } from '../lib/utils/logger';

interface SnapshotManagerProps {
  vmUuid: string;
  vmName: string;
}

export default function SnapshotManager({ vmUuid, vmName }: SnapshotManagerProps) {
  const toast = useToast();
  const [snapshots, setSnapshots] = useState<VMSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDesc, setSnapshotDesc] = useState('');

  useEffect(() => {
    fetchSnapshots();
  }, [vmUuid]);

  const fetchSnapshots = async () => {
    try {
      const data = await snapshotAPI.list(vmUuid);
      setSnapshots(data);
    } catch (err) {
      logger.error(err instanceof Error ? err : new Error(String(err)), {
        component: 'SnapshotManager',
        action: 'fetch_snapshots',
      });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotName.trim()) {
      toast.warning('Please enter a snapshot name');
      return;
    }

    setLoading(true);
    try {
      await snapshotAPI.create(vmUuid, snapshotName, snapshotDesc);
      setSnapshotName('');
      setSnapshotDesc('');
      setShowCreate(false);
      fetchSnapshots();
      toast.success('Snapshot created successfully!');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create snapshot';
      toast.error(`Failed to create snapshot: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (snapshotId: number) => {
    if (!confirm('Are you sure you want to restore this snapshot? This will stop the VM.')) return;

    setLoading(true);
    try {
      await snapshotAPI.restore(snapshotId);
      fetchSnapshots();
      toast.success('Snapshot restored successfully!');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to restore snapshot';
      toast.error(`Failed to restore snapshot: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (snapshotId: number) => {
    if (!confirm('Are you sure you want to delete this snapshot?')) return;

    setLoading(true);
    try {
      await snapshotAPI.delete(snapshotId);
      fetchSnapshots();
      toast.success('Snapshot deleted successfully!');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete snapshot';
      toast.error(`Failed to delete snapshot: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 transition-colors" aria-label={`Snapshot management for ${vmName}`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-gray-900">Snapshots for {vmName}</h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          aria-expanded={showCreate}
          aria-label={showCreate ? 'Cancel creating snapshot' : 'Create new snapshot'}
        >
          {showCreate ? 'Cancel' : '+ Create Snapshot'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-4 p-3 bg-white rounded border border-gray-200 transition-colors" aria-label="Create snapshot form">
          <div className="space-y-2">
            <label htmlFor={`snapshot-name-${vmUuid}`} className="sr-only">Snapshot name</label>
            <input
              id={`snapshot-name-${vmUuid}`}
              type="text"
              placeholder="Snapshot name"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              required
              className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              aria-label="Snapshot name"
            />
            <label htmlFor={`snapshot-desc-${vmUuid}`} className="sr-only">Snapshot description (optional)</label>
            <textarea
              id={`snapshot-desc-${vmUuid}`}
              placeholder="Description (optional)"
              value={snapshotDesc}
              onChange={(e) => setSnapshotDesc(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              rows={2}
              aria-label="Snapshot description (optional)"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              aria-busy={loading}
              aria-label={loading ? 'Creating snapshot, please wait' : 'Create snapshot'}
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {snapshots.length === 0 ? (
        <p className="text-sm text-gray-500" role="status">No snapshots found.</p>
      ) : (
        <ul className="space-y-2" role="list" aria-label={`${snapshots.length} snapshot${snapshots.length !== 1 ? 's' : ''} available`}>
          {snapshots.map((snapshot) => (
            <li
              key={snapshot.id}
              className="p-3 bg-white rounded border border-gray-200 flex justify-between items-center transition-colors"
            >
              <div>
                <div className="font-medium text-gray-900">{snapshot.name}</div>
                {snapshot.description && (
                  <div className="text-sm text-gray-500">{snapshot.description}</div>
                )}
                <div className="text-xs text-gray-400">
                  <span className="sr-only">Created on </span>
                  {new Date(snapshot.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRestore(snapshot.id)}
                  disabled={loading}
                  className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                  aria-label={`Restore snapshot ${snapshot.name}`}
                  aria-disabled={loading}
                >
                  Restore
                </button>
                <button
                  onClick={() => handleDelete(snapshot.id)}
                  disabled={loading}
                  className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  aria-label={`Delete snapshot ${snapshot.name}`}
                  aria-disabled={loading}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

