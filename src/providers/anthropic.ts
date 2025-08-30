import { BaseEmbeddingProvider } from './base';
import {
  ProviderConfig,
  EmbeddingResult,
  BatchEmbeddingResult,
  ProviderInfo
} from './types';

/**
 * Anthropic embedding provider implementation (placeholder)
 * 
 * Note: Anthropic doesn't currently offer embeddings API, but this provider
 * is included for future compatibility when they release their embeddings service.
 */
export class AnthropicEmbeddingProvider extends BaseEmbeddingProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  getInfo(): ProviderInfo {
    return {
      provider: 'anthropic',
      defaultModel: 'claude-embeddings-v1', // Hypothetical future model
      availableModels: [
        'claude-embeddings-v1'
      ],
      defaultDimensions: 1536, // Assumed dimension
      maxInputLength: 100000, // Generous assumption based on Claude's context
      maxBatchSize: 100,
      normalizedByDefault: false
    };
  }

  async embed(text: string): Promise<EmbeddingResult> {
    throw this.createError(
      'Anthropic embeddings are not yet available. Please use OpenAI, Cohere, or Voyage providers instead.'
    );
  }

  async batchEmbed(texts: string[]): Promise<BatchEmbeddingResult> {
    throw this.createError(
      'Anthropic embeddings are not yet available. Please use OpenAI, Cohere, or Voyage providers instead.'
    );
  }

  protected async batchEmbedChunk(texts: string[]): Promise<BatchEmbeddingResult> {
    throw this.createError(
      'Anthropic embeddings are not yet available. Please use OpenAI, Cohere, or Voyage providers instead.'
    );
  }

  async validate(): Promise<boolean> {
    // Always return false since Anthropic embeddings aren't available yet
    return false;
  }

  /**
   * Get model-specific dimension information (hypothetical)
   */
  static getModelDimensions(model: string): number {
    const dimensions: Record<string, number> = {
      'claude-embeddings-v1': 1536
    };
    return dimensions[model] || 1536;
  }

  /**
   * Get available models with their capabilities (hypothetical)
   */
  static getModelInfo(): Array<{
    name: string;
    dimensions: number;
    maxTokens: number;
    costPer1kTokens: number;
    status: string;
  }> {
    return [
      {
        name: 'claude-embeddings-v1',
        dimensions: 1536,
        maxTokens: 100000,
        costPer1kTokens: 0.0001, // Estimated
        status: 'Coming Soon'
      }
    ];
  }
}