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
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showUpload, setShowUpload] = useState<boolean>(false);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const data = await listSubmissions({
        status: statusFilter || undefined,
      });
      setSubmissions(data.items);
    } catch (err) {
      console.error('Failed to load submissions:', err);
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
        </div>
        <div className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-700">{submissions.length}</span> submissions
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading submissions...</div>
        ) : submissions.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No submissions found matching criteria.
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
