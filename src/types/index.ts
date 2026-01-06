// API Key types
export interface ApiKey {
  id: string;
  name: string;
  key_hash: string;
  scope: 'full' | 'read' | 'write';
  rate_limit: number;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

// Note types
export interface Note {
  id: string;
  content: string;
  project: string | null;
  tags: string | null;
  source: string;
  created_at: string;
  updated_at: string | null;
}

export interface CreateNoteInput {
  content: string;
  project?: string;
  tags?: string[];
  source?: string;
}

export interface NoteListQuery {
  project?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

// Artifact types
export interface Artifact {
  id: string;
  title: string;
  content: string;
  content_type: 'code' | 'markdown' | 'json';
  language: string | null;
  project: string | null;
  source: string;
  created_at: string;
  updated_at: string | null;
}

export interface CreateArtifactInput {
  title: string;
  content: string;
  content_type: 'code' | 'markdown' | 'json';
  language?: string;
  project?: string;
  source?: string;
}

export interface UpdateArtifactInput {
  title?: string;
  content?: string;
  content_type?: 'code' | 'markdown' | 'json';
  language?: string;
  project?: string;
}

// Context types
export interface ProjectContext {
  id: string;
  project: string;
  summary: string | null;
  tech_stack: string | null;
  conventions: string | null;
  updated_at: string;
}

export interface UpdateContextInput {
  summary?: string;
  tech_stack?: string[];
  conventions?: string;
}

// Task types
export type TaskStatus = 'queued' | 'active' | 'completed' | 'cancelled';
export type TrustLevel = 'THROWAWAY' | 'PROTOTYPE' | 'MATURE';
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  project: string;
  status: TaskStatus;
  trust_level: TrustLevel;
  priority: Priority;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  project: string;
  trust_level?: TrustLevel;
  priority?: Priority;
}

// Search types
export interface SearchResult {
  type: 'note' | 'artifact' | 'task';
  id: string;
  snippet: string;
  score: number;
  project?: string | null;
}

export interface SearchQuery {
  q: string;
  types?: ('notes' | 'artifacts' | 'tasks')[];
  project?: string;
  limit?: number;
}

// Audit log types
export interface AuditLogEntry {
  id: number;
  timestamp: string;
  api_key_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  status_code: number;
}

// Fastify extensions
declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: ApiKey;
  }
}

// Response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ErrorResponse {
  error: string;
  details?: string;
}
