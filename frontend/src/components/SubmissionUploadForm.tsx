'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadSubmission, ingestFromGitHub, ApiClientError } from '@/lib/api';
import { Submission } from '@/types';

type SubmitMode = 'file' | 'github';

const ACCEPTED_EXTENSIONS = '.py,.zip,.tar.gz,.tgz,.tar';
const MAX_SIZE_MB = 50;
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface SubmissionUploadFormProps {
  onSuccess?: (submission: Submission) => void;
}

export const SubmissionUploadForm: React.FC<SubmissionUploadFormProps> = ({ onSuccess }) => {
  const router = useRouter();
  const [mode, setMode] = useState<SubmitMode>('file');

  /* --- shared state --- */
  const [displayName, setDisplayName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [parentSubmissionId, setParentSubmissionId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<{ message: string; code: string } | null>(null);

  /* --- file-upload state --- */
  const [file, setFile] = useState<File | null>(null);

  /* --- github state --- */
  const [repoUrl, setRepoUrl] = useState('');
  const [ref, setRef] = useState('');

  const resetErrors = () => { setValidationError(null); setServerError(null); };

  /* ----------- file picker ----------- */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    resetErrors();
    const selected = e.target.files?.[0] ?? null;
    if (!selected) { setFile(null); return; }

    const name = selected.name.toLowerCase();
    const allowed = ['.py', '.zip', '.tar.gz', '.tgz', '.tar'];
    const isAllowed = allowed.some(ext => name.endsWith(ext));
    if (!isAllowed) {
      setValidationError('Only .py source files or .zip / .tar.gz repository archives are supported.');
      setFile(null);
      return;
    }
    if (selected.size === 0) { setValidationError('File cannot be empty.'); setFile(null); return; }
    if (selected.size > MAX_BYTES) {
      setValidationError(`File size exceeds the ${MAX_SIZE_MB} MB upload limit.`);
      setFile(null);
      return;
    }
    setFile(selected);
    if (!displayName) setDisplayName(selected.name);
  };

  /* ----------- submit ----------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetErrors();

    if (mode === 'file' && !file) {
      setValidationError('Please select a file to upload.');
      return;
    }
    if (mode === 'github') {
      if (!repoUrl.trim()) { setValidationError('Please enter a GitHub repository URL.'); return; }
      const looksLikeGH = /^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/i.test(repoUrl.trim());
      if (!looksLikeGH) {
        setValidationError('URL must point to a GitHub repository (https://github.com/owner/repo).');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let result: Submission;

      if (mode === 'file') {
        const formData = new FormData();
        formData.append('file', file!);
        if (displayName) formData.append('display_name', displayName);
        if (projectId.trim()) formData.append('project_id', projectId.trim());
        if (parentSubmissionId.trim()) formData.append('parent_submission_id', parentSubmissionId.trim());
        result = await uploadSubmission(formData);
      } else {
        result = await ingestFromGitHub({
          repo_url: repoUrl.trim(),
          ref: ref.trim() || undefined,
          project_id: projectId.trim() || undefined,
          display_name: displayName || undefined,
        });
      }

      if (onSuccess) onSuccess(result);
      else router.push(`/submissions/${result.submission_id}`);
    } catch (err: any) {
      const msg = err instanceof ApiClientError
        ? { message: err.message, code: err.code }
        : { message: err.message || 'Unexpected error.', code: 'CLIENT_ERROR' };
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">New Submission</h3>
        <p className="text-sm text-slate-500 mt-0.5">
          Submit a single Python file, a repository archive (.zip / .tar.gz), or fetch directly from GitHub.
        </p>
      </div>

      {/* ---- Mode Tabs ---- */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit">
        {(['file', 'github'] as SubmitMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); resetErrors(); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              mode === m
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {m === 'file' ? '📁 Upload File / Archive' : '🐙 GitHub Repository'}
          </button>
        ))}
      </div>

      {/* ---- Validation / Server Errors ---- */}
      {validationError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
          {validationError}
        </div>
      )}
      {serverError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
          <span className="font-semibold">{serverError.code}: </span>{serverError.message}
        </div>
      )}

      {/* ---- File Upload Mode ---- */}
      {mode === 'file' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Source File or Repository Archive <span className="text-rose-500">*</span>
          </label>
          <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-dashed border-slate-300 rounded-lg hover:border-indigo-400 transition-colors bg-slate-50">
            <div className="space-y-1 text-center">
              <p className="text-sm text-slate-600">
                <label htmlFor="file-upload" className="cursor-pointer font-medium text-indigo-600 hover:text-indigo-500 px-2 py-1 border border-slate-200 bg-white rounded shadow-sm">
                  Select file
                  <input
                    id="file-upload"
                    type="file"
                    accept={ACCEPTED_EXTENSIONS}
                    className="sr-only"
                    onChange={handleFileChange}
                    disabled={isSubmitting}
                  />
                </label>
                <span className="pl-2">or drag and drop</span>
              </p>
              <p className="text-xs text-slate-400">
                .py (single file) · .zip or .tar.gz (full repo) · up to {MAX_SIZE_MB} MB
              </p>
              {file && (
                <p className="text-xs font-mono text-indigo-700 bg-indigo-50 px-2 py-1 rounded inline-block mt-1">
                  {file.name} &nbsp;({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- GitHub Mode ---- */}
      {mode === 'github' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              GitHub Repository URL <span className="text-rose-500">*</span>
            </label>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Branch / Tag / Commit SHA <span className="text-xs text-slate-400 font-normal">(optional, defaults to HEAD)</span>
            </label>
            <input
              type="text"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="e.g. main, v1.0.0, abc1234"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isSubmitting}
            />
          </div>
        </div>
      )}

      {/* ---- Shared Optional Fields ---- */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Data Structures Assignment 1"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={isSubmitting}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Project ID <span className="text-xs text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="Auto-generated if blank"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Parent Submission ID <span className="text-xs text-slate-400 font-normal">(for revisions)</span>
          </label>
          <input
            type="text"
            value={parentSubmissionId}
            onChange={(e) => setParentSubmissionId(e.target.value)}
            placeholder="UUID of base version"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting || (mode === 'file' && !file)}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all shadow-sm ${
            isSubmitting || (mode === 'file' && !file)
              ? 'bg-slate-300 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]'
          }`}
        >
          {isSubmitting
            ? mode === 'github' ? 'Fetching from GitHub…' : 'Uploading…'
            : mode === 'github' ? '🐙 Fetch & Register Repository' : 'Upload Submission'}
        </button>
      </div>
    </form>
  );
};
