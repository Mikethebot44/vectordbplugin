import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

/**
 * Options for semantic search operations
 */
export interface SemanticSearchOptions {
  /** Maximum number of results to return (default: 5) */
  topK?: number;
  /** Minimum similarity threshold for results (default: 0.7) */
  threshold?: number;
}

/**
 * Result of a semantic search operation
 */
export interface SemanticSearchResult {
  /** Search results data, or null if error occurred */
  data: any[] | null;
  /** Error object, or null if successful */
  error: Error | null;
}

/**
 * Main class for Supabase Semantic Search functionality
 * 
 * Provides easy-to-use semantic search capabilities with automatic embedding generation
 * using OpenAI's text-embedding-3-small model and Supabase's pgvector extension.
 */
export class SupabaseSemanticSearch {
  private supabase: SupabaseClient;
  private openai: OpenAI;

  /**
   * Create a new SupabaseSemanticSearch instance
   * 
   * @param supabaseUrl - Your Supabase project URL
   * @param supabaseKey - Your Supabase project API key (anon or service_role)
   * @param openaiApiKey - Your OpenAI API key for generating embeddings
   * 
   * @example
   * ```typescript
   * const semanticSearch = new SupabaseSemanticSearch(
   *   'https://your-project.supabase.co',
   *   'your-anon-key',
   *   'sk-your-openai-key'
   * );
   * ```
   */
  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    openaiApiKey: string
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  /**
   * Perform semantic search on any table with embedding support
   * 
   * @param table - Name of the table to search in
   * @param query - Natural language search query
   * @param options - Search options (topK, threshold)
   * @returns Promise with search results or error
   * 
   * @example
   * ```typescript
   * const results = await semanticSearch.semanticSearch('documents', 'machine learning', {
   *   topK: 10,
   *   threshold: 0.8
   * });
   * 
   * if (results.error) {
   *   console.error('Search failed:', results.error);
   * } else {
   *   console.log('Found documents:', results.data);
   * }
   * ```
   */
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

  /**
   * Convenience method for searching documents table specifically
   * 
   * @param query - Natural language search query
   * @param options - Search options (topK, threshold)
   * @returns Promise with document search results or error
   * 
   * @example
   * ```typescript
   * const results = await semanticSearch.searchDocuments('contract renewal');
   * 
   * if (!results.error) {
   *   results.data?.forEach(doc => {
   *     console.log(`${doc.title}: ${doc.similarity.toFixed(3)}`);
   *   });
   * }
   * ```
   */
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

  /**
   * Register a table column for automatic embedding generation
   * 
   * This sets up the necessary database triggers and indexes for automatic
   * embedding generation when the specified column is updated.
   * 
   * @param tableName - Name of the table to register
   * @param columnName - Name of the text column to embed
   * @param model - Embedding model to use (default: 'openai/text-embedding-3-small')
   * @returns Promise with error if registration failed
   * 
   * @example
   * ```typescript
   * const result = await semanticSearch.registerEmbedding('articles', 'content');
   * 
   * if (result.error) {
   *   console.error('Registration failed:', result.error);
   * } else {
   *   console.log('Embedding registration successful!');
   * }
   * ```
   */
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

  /**
   * Get the underlying Supabase client for direct database operations
   * 
   * @returns The Supabase client instance used by this semantic search instance
   * 
   * @example
   * ```typescript
   * const supabase = semanticSearch.getSupabaseClient();
   * const { data } = await supabase.from('documents').select('*');
   * ```
   */
  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }
}

/**
 * Convenience function to create a new SupabaseSemanticSearch instance
 * 
 * @param supabaseUrl - Your Supabase project URL
 * @param supabaseKey - Your Supabase project API key
 * @param openaiApiKey - Your OpenAI API key for generating embeddings
 * @returns A new SupabaseSemanticSearch instance
 * 
 * @example
 * ```typescript
 * import { createSemanticSearch } from 'supabase-semantic-search';
 * 
 * const semanticSearch = createSemanticSearch(
 *   process.env.SUPABASE_URL!,
 *   process.env.SUPABASE_ANON_KEY!,
 *   process.env.OPENAI_API_KEY!
 * );
 * 
 * // Search documents
 * const results = await semanticSearch.searchDocuments('AI research papers');
 * ```
 */
export function createSemanticSearch(
  supabaseUrl: string,
  supabaseKey: string,
  openaiApiKey: string
): SupabaseSemanticSearch {
  return new SupabaseSemanticSearch(supabaseUrl, supabaseKey, openaiApiKey);
}

export default SupabaseSemanticSearch;