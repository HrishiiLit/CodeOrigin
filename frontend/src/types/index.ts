export type SubmissionStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface Submission {
  submission_id: string;
  project_id: string;
  owner_id: string;
  parent_submission_id: string | null;
  original_filename: string;
  language: string;
  source_sha256: string;
  size_bytes: number;
  status: SubmissionStatus;
  error_details: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmissionListResponse {
  total: number;
  items: Submission[];
}

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  version: string;
  timestamp: string;
  services: {
    api: 'up' | 'down';
    database: 'up' | 'down';
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
    request_id: string;
  };
}
