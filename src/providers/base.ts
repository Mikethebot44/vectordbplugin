import {
  IEmbeddingProvider,
  ProviderConfig,
  EmbeddingResult,
  BatchEmbeddingResult,
  ProviderInfo,
  EmbeddingProviderError,
  EmbeddingProvider as EmbeddingProviderType
} from './types';

/**
 * Base class for all embedding providers with common functionality
 */
export abstract class BaseEmbeddingProvider implements IEmbeddingProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  abstract getInfo(): ProviderInfo;
  abstract embed(text: string): Promise<EmbeddingResult>;
  abstract batchEmbed(texts: string[]): Promise<BatchEmbeddingResult>;
  abstract validate(): Promise<boolean>;

  /**
   * Normalize an embedding vector to unit length
   * This ensures consistent similarity calculations across providers
   */
  protected normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) {
      throw new EmbeddingProviderError(
        'Cannot normalize zero vector',
        this.config.provider
      );
    }
    return vector.map(val => val / magnitude);
  }

  /**
   * Validate input text length against provider limits
   */
  protected validateInputLength(text: string, maxLength: number): void {
    if (text.length > maxLength) {
      throw new EmbeddingProviderError(
        `Input text length ${text.length} exceeds provider limit of ${maxLength}`,
        this.config.provider
      );
    }
  }

  /**
   * Validate batch size against provider limits
   */
  protected validateBatchSize(texts: string[], maxBatchSize: number): void {
    if (texts.length > maxBatchSize) {
      throw new EmbeddingProviderError(
        `Batch size ${texts.length} exceeds provider limit of ${maxBatchSize}`,
        this.config.provider
      );
    }
  }

  /**
   * Split a large batch into smaller batches that fit provider limits
   */
  protected async batchEmbedWithChunking(
    texts: string[],
    maxBatchSize: number
  ): Promise<BatchEmbeddingResult> {
    const chunks: string[][] = [];
    for (let i = 0; i < texts.length; i += maxBatchSize) {
      chunks.push(texts.slice(i, i + maxBatchSize));
    }

    const results = await Promise.all(
      chunks.map(chunk => this.batchEmbedChunk(chunk))
    );

    // Combine results
    const allEmbeddings = results.flatMap(result => result.embeddings);
    const totalTokens = results.reduce((sum, result) => 
      sum + (result.totalTokens || 0), 0
    );

    return {
      embeddings: allEmbeddings,
      dimensions: results[0].dimensions,
      provider: this.config.provider,
      model: results[0].model,
      totalTokens: totalTokens || undefined
    };
  }

  /**
   * Process a single chunk of embeddings (must be implemented by subclasses)
   */
  protected abstract batchEmbedChunk(texts: string[]): Promise<BatchEmbeddingResult>;

  /**
   * Create a standardized error with provider context
   */
  protected createError(message: string, originalError?: Error): EmbeddingProviderError {
    return new EmbeddingProviderError(message, this.config.provider, originalError);
  }

  /**
   * Get the effective model name (config override or provider default)
   */
  protected getModelName(): string {
    return this.config.model || this.getInfo().defaultModel;
  }

  /**
   * Check if embeddings should be normalized for this provider
   */
  protected shouldNormalize(): boolean {
    // Always normalize to ensure consistency across providers
    // Even if provider normalizes by default, we normalize again to be safe
    return true;
  }
}