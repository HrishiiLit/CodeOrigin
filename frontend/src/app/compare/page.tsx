'use client';

import React from 'react';
import Link from 'next/link';

export default function ComparePage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Revision Comparison</h1>
        <p className="text-sm text-slate-500 mt-1">
          Compare code diffs and evolution metrics across student revisions.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm max-w-2xl mx-auto">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
          P4
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Phase 4: Revision Comparison Engine</h2>
        <p className="text-sm text-slate-600 mb-6">
          The comparison service will compute unified text diffs, lines added/removed, and evolutionary change summaries between base and target revisions.
        </p>
        <Link
          href="/submissions"
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm"
        >
          View Registered Submissions
        </Link>
      </div>
    </div>
  );
}
