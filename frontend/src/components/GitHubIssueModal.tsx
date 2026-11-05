'use client';

import React, { useEffect, useState } from 'react';
import { prepareIssueDraft, createGitHubIssue } from '@/lib/api';
import { CreateIssueResponse, IssueDraftResponse } from '@/types';
import { AlertCircle, CheckCircle2, ExternalLink, Github, Loader2, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface GitHubIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissionId: string;
  selectedFindingIds: string[];
  defaultRepo?: string;
  onSuccess?: (issue: CreateIssueResponse) => void;
}

export function GitHubIssueModal({
  isOpen,
  onClose,
  submissionId,
  selectedFindingIds,
  defaultRepo,
  onSuccess,
}: GitHubIssueModalProps) {
  const { user } = useAuth();
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [repository, setRepository] = useState(defaultRepo || '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdIssue, setCreatedIssue] = useState<CreateIssueResponse | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCreatedIssue(null);
      setErrorMsg(null);
      setConfirmed(false);
      return;
    }

    (async () => {
      setLoadingDraft(true);
      setErrorMsg(null);
      try {
        const draft = await prepareIssueDraft({
          submission_id: submissionId,
          finding_ids: selectedFindingIds,
          repository_url: defaultRepo || undefined,
        });
        setRepository(draft.repository);
        setTitle(draft.title);
        setBody(draft.body);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to prepare issue draft from findings.');
      } finally {
        setLoadingDraft(false);
      }
    })();
  }, [isOpen, submissionId, selectedFindingIds, defaultRepo]);

  if (!isOpen) return null;

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      setErrorMsg('Explicit approval is required before submitting to GitHub.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const result = await createGitHubIssue(
        {
          submission_id: submissionId,
          repository,
          title,
          body,
          confirmed: true,
          finding_ids: selectedFindingIds,
        },
        user?.user_id || 'demo-faculty'
      );
      setCreatedIssue(result);
      if (onSuccess) onSuccess(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create GitHub issue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-slate-800 rounded-lg text-white">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Create GitHub Issue (Phase 7)</h3>
              <p className="text-[11px] text-slate-400">
                Export selected findings to GitHub with deliberate reviewer approval
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {loadingDraft ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Generating structured issue draft...</p>
            </div>
          ) : createdIssue ? (
            <div className="py-6 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">Issue Successfully Created!</h4>
                <p className="text-xs text-slate-500">
                  Logged in audit trail. Verified and created under repository{' '}
                  <code className="text-indigo-600 font-mono font-medium">{createdIssue.repository}</code>
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl max-w-md mx-auto text-left space-y-2">
                <div className="text-[11px] text-slate-500">Issue Number: #{createdIssue.issue_number}</div>
                <div className="text-xs font-semibold text-slate-800">{createdIssue.title}</div>
                <div className="pt-2">
                  <a
                    href={createdIssue.issue_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition"
                  >
                    View on GitHub
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateIssue} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{errorMsg}</div>
                </div>
              )}

              {/* Repository */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target GitHub Repository (owner/repo)
                </label>
                <input
                  type="text"
                  required
                  value={repository}
                  onChange={(e) => setRepository(e.target.value)}
                  placeholder="e.g. university-cs/assignment-1"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Markdown Body */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Issue Body (Markdown)</label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {selectedFindingIds.length} finding{selectedFindingIds.length === 1 ? '' : 's'} attached
                  </span>
                </div>
                <textarea
                  rows={8}
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-relaxed text-slate-800"
                />
              </div>

              {/* Explicit Approval Gate */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="text-xs font-medium text-amber-950 leading-relaxed">
                    <strong>Reviewer Approval Exit Gate:</strong> I explicitly confirm that I have inspected these
                    findings and authorize posting this issue to GitHub repository{' '}
                    <code className="text-indigo-700 font-mono font-bold">{repository || 'target repository'}</code>.
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!confirmed || submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {submitting ? 'Submitting to GitHub...' : 'Approve & Create Issue'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
