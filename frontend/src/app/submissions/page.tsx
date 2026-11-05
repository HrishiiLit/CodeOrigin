'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { listSubmissions } from '@/lib/api';
import { Submission, SubmissionStatus } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { SubmissionUploadForm } from '@/components/SubmissionUploadForm';

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showUpload, setShowUpload] = useState<boolean>(false);

  const fetchSubmissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listSubmissions({
        status: statusFilter || undefined,
      });
      setSubmissions(data.items);
    } catch (err: any) {
      console.error('Failed to load submissions:', err);
      setError(err.message || 'Unable to load submissions. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Code Submissions</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse registered Python submissions and revision history.
          </p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm self-start"
        >
          {showUpload ? 'Close Upload Form' : '+ New Submission'}
        </button>
      </div>

      {showUpload && (
        <div className="animate-fadeIn">
          <SubmissionUploadForm
            onSuccess={(newSub) => {
              setSubmissions((prev) => [newSub, ...prev]);
              setShowUpload(false);
            }}
          />
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Connection Error:</span>
            <span>{error}</span>
          </div>
          <button
            onClick={fetchSubmissions}
            className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-semibold rounded-md transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Filter by Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          {statusFilter && (
            <button
              onClick={() => setStatusFilter('')}
              className="text-xs text-indigo-600 hover:underline ml-1"
            >
              Clear
            </button>
          )}
        </div>
        <div className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-700">{submissions.length}</span> submissions
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-sm text-slate-500 flex flex-col items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading submissions...</span>
          </div>
        ) : submissions.length === 0 ? (
          <div className="p-16 text-center text-sm text-slate-500 flex flex-col items-center justify-center gap-2">
            <div className="text-3xl">📂</div>
            <p className="font-medium text-slate-700">No submissions found.</p>
            <p className="text-xs text-slate-400 max-w-sm">
              {statusFilter
                ? `No submissions found matching filter '${statusFilter}'.`
                : 'Upload a Python source file or repository archive, or execute the seed script to populate the dashboard.'}
            </p>
            {statusFilter ? (
              <button
                onClick={() => setStatusFilter('')}
                className="mt-2 text-xs font-medium text-indigo-600 hover:underline"
              >
                Clear Filter
              </button>
            ) : (
              <button
                onClick={() => setShowUpload(true)}
                className="mt-3 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100 transition"
              >
                + Create First Submission
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-medium">
                <tr>
                  <th className="px-6 py-3">File / Title</th>
                  <th className="px-6 py-3">Submission ID</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Size</th>
                  <th className="px-6 py-3">SHA-256</th>
                  <th className="px-6 py-3">Created</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {submissions.map((sub) => (
                  <tr key={sub.submission_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {sub.original_filename}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                      {sub.submission_id}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {(sub.size_bytes / 1024).toFixed(1)} KB
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                      {sub.source_sha256.substring(0, 10)}...
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(sub.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/submissions/${sub.submission_id}`}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        Inspect →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
