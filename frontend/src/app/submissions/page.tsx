'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { listSubmissions } from '@/lib/api';
import { Submission } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { SubmissionUploadForm } from '@/components/SubmissionUploadForm';
import {
  FileCode2,
  FolderArchive,
  Search,
  Filter,
  Plus,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  ExternalLink,
} from 'lucide-react';

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showUpload, setShowUpload] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

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
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [statusFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSubmissions();
  };

  const filteredSubmissions = submissions.filter((sub) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      sub.original_filename.toLowerCase().includes(q) ||
      sub.submission_id.toLowerCase().includes(q) ||
      sub.project_id.toLowerCase().includes(q) ||
      sub.owner_id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Code Submissions Vault
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Browse registered Python programs, whole repository archives, and revision lineage.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition border border-slate-200/80"
            title="Refresh submissions"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-indigo-600/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{showUpload ? 'Close Form' : 'New Submission'}</span>
          </button>
        </div>
      </div>

      {/* Conditionally reveal upload form */}
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
            <span className="font-bold">Connection Error:</span>
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

      {/* Search & Filter Toolbar */}
      <div className="glass-panel p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by filename, title, or UUID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Status:
            </span>
            {['', 'queued', 'processing', 'completed', 'failed'].map((st) => {
              const label = st === '' ? 'All' : st.charAt(0).toUpperCase() + st.slice(1);
              const isSelected = statusFilter === st;
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Showing <strong className="text-slate-800">{filteredSubmissions.length}</strong> of {submissions.length} submissions
          </span>
          {(statusFilter || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('');
                setSearchQuery('');
              }}
              className="text-xs text-indigo-600 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Submissions Table / Grid */}
      <div className="glass-panel rounded-2xl shadow-sm overflow-hidden border border-slate-200/80">
        {loading ? (
          <div className="p-16 text-center text-sm text-slate-500 flex flex-col items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading submissions…</span>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="p-16 text-center text-sm text-slate-500 flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
            <div className="text-3xl">📂</div>
            <p className="font-bold text-slate-800 text-base">No matching submissions</p>
            <p className="text-xs text-slate-400">
              {statusFilter || searchQuery
                ? 'No submissions matched your active search query or status filter.'
                : 'Upload a Python script or repository archive to get started.'}
            </p>
            {statusFilter || searchQuery ? (
              <button
                onClick={() => {
                  setStatusFilter('');
                  setSearchQuery('');
                }}
                className="mt-2 text-xs font-semibold text-indigo-600 hover:underline"
              >
                Clear all filters
              </button>
            ) : (
              <button
                onClick={() => setShowUpload(true)}
                className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition"
              >
                + Create Submission
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50/70 text-slate-500 text-[11px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">File / Title</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Size</th>
                  <th className="px-6 py-3.5">SHA-256 Digest</th>
                  <th className="px-6 py-3.5">Submitted</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredSubmissions.map((sub) => {
                  const isRepo = sub.submission_type === 'repository';
                  return (
                    <tr
                      key={sub.submission_id}
                      className="hover:bg-indigo-50/30 transition-colors group"
                    >
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`p-1.5 rounded-lg shrink-0 ${
                              isRepo ? 'bg-purple-50 text-purple-600' : 'bg-indigo-50 text-indigo-600'
                            }`}
                          >
                            {isRepo ? <FolderArchive className="w-4 h-4" /> : <FileCode2 className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {sub.original_filename}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                              {sub.submission_id.slice(0, 8)}…
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                            isRepo ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {isRepo ? 'Repo Archive' : 'Single .py'}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge status={sub.status} />
                      </td>

                      <td className="px-6 py-4 text-xs font-mono text-slate-600">
                        {isRepo
                          ? `${sub.total_files} files (${sub.source_files_count} py)`
                          : `${(sub.size_bytes / 1024).toFixed(1)} KB`}
                      </td>

                      <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                        {sub.source_sha256.substring(0, 10)}…
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(sub.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/submissions/${sub.submission_id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
