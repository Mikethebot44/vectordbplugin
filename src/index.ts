import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export interface SemanticSearchOptions {
  topK?: number;
  threshold?: number;
}

export interface SemanticSearchResult {
  data: any[] | null;
  error: Error | null;
}

export class SupabaseSemanticSearch {
  private supabase: SupabaseClient;
  private openai: OpenAI;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    openaiApiKey: string
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  async semanticSearch(
    table: string,
    query: string,
    options: SemanticSearchOptions = {}
  ): Promise<SemanticSearchResult> {
    const { topK = 5, threshold = 0.7 } = options;

    try {
      // Generate embedding for query
      const embeddingResponse = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });

      const queryEmbedding = embeddingResponse.data[0].embedding;

      // Perform semantic search
      const { data, error } = await this.supabase.rpc('semantic_search', {
        table_name: table,
        query_embedding: `[${queryEmbedding.join(',')}]`,
        k: topK,
      });

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      // Filter by similarity threshold
      const filteredData = data?.filter((item: any) => item.similarity >= threshold) || [];

      return { data: filteredData, error: null };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error : new Error('Unknown error occurred') 
      };
    }
  }

  async searchDocuments(
    query: string,
    options: SemanticSearchOptions = {}
  ): Promise<SemanticSearchResult> {
    const { topK = 5, threshold = 0.7 } = options;

    try {
      const embeddingResponse = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });

      const queryEmbedding = embeddingResponse.data[0].embedding;

      const { data, error } = await this.supabase.rpc('search_documents', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        k: topK,
      });

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      const filteredData = data?.filter((item: any) => item.similarity >= threshold) || [];

      return { data: filteredData, error: null };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error : new Error('Unknown error occurred') 
      };
    }
  }

  async registerEmbedding(
    tableName: string,
    columnName: string,
    model: string = 'openai/text-embedding-3-small'
  ): Promise<{ error: Error | null }> {
    try {
      const { error } = await this.supabase.rpc('register_embedding', {
        table_name: tableName,
        column_name: columnName,
        model: model,
      });

      if (error) {
        return { error: new Error(error.message) };
      }

      return { error: null };
    } catch (error) {
      return { 
        error: error instanceof Error ? error : new Error('Unknown error occurred') 
      };
    }
  }

  // Get the underlying Supabase client for direct access
  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }
}

// Convenience function for quick setup
export function createSemanticSearch(
  supabaseUrl: string,
  supabaseKey: string,
  openaiApiKey: string
): SupabaseSemanticSearch {
  return new SupabaseSemanticSearch(supabaseUrl, supabaseKey, openaiApiKey);
}

export default SupabaseSemanticSearch;