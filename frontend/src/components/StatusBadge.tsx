import React from 'react';
import { SubmissionStatus } from '@/types';

interface StatusBadgeProps {
  status: SubmissionStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const configs: Record<SubmissionStatus, { label: string; bg: string; text: string; dot: string }> = {
    queued: {
      label: 'Queued',
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-700',
      dot: 'bg-amber-400',
    },
    processing: {
      label: 'Analyzing',
      bg: 'bg-indigo-50 border-indigo-200',
      text: 'text-indigo-700',
      dot: 'bg-indigo-500 animate-pulse',
    },
    completed: {
      label: 'Completed',
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
    },
    failed: {
      label: 'Failed',
      bg: 'bg-rose-50 border-rose-200',
      text: 'text-rose-700',
      dot: 'bg-rose-500',
    },
  };

  const config = configs[status] || configs.queued;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};
