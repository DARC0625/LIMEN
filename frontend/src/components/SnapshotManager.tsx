'use client';

import { useState, useEffect } from 'react';
import { snapshotAPI, VMSnapshot } from '../lib/api';
import { useToast } from './ToastContainer';

interface SnapshotManagerProps {
  vmId: number;
  vmName: string;
}

export default function SnapshotManager({ vmId, vmName }: SnapshotManagerProps) {
  const toast = useToast();
  const [snapshots, setSnapshots] = useState<VMSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDesc, setSnapshotDesc] = useState('');

  useEffect(() => {
    fetchSnapshots();
  }, [vmId]);

  const fetchSnapshots = async () => {
    try {
      const data = await snapshotAPI.list(vmId);
      setSnapshots(data);
    } catch (err) {
      console.error('Failed to fetch snapshots', err);
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
      await snapshotAPI.create(vmId, snapshotName, snapshotDesc);
      setSnapshotName('');
      setSnapshotDesc('');
      setShowCreate(false);
      fetchSnapshots();
      toast.success('Snapshot created successfully!');
    } catch (err: any) {
      toast.error(`Failed to create snapshot: ${err.message}`);
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
    } catch (err: any) {
      toast.error(`Failed to restore snapshot: ${err.message}`);
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
    } catch (err: any) {
      toast.error(`Failed to delete snapshot: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">Snapshots for {vmName}</h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {showCreate ? 'Cancel' : '+ Create Snapshot'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-4 p-3 bg-white rounded">
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Snapshot name"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              required
              className="w-full p-2 border rounded"
            />
            <textarea
              placeholder="Description (optional)"
              value={snapshotDesc}
              onChange={(e) => setSnapshotDesc(e.target.value)}
              className="w-full p-2 border rounded"
              rows={2}
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {snapshots.length === 0 ? (
        <p className="text-sm text-gray-500">No snapshots found.</p>
      ) : (
        <div className="space-y-2">
          {snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className="p-3 bg-white rounded flex justify-between items-center"
            >
              <div>
                <div className="font-medium">{snapshot.name}</div>
                {snapshot.description && (
                  <div className="text-sm text-gray-500">{snapshot.description}</div>
                )}
                <div className="text-xs text-gray-400">
                  Created: {new Date(snapshot.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRestore(snapshot.id)}
                  disabled={loading}
                  className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
                >
                  Restore
                </button>
                <button
                  onClick={() => handleDelete(snapshot.id)}
                  disabled={loading}
                  className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

