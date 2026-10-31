'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { listSubmissions } from '@/lib/api';
import { Submission } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { SubmissionUploadForm } from '@/components/SubmissionUploadForm';

export default function DashboardPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showUpload, setShowUpload] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const data = await listSubmissions({ limit: 10 });
      setSubmissions(data.items);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUploadSuccess = (newSub: Submission) => {
    setSubmissions((prev) => [newSub, ...prev]);
    setShowUpload(false);
  };

  return (
    <div className="space-y-8">
      {/* Hero / Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Code Review & Evolution Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track Python code submissions, inspect static analysis findings, and compare revision history.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm"
          >
            {showUpload ? 'Close Upload Form' : '+ New Submission'}
          </button>
        </div>
      </div>

      {/* Conditionally reveal upload form */}
      {showUpload && (
        <div className="transition-all animate-fadeIn">
          <SubmissionUploadForm onSuccess={handleUploadSuccess} />
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Submissions
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {loading ? '...' : submissions.length}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {submissions.filter(s => s.submission_type === 'repository').length} repos ·{' '}
            {submissions.filter(s => s.submission_type === 'file').length} single files
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Analysis Engine
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">Ready</div>
          <p className="text-xs text-slate-400 mt-1">AST / Ruff / Radon / Bandit</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Ingestion Modes
          </div>
          <div className="text-2xl font-bold text-indigo-600 mt-2">3</div>
          <p className="text-xs text-slate-400 mt-1">.py file · .zip / .tar.gz · GitHub URL</p>
        </div>
      </div>

      {/* Recent Submissions List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Recent Submissions</h2>
          <Link
            href="/submissions"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading submissions...</div>
        ) : submissions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 text-lg font-bold">
              CO
            </div>
            <h3 className="text-sm font-semibold text-slate-900">No submissions yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Upload your first Python code submission to run static checks and build revision history.
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition"
            >
              Upload Python file
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-medium">
                <tr>
                  <th className="px-6 py-3">File / Title</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Size</th>
                  <th className="px-6 py-3">SHA-256</th>
                  <th className="px-6 py-3">Uploaded</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {submissions.map((sub) => (
                  <tr key={sub.submission_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <div className="font-semibold">{sub.original_filename}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                          sub.submission_type === 'repository'
                            ? 'bg-violet-50 border-violet-200 text-violet-700'
                            : 'bg-sky-50 border-sky-200 text-sky-700'
                        }`}>
                          {sub.submission_type === 'repository' ? '🗂 Repo' : '🐍 File'}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {sub.submission_id.substring(0, 8)}…
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-xs">
                      {sub.submission_type === 'repository'
                        ? `${sub.total_files} files (${sub.source_files_count} .py)`
                        : `${(sub.size_bytes / 1024).toFixed(1)} KB`}
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
