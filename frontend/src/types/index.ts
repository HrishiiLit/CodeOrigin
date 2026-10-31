export type SubmissionStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type SubmissionType = 'file' | 'repository';

export interface FileTreeNode {
  path: string;
  name: string;
  size_bytes: number;
  extension: string;
  is_source: boolean;
  is_python?: boolean;
}

export interface RepositoryTreeResponse {
  is_directory: boolean;
  root_name: string;
  total_files: number;
  source_files_count: number;
  tree: FileTreeNode[];
  source_files: string[];
}

export interface Submission {
  submission_id: string;
  project_id: string;
  owner_id: string;
  parent_submission_id: string | null;
  original_filename: string;
  submission_type: SubmissionType;
  language: string;
  source_sha256: string;
  size_bytes: number;
  total_files: number;
  source_files_count: number;
  source_files: string[];
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

export interface GitHubIngestPayload {
  repo_url: string;
  ref?: string;
  project_id?: string;
  display_name?: string;
}
