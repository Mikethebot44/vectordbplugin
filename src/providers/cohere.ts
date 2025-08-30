import { BaseEmbeddingProvider } from './base';
import {
  ProviderConfig,
  EmbeddingResult,
  BatchEmbeddingResult,
  ProviderInfo
} from './types';

/**
 * Cohere embedding provider implementation using direct HTTP calls
 * No additional dependencies required - uses built-in fetch
 */
export class CohereEmbeddingProvider extends BaseEmbeddingProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: ProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.cohere.ai';
    this.apiKey = config.apiKey;
  }

  getInfo(): ProviderInfo {
    return {
      provider: 'cohere',
      defaultModel: 'embed-english-v3.0',
      availableModels: [
        'embed-english-v3.0',
        'embed-english-light-v3.0',
        'embed-multilingual-v3.0',
        'embed-multilingual-light-v3.0'
      ],
      defaultDimensions: 1024,
      maxInputLength: 96, // 96 texts per request
      maxBatchSize: 96,
      normalizedByDefault: true
    };
  }

  async embed(text: string): Promise<EmbeddingResult> {
    try {
      const model = this.getModelName();
      const response = await fetch(`${this.baseUrl}/v1/embed`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          texts: [text],
          model,
          input_type: 'search_document',
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }

      const data = await response.json() as any;

      if (!data.embeddings || data.embeddings.length === 0) {
        throw new Error('No embeddings returned from Cohere');
      }

      const embedding = data.embeddings[0];
      const normalizedEmbedding = this.shouldNormalize() 
        ? this.normalizeVector(embedding)
        : embedding;

      return {
        embedding: normalizedEmbedding,
        dimensions: embedding.length,
        provider: 'cohere',
        model,
        tokens: data.meta?.billed_units?.input_tokens
      };
    } catch (error) {
      throw this.createError(
        `Cohere embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async batchEmbed(texts: string[]): Promise<BatchEmbeddingResult> {
    const info = this.getInfo();
    
    // Handle large batches by chunking
    if (texts.length > info.maxBatchSize) {
      return this.batchEmbedWithChunking(texts, info.maxBatchSize);
    }

    return this.batchEmbedChunk(texts);
  }

  protected async batchEmbedChunk(texts: string[]): Promise<BatchEmbeddingResult> {
    try {
      const model = this.getModelName();
      const response = await fetch(`${this.baseUrl}/v1/embed`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          texts,
          model,
          input_type: 'search_document',
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }

      const data = await response.json() as any;

      if (!data.embeddings) {
        throw new Error('No embeddings returned from Cohere');
      }

      const embeddings = data.embeddings.map((embedding: number[]) => {
        return this.shouldNormalize() 
          ? this.normalizeVector(embedding)
          : embedding;
      });

      return {
        embeddings,
        dimensions: embeddings[0]?.length || 0,
        provider: 'cohere',
        model,
        totalTokens: data.meta?.billed_units?.input_tokens
      };
    } catch (error) {
      throw this.createError(
        `Cohere batch embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async validate(): Promise<boolean> {
    try {
      // Test with a simple embedding request
      await this.embed('test');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get model-specific dimension information
   */
  static getModelDimensions(model: string): number {
    const dimensions: Record<string, number> = {
      'embed-english-v3.0': 1024,
      'embed-english-light-v3.0': 384,
      'embed-multilingual-v3.0': 1024,
      'embed-multilingual-light-v3.0': 384
    };
    return dimensions[model] || 1024;
  }

  /**
   * Get available models with their capabilities
   */
  static getModelInfo(): Array<{
    name: string;
    dimensions: number;
    maxTexts: number;
    costPer1kTokens: number;
    language: string;
  }> {
    return [
      {
        name: 'embed-english-v3.0',
        dimensions: 1024,
        maxTexts: 96,
        costPer1kTokens: 0.0001,
        language: 'English'
      },
      {
        name: 'embed-english-light-v3.0',
        dimensions: 384,
        maxTexts: 96,
        costPer1kTokens: 0.0001,
        language: 'English'
      },
      {
        name: 'embed-multilingual-v3.0',
        dimensions: 1024,
        maxTexts: 96,
        costPer1kTokens: 0.0001,
        language: 'Multilingual'
      },
      {
        name: 'embed-multilingual-light-v3.0',
        dimensions: 384,
        maxTexts: 96,
        costPer1kTokens: 0.0001,
        language: 'Multilingual'
      }
    ];
  }
}