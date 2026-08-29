import { v4 as uuidv4 } from "uuid";
import {
  Bookmark,
  Citation,
  Conversation,
  DocumentItem,
  Message,
  RetrievedChunk,
} from "./types";
import { SEED_DOCS } from "./seed_knowledge";

export interface StoredChunk {
  id: string;
  document_id: string;
  title: string;
  domain: string;
  source: string;
  language: string;
  text: string;
  chunk_index: number;
}

// In-memory data store with initial seed knowledge
class DatabaseStore {
  public conversations: Map<string, Conversation> = new Map();
  public messages: Map<string, Message[]> = new Map(); // conversation_id -> messages
  public documents: Map<string, DocumentItem> = new Map();
  public chunks: StoredChunk[] = [];
  public bookmarks: Map<string, Bookmark> = new Map();

  constructor() {
    this.seedInitialKnowledge();
  }

  public chunkText(text: string, size = 900, overlap = 140): string[] {
    const cleanText = text.split(/\s+/).join(" ").trim();
    if (!cleanText) return [];
    const chunks: string[] = [];
    let start = 0;
    while (start < cleanText.length) {
      const end = Math.min(cleanText.length, start + size);
      chunks.push(cleanText.slice(start, end));
      if (end === cleanText.length) break;
      start = end - overlap;
    }
    return chunks;
  }

  public seedInitialKnowledge() {
    if (this.documents.size > 0) return;

    for (const doc of SEED_DOCS) {
      const docId = uuidv4();
      const chunks = this.chunkText(doc.text);

      const docItem: DocumentItem = {
        id: docId,
        title: doc.title,
        domain: doc.domain,
        source: doc.source,
        language: "en",
        chunk_count: chunks.length,
        origin: "seed",
        created_at: new Date().toISOString(),
      };

      this.documents.set(docId, docItem);

      chunks.forEach((chunkText, idx) => {
        this.chunks.push({
          id: `${docId}-${idx}`,
          document_id: docId,
          title: doc.title,
          domain: doc.domain,
          source: doc.source,
          language: "en",
          text: chunkText,
          chunk_index: idx,
        });
      });
    }
  }

  // Conversation operations
  public async createConversation(title: string, language = "en"): Promise<Conversation> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const conv: Conversation = {
      id,
      title: title.slice(0, 60),
      language,
      created_at: now,
      updated_at: now,
    };
    this.conversations.set(id, conv);
    this.messages.set(id, []);
    return conv;
  }

  public async getConversation(id: string): Promise<Conversation | null> {
    return this.conversations.get(id) || null;
  }

  public async listConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }

  public async touchConversation(id: string, title?: string): Promise<void> {
    const conv = this.conversations.get(id);
    if (conv) {
      conv.updated_at = new Date().toISOString();
      if (title) conv.title = title.slice(0, 60);
    }
  }

  public async deleteConversation(id: string): Promise<void> {
    this.conversations.delete(id);
    this.messages.delete(id);
  }

  // Message operations
  public async addMessage(msg: Partial<Message> & { conversation_id: string; role: "user" | "assistant"; content: string }): Promise<Message> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const fullMsg: Message = {
      id,
      conversation_id: msg.conversation_id,
      role: msg.role,
      content: msg.content,
      language: msg.language || "en",
      confidence: msg.confidence,
      grounded: msg.grounded,
      citations: msg.citations || [],
      created_at: now,
    };

    const list = this.messages.get(msg.conversation_id) || [];
    list.push(fullMsg);
    this.messages.set(msg.conversation_id, list);
    return fullMsg;
  }

  public async listMessages(conversationId: string): Promise<Message[]> {
    return this.messages.get(conversationId) || [];
  }

  public async searchMessages(query: string): Promise<any[]> {
    const q = query.toLowerCase();
    const results: any[] = [];
    for (const [convId, msgs] of this.messages.entries()) {
      const conv = this.conversations.get(convId);
      for (const m of msgs) {
        if (m.content.toLowerCase().includes(q)) {
          results.push({
            id: m.id,
            conversation_id: m.conversation_id,
            role: m.role,
            content: m.content,
            created_at: m.created_at,
            title: conv?.title || "Conversation",
          });
        }
      }
    }
    return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50);
  }

  // Document operations
  public async listDocuments(domain?: string): Promise<DocumentItem[]> {
    const all = Array.from(this.documents.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (domain) {
      return all.filter((d) => d.domain.toLowerCase() === domain.toLowerCase());
    }
    return all;
  }

  public async getDocument(id: string): Promise<DocumentItem | null> {
    return this.documents.get(id) || null;
  }

  public async addDocument(
    title: string,
    domain: string,
    text: string,
    source?: string,
    language = "en",
    origin: "seed" | "upload" = "upload"
  ): Promise<DocumentItem> {
    const docId = uuidv4();
    const chunks = this.chunkText(text);

    const doc: DocumentItem = {
      id: docId,
      title,
      domain,
      source: source || title,
      language,
      chunk_count: chunks.length,
      origin,
      created_at: new Date().toISOString(),
    };

    this.documents.set(docId, doc);

    chunks.forEach((chunkText, idx) => {
      this.chunks.push({
        id: `${docId}-${idx}`,
        document_id: docId,
        title,
        domain,
        source: source || title,
        language,
        text: chunkText,
        chunk_index: idx,
      });
    });

    return doc;
  }

  public async deleteDocument(docId: string): Promise<void> {
    this.documents.delete(docId);
    this.chunks = this.chunks.filter((c) => c.document_id !== docId);
  }

  public async domainCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const doc of this.documents.values()) {
      counts[doc.domain] = (counts[doc.domain] || 0) + 1;
    }
    return counts;
  }

  public async documentCount(): Promise<number> {
    return this.documents.size;
  }

  public vectorCount(): number {
    return this.chunks.length;
  }

  // Bookmarks
  public async addBookmark(bm: {
    message_id: string;
    conversation_id: string;
    note?: string;
    content?: string;
  }): Promise<Bookmark> {
    const id = uuidv4();
    const fullBm: Bookmark = {
      id,
      message_id: bm.message_id,
      conversation_id: bm.conversation_id,
      note: bm.note,
      content: bm.content,
      created_at: new Date().toISOString(),
    };
    this.bookmarks.set(id, fullBm);
    return fullBm;
  }

  public async listBookmarks(): Promise<Bookmark[]> {
    return Array.from(this.bookmarks.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public async deleteBookmark(id: string): Promise<void> {
    this.bookmarks.delete(id);
  }
}

export const db = new DatabaseStore();
