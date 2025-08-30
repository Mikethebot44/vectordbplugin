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
 * Score normalization methods for hybrid search
 */
export type ScoreNormalization = 'min-max' | 'z-score' | 'none';

/**
 * Options for hybrid search operations
 */
export interface HybridSearchOptions {
  /** Maximum number of results to return (default: 5) */
  topK?: number;
  /** Weight for BM25/full-text search score (default: 0.3) */
  alpha?: number;
  /** Weight for vector similarity score (default: 0.7) */
  beta?: number;
  /** Score normalization method (default: 'min-max') */
  normalization?: ScoreNormalization;
  /** Minimum hybrid score threshold for results (default: 0.1) */
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
 * Result of a hybrid search operation
 */
export interface HybridSearchResult {
  /** Search results data with hybrid scores, or null if error occurred */
  data: HybridSearchResultItem[] | null;
  /** Error object, or null if successful */
  error: Error | null;
}

/**
 * Individual result item from hybrid search
 */
export interface HybridSearchResultItem {
  /** The original data from the matched row */
  [key: string]: any;
  /** Combined hybrid score (alpha * bm25_score + beta * vector_score) */
  hybrid_score: number;
  /** Raw BM25/full-text search score */
  bm25_score: number;
  /** Raw vector similarity score */
  vector_score: number;
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
   * Normalize search scores using specified method
   * 
   * @private
   * @param scores - Array of score objects with value and index
   * @param method - Normalization method to use
   * @returns Array of normalized scores
   */
  private normalizeScores(scores: { value: number; index: number }[], method: ScoreNormalization): number[] {
    if (method === 'none' || scores.length === 0) {
      return scores.map(s => s.value);
    }

    const values = scores.map(s => s.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);

    if (method === 'min-max') {
      const range = maxValue - minValue;
      if (range === 0) return values.map(() => 1);
      return values.map(v => (v - minValue) / range);
    }

    if (method === 'z-score') {
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev === 0) return values.map(() => 0);
      return values.map(v => (v - mean) / stdDev);
    }

    return values;
  }

  /**
   * Perform hybrid search combining semantic similarity and full-text search
   * 
   * @param table - Name of the table to search in
   * @param contentColumn - Name of the text column to search in
   * @param query - Natural language search query
   * @param options - Hybrid search options (topK, alpha, beta, normalization, threshold)
   * @returns Promise with hybrid search results or error
   * 
   * @example
   * ```typescript
   * const results = await semanticSearch.hybridSearch('documents', 'content', 'machine learning', {
   *   topK: 10,
   *   alpha: 0.3,    // BM25 weight
   *   beta: 0.7,     // Vector weight
   *   normalization: 'min-max'
   * });
   * 
   * if (results.error) {
   *   console.error('Search failed:', results.error);
   * } else {
   *   results.data?.forEach(item => {
   *     console.log(`Hybrid: ${item.hybrid_score.toFixed(3)}, BM25: ${item.bm25_score.toFixed(3)}, Vector: ${item.vector_score.toFixed(3)}`);
   *   });
   * }
   * ```
   */
  async hybridSearch(
    table: string,
    contentColumn: string,
    query: string,
    options: HybridSearchOptions = {}
  ): Promise<HybridSearchResult> {
    const { 
      topK = 5, 
      alpha = 0.3, 
      beta = 0.7, 
      normalization = 'min-max',
      threshold = 0.1 
    } = options;

    try {
      // Generate embedding for query
      const embeddingResponse = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });

      const queryEmbedding = embeddingResponse.data[0].embedding;

      // Use server-side hybrid search if normalization is min-max (default)
      if (normalization === 'min-max') {
        const { data, error } = await this.supabase.rpc('hybrid_search', {
          table_name: table,
          content_column: contentColumn,
          search_query: query,
          query_embedding: `[${queryEmbedding.join(',')}]`,
          alpha: alpha,
          beta: beta,
          k: topK * 2, // Get more results for better scoring
        });

        if (error) {
          return { data: null, error: new Error(error.message) };
        }

        const results = data?.map((item: any) => ({
          ...item.row_data,
          hybrid_score: item.hybrid_score,
          bm25_score: item.bm25_score,
          vector_score: item.vector_score,
        })) || [];

        const filteredResults = results
          .filter((item: HybridSearchResultItem) => item.hybrid_score >= threshold)
          .slice(0, topK);

        return { data: filteredResults, error: null };
      }

      // Client-side merging for custom normalization methods
      const [vectorResults, fulltextResults] = await Promise.all([
        this.supabase.rpc('semantic_search', {
          table_name: table,
          query_embedding: `[${queryEmbedding.join(',')}]`,
          k: topK * 2,
        }),
        this.supabase.rpc('fulltext_search', {
          table_name: table,
          content_column: contentColumn,
          search_query: query,
          k: topK * 2,
        })
      ]);

      if (vectorResults.error) {
        return { data: null, error: new Error(vectorResults.error.message) };
      }
      if (fulltextResults.error) {
        return { data: null, error: new Error(fulltextResults.error.message) };
      }

      // Create lookup maps for merging
      const vectorMap = new Map();
      vectorResults.data?.forEach((item: any, index: number) => {
        const key = JSON.stringify(item.row_data);
        vectorMap.set(key, { score: item.similarity, index });
      });

      const fulltextMap = new Map();
      fulltextResults.data?.forEach((item: any, index: number) => {
        const key = JSON.stringify(item.row_data);
        fulltextMap.set(key, { score: item.bm25_score, index });
      });

      // Combine results
      const allKeys = new Set([...vectorMap.keys(), ...fulltextMap.keys()]);
      const combinedResults: Array<{
        data: any;
        vectorScore: number;
        bm25Score: number;
      }> = [];

      allKeys.forEach(key => {
        const vectorResult = vectorMap.get(key);
        const fulltextResult = fulltextMap.get(key);
        
        combinedResults.push({
          data: JSON.parse(key),
          vectorScore: vectorResult?.score || 0,
          bm25Score: fulltextResult?.score || 0,
        });
      });

      // Normalize scores
      const vectorScores = combinedResults.map((r, i) => ({ value: r.vectorScore, index: i }));
      const bm25Scores = combinedResults.map((r, i) => ({ value: r.bm25Score, index: i }));

      const normalizedVectorScores = this.normalizeScores(vectorScores, normalization);
      const normalizedBm25Scores = this.normalizeScores(bm25Scores, normalization);

      // Calculate hybrid scores and create final results
      const hybridResults: HybridSearchResultItem[] = combinedResults.map((result, index) => ({
        ...result.data,
        hybrid_score: alpha * normalizedBm25Scores[index] + beta * normalizedVectorScores[index],
        bm25_score: result.bm25Score,
        vector_score: result.vectorScore,
      }));

      // Filter and sort results
      const filteredResults = hybridResults
        .filter(item => item.hybrid_score >= threshold)
        .sort((a, b) => b.hybrid_score - a.hybrid_score)
        .slice(0, topK);

      return { data: filteredResults, error: null };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error : new Error('Unknown error occurred') 
      };
    }
  }

  /**
   * Convenience method for hybrid search on documents table specifically
   * 
   * @param query - Natural language search query
   * @param options - Hybrid search options (topK, alpha, beta, normalization, threshold)
   * @returns Promise with document hybrid search results or error
   * 
   * @example
   * ```typescript
   * const results = await semanticSearch.hybridSearchDocuments('contract renewal process', {
   *   alpha: 0.4,  // Favor exact keyword matches more
   *   beta: 0.6,   // Still use semantic similarity
   * });
   * 
   * if (!results.error) {
   *   results.data?.forEach(doc => {
   *     console.log(`${doc.content.substring(0, 100)}... (Score: ${doc.hybrid_score.toFixed(3)})`);
   *   });
   * }
   * ```
   */
  async hybridSearchDocuments(
    query: string,
    options: HybridSearchOptions = {}
  ): Promise<HybridSearchResult> {
    const { 
      topK = 5, 
      alpha = 0.3, 
      beta = 0.7, 
      normalization = 'min-max',
      threshold = 0.1 
    } = options;

    try {
      const embeddingResponse = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });

      const queryEmbedding = embeddingResponse.data[0].embedding;

      // Use server-side hybrid search function for documents
      const { data, error } = await this.supabase.rpc('hybrid_search_documents', {
        search_query: query,
        query_embedding: `[${queryEmbedding.join(',')}]`,
        alpha: alpha,
        beta: beta,
        k: topK * 2,
      });

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      const filteredResults = (data || [])
        .filter((item: any) => item.hybrid_score >= threshold)
        .slice(0, topK)
        .map((item: any) => ({
          id: item.id,
          content: item.content,
          embedding_model: item.embedding_model,
          embedding_updated_at: item.embedding_updated_at,
          hybrid_score: item.hybrid_score,
          bm25_score: item.bm25_score,
          vector_score: item.vector_score,
        }));

      return { data: filteredResults, error: null };
    } catch (error) {
      return { 
        data: null, 
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