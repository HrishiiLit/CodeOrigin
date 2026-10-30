'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getSubmission, getSubmissionSource } from '@/lib/api';
import { Submission } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';

export default function SubmissionDetailPage() {
  const params = useParams();
  const submissionId = params.id as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [sourceCode, setSourceCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!submissionId) return;

    const loadDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const subData = await getSubmission(submissionId);
        setSubmission(subData);

        const codeData = await getSubmissionSource(submissionId);
        setSourceCode(codeData);
      } catch (err: any) {
        setError(err.message || 'Failed to load submission details.');
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [submissionId]);

  const handleCopyCode = () => {
    if (!sourceCode) return;
    navigator.clipboard.writeText(sourceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-500 text-sm">
        Loading submission details...
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-rose-700">
        <h2 className="text-lg font-semibold">Error Loading Submission</h2>
        <p className="text-sm mt-1">{error || 'Submission was not found.'}</p>
        <Link
          href="/submissions"
          className="mt-4 inline-block px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 transition"
        >
          ← Back to Submissions
        </Link>
      </div>
    );
  }

  const lines = sourceCode.split('\n');

  return (
    <div className="space-y-6">
      {/* Header Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/submissions" className="hover:text-indigo-600 transition">
              Submissions
            </Link>
            <span>/</span>
            <span className="font-mono text-slate-600">{submission.submission_id.substring(0, 8)}...</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <span>{submission.original_filename}</span>
            <StatusBadge status={submission.status} />
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/compare?base=${submission.submission_id}`}
            className="px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
          >
            Compare Revision
          </Link>
        </div>
      </div>

      {/* Metadata Overview Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
          Submission Metadata
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 block mb-1">Submission UUID</span>
            <span className="font-mono font-medium text-slate-800 break-all">{submission.submission_id}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 block mb-1">Project ID</span>
            <span className="font-mono font-medium text-slate-800 break-all">{submission.project_id}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 block mb-1">SHA-256 Checksum</span>
            <span className="font-mono font-medium text-slate-800 break-all">{submission.source_sha256}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 block mb-1">Size & Date</span>
            <span className="font-medium text-slate-800 block">
              {(submission.size_bytes / 1024).toFixed(1)} KB ({submission.size_bytes} bytes)
            </span>
            <span className="text-slate-400 mt-0.5 block">
              {new Date(submission.created_at).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Source Code Viewer */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span className="text-xs font-mono font-medium text-slate-700">
              {submission.original_filename} ({lines.length} lines)
            </span>
          </div>
          <button
            onClick={handleCopyCode}
            className="text-xs font-medium text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 px-2.5 py-1 rounded transition shadow-sm"
          >
            {copied ? '✓ Copied' : 'Copy Code'}
          </button>
        </div>

        <div className="overflow-x-auto p-4 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed max-h-[600px] overflow-y-auto">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-slate-800/60">
                  <td className="pr-4 select-none text-slate-500 text-right w-10 text-[11px] align-top">
                    {idx + 1}
                  </td>
                  <td className="pl-2 whitespace-pre text-slate-200">
                    {line || ' '}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Static Analysis Placeholder Callout (Phase 3) */}
      <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-4">
        <div className="p-2 bg-indigo-600 text-white rounded-lg text-xs font-bold">
          P3
        </div>
        <div>
          <h3 className="text-sm font-semibold text-indigo-900">
            Static Analysis Pipeline Ready (Phase 3 Interface)
          </h3>
          <p className="text-xs text-indigo-700 mt-1">
            This submission is safely stored in non-executable storage with SHA-256 integrity verified. The analysis adapter interface is staged for AST checks, Ruff linting, Radon cyclomatic complexity, and Bandit security scans in Phase 3.
          </p>
        </div>
      </div>
    </div>
  );
}
