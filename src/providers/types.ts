/**
 * Supported embedding providers
 */
export type EmbeddingProvider = 'openai' | 'cohere' | 'voyage' | 'anthropic';

/**
 * Provider configuration for different embedding services
 */
export interface ProviderConfig {
  /** The embedding provider to use */
  provider: EmbeddingProvider;
  /** API key for the provider */
  apiKey: string;
  /** Optional model name (uses provider default if not specified) */
  model?: string;
  /** Optional base URL for custom endpoints */
  baseUrl?: string;
  /** Optional timeout in milliseconds */
  timeout?: number;
}

/**
 * Standardized embedding result from any provider
 */
export interface EmbeddingResult {
  /** The embedding vector */
  embedding: number[];
  /** Number of dimensions in the embedding */
  dimensions: number;
  /** Provider that generated this embedding */
  provider: EmbeddingProvider;
  /** Model used to generate the embedding */
  model: string;
  /** Token count used (if available from provider) */
  tokens?: number;
}

/**
 * Batch embedding result for multiple inputs
 */
export interface BatchEmbeddingResult {
  /** Array of embeddings corresponding to input texts */
  embeddings: number[][];
  /** Number of dimensions in the embeddings */
  dimensions: number;
  /** Provider that generated these embeddings */
  provider: EmbeddingProvider;
  /** Model used to generate the embeddings */
  model: string;
  /** Total token count used (if available from provider) */
  totalTokens?: number;
}

/**
 * Provider capabilities and metadata
 */
export interface ProviderInfo {
  /** Provider identifier */
  provider: EmbeddingProvider;
  /** Default model for this provider */
  defaultModel: string;
  /** Available models for this provider */
  availableModels: string[];
  /** Default embedding dimensions */
  defaultDimensions: number;
  /** Maximum input text length */
  maxInputLength: number;
  /** Maximum batch size for batch operations */
  maxBatchSize: number;
  /** Whether this provider normalizes embeddings to unit vectors */
  normalizedByDefault: boolean;
}

/**
 * Base interface for all embedding providers
 */
export interface IEmbeddingProvider {
  /** Get provider information */
  getInfo(): ProviderInfo;
  
  /** Generate embedding for a single text */
  embed(text: string): Promise<EmbeddingResult>;
  
  /** Generate embeddings for multiple texts */
  batchEmbed(texts: string[]): Promise<BatchEmbeddingResult>;
  
  /** Validate that the provider is properly configured */
  validate(): Promise<boolean>;
}

/**
 * Error thrown by embedding providers
 */
export class EmbeddingProviderError extends Error {
  constructor(
    message: string,
    public provider: EmbeddingProvider,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'EmbeddingProviderError';
  }
}