'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadSubmission, ApiClientError } from '@/lib/api';
import { Submission } from '@/types';

interface SubmissionUploadFormProps {
  onSuccess?: (submission: Submission) => void;
}

export const SubmissionUploadForm: React.FC<SubmissionUploadFormProps> = ({ onSuccess }) => {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [parentSubmissionId, setParentSubmissionId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<{ message: string; code: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    setServerError(null);

    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      setFile(null);
      return;
    }

    // Client-side validation: extension
    if (!selectedFile.name.endsWith('.py')) {
      setValidationError('Only Python source files (.py) are permitted.');
      setFile(null);
      return;
    }

    // Client-side validation: size (5MB max)
    const MAX_BYTES = 5 * 1024 * 1024;
    if (selectedFile.size > MAX_BYTES) {
      setValidationError('File size exceeds the 5 MB upload limit.');
      setFile(null);
      return;
    }

    // Client-side validation: empty file
    if (selectedFile.size === 0) {
      setValidationError('Uploaded file cannot be 0 bytes.');
      setFile(null);
      return;
    }

    setFile(selectedFile);
    if (!displayName) {
      setDisplayName(selectedFile.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setValidationError('Please select a valid Python (.py) file.');
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);
    setServerError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (displayName) formData.append('display_name', displayName);
      if (projectId.trim()) formData.append('project_id', projectId.trim());
      if (parentSubmissionId.trim()) formData.append('parent_submission_id', parentSubmissionId.trim());

      const result = await uploadSubmission(formData);

      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(`/submissions/${result.submission_id}`);
      }
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setServerError({ message: err.message, code: err.code });
      } else {
        setServerError({ message: err.message || 'An unexpected error occurred.', code: 'CLIENT_ERROR' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900 mb-1">Upload Python Submission</h3>
      <p className="text-sm text-slate-500 mb-6">
        Submit a Python (.py) source file for static analysis, metrics tracking, and revision comparison.
      </p>

      {validationError && (
        <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700 flex items-start gap-2">
          <span className="font-bold">Error:</span> {validationError}
        </div>
      )}

      {serverError && (
        <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
          <div className="font-semibold text-rose-800">Upload Failed ({serverError.code})</div>
          <p className="mt-0.5">{serverError.message}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* File Input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Python Source File <span className="text-rose-500">*</span>
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg hover:border-indigo-400 transition-colors bg-slate-50">
            <div className="space-y-1 text-center">
              <div className="text-sm text-slate-600">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none px-2 py-1 border border-slate-200 shadow-sm"
                >
                  <span>Select Python file</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    accept=".py"
                    className="sr-only"
                    onChange={handleFileChange}
                    disabled={isSubmitting}
                  />
                </label>
                <span className="pl-2">or drag and drop</span>
              </div>
              <p className="text-xs text-slate-500">Only .py files up to 5 MB</p>
              {file && (
                <div className="mt-2 text-xs font-mono font-medium text-indigo-700 bg-indigo-50 py-1 px-3 rounded inline-block">
                  Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Display Title */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Display Title / Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Solution Assignment 1"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isSubmitting}
          />
        </div>

        {/* Optional Project ID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Project ID <span className="text-xs text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="Leave blank to auto-generate"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Parent Submission ID <span className="text-xs text-slate-400 font-normal">(For Revisions)</span>
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
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={!file || isSubmitting}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all shadow-sm ${
            !file || isSubmitting
              ? 'bg-slate-300 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]'
          }`}
        >
          {isSubmitting ? 'Uploading & Registering...' : 'Upload Submission'}
        </button>
      </div>
    </form>
  );
};
