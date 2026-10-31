'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getSubmission, getRepositoryTree, getSubmissionSource } from '@/lib/api';
import { Submission, RepositoryTreeResponse } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { RepositoryFileBrowser } from '@/components/RepositoryFileBrowser';

export default function SubmissionDetailPage() {
  const params = useParams();
  const submissionId = params.id as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [repoTree, setRepoTree] = useState<RepositoryTreeResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [sourceCode, setSourceCode] = useState<string>('');
  const [loadingSource, setLoadingSource] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Initial load
  useEffect(() => {
    if (!submissionId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const sub = await getSubmission(submissionId);
        setSubmission(sub);

        const tree = await getRepositoryTree(submissionId);
        setRepoTree(tree);

        // Preload first python file or the only file
        const defaultFile = tree.source_files[0] ?? tree.tree[0]?.path ?? null;
        if (defaultFile) {
          setSelectedFile(defaultFile);
          const code = await getSubmissionSource(submissionId, tree.is_directory ? defaultFile : undefined);
          setSourceCode(code);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load submission.');
      } finally {
        setLoading(false);
      }
    })();
  }, [submissionId]);

  // Load a different file when selected from tree
  const handleSelectFile = async (path: string) => {
    if (path === selectedFile || !repoTree?.is_directory) return;
    setSelectedFile(path);
    setLoadingSource(true);
    try {
      const code = await getSubmissionSource(submissionId, path);
      setSourceCode(code);
    } catch (err: any) {
      setSourceCode(`# Error loading file: ${err.message}`);
    } finally {
      setLoadingSource(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(sourceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading submission…</div>;

  if (error || !submission) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-rose-700">
        <h2 className="text-lg font-semibold">Error</h2>
        <p className="text-sm mt-1">{error || 'Submission not found.'}</p>
        <Link href="/submissions" className="mt-4 inline-block text-xs font-medium text-indigo-600 hover:underline">← Back</Link>
      </div>
    );
  }

  const isRepo = submission.submission_type === 'repository';
  const lines = sourceCode.split('\n');

  return (
    <div className="space-y-5">

      {/* Breadcrumb + Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/submissions" className="hover:text-indigo-600">Submissions</Link>
            <span>/</span>
            <span className="font-mono text-slate-600">{submission.submission_id.slice(0, 8)}…</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3 flex-wrap">
            <span>{submission.original_filename}</span>
            <StatusBadge status={submission.status} />
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
              isRepo
                ? 'bg-violet-50 border-violet-200 text-violet-700'
                : 'bg-sky-50 border-sky-200 text-sky-700'
            }`}>
              {isRepo ? '🗂 Repository' : '🐍 Single File'}
            </span>
          </h1>
        </div>
        <Link
          href={`/compare?base=${submission.submission_id}`}
          className="self-start px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
        >
          Compare Revision
        </Link>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Submission ID', value: submission.submission_id, mono: true },
          { label: 'Project ID', value: submission.project_id, mono: true },
          {
            label: isRepo ? 'Total Files' : 'File Size',
            value: isRepo ? `${submission.total_files} files (${submission.source_files_count} .py)` : `${(submission.size_bytes / 1024).toFixed(1)} KB`,
          },
          { label: 'SHA-256', value: submission.source_sha256.slice(0, 12) + '…', mono: true },
        ].map(({ label, value, mono }) => (
          <div key={label} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
            <div className={`text-xs text-slate-800 break-all ${mono ? 'font-mono' : ''}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Main content: tree + code viewer */}
      <div className={`grid gap-4 ${isRepo ? 'grid-cols-1 lg:grid-cols-[260px_1fr]' : 'grid-cols-1'}`}>

        {/* File Browser (repository only) */}
        {isRepo && repoTree && (
          <RepositoryFileBrowser
            tree={repoTree.tree}
            sourceFiles={repoTree.source_files}
            selectedPath={selectedFile}
            onSelectFile={handleSelectFile}
          />
        )}

        {/* Code Viewer */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
              <span className="text-xs font-mono text-slate-600 truncate">
                {selectedFile ?? submission.original_filename}
              </span>
              {loadingSource && <span className="text-xs text-slate-400 animate-pulse">Loading…</span>}
            </div>
            <button
              onClick={handleCopy}
              disabled={!sourceCode || loadingSource}
              className="text-xs text-slate-500 hover:text-indigo-600 px-2 py-1 border border-slate-200 bg-white rounded shadow-sm transition shrink-0"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          <div className="overflow-auto p-4 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed max-h-[600px]">
            {sourceCode ? (
              <table className="w-full border-collapse">
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50">
                      <td className="pr-4 select-none text-slate-500 text-right w-10 align-top text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="pl-2 whitespace-pre text-slate-200">{line || ' '}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-slate-500 italic text-xs">Select a file from the tree to view its source.</p>
            )}
          </div>
        </div>
      </div>

      {/* Phase 3 callout */}
      <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-4">
        <div className="p-1.5 bg-indigo-600 text-white rounded font-bold text-xs shrink-0">P3</div>
        <div>
          <h3 className="text-sm font-semibold text-indigo-900">Static Analysis Pipeline — Phase 3</h3>
          <p className="text-xs text-indigo-700 mt-0.5">
            {isRepo
              ? `Repository ingested with ${submission.total_files} files (${submission.source_files_count} Python sources). The analysis adapter will traverse all .py files and produce unified findings in Phase 3.`
              : 'Source safely stored with SHA-256 integrity verified. AST, Ruff, Radon, and Bandit adapters will run against this file in Phase 3.'}
          </p>
        </div>
      </div>
    </div>
  );
}
