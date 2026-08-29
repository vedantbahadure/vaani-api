export interface Citation {
  n: number;
  document_id: string;
  title: string;
  domain: string;
  source?: string;
  snippet: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  language?: string;
  confidence?: number;
  grounded?: boolean;
  citations?: Citation[];
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  domain: string;
  source?: string;
  language?: string;
  chunk_count: number;
  origin: "seed" | "upload";
  created_at: string;
}

export interface Bookmark {
  id: string;
  message_id: string;
  conversation_id: string;
  note?: string;
  content?: string;
  created_at: string;
}

export interface RetrievedChunk {
  document_id: string;
  title: string;
  domain: string;
  source?: string;
  text: string;
  score: number;
  chunk_index: number;
}
