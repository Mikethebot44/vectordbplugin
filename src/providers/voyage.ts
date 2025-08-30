import { BaseEmbeddingProvider } from './base';
import {
  ProviderConfig,
  EmbeddingResult,
  BatchEmbeddingResult,
  ProviderInfo
} from './types';

/**
 * Voyage AI embedding provider implementation using direct HTTP calls
 * No additional dependencies required - uses built-in fetch
 */
export class VoyageEmbeddingProvider extends BaseEmbeddingProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: ProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.voyageai.com';
    this.apiKey = config.apiKey;
  }

  getInfo(): ProviderInfo {
    return {
      provider: 'voyage',
      defaultModel: 'voyage-large-2',
      availableModels: [
        'voyage-large-2',
        'voyage-code-2',
        'voyage-2',
        'voyage-lite-02-instruct'
      ],
      defaultDimensions: 1536,
      maxInputLength: 32000, // characters
      maxBatchSize: 128,
      normalizedByDefault: true
    };
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const info = this.getInfo();
    this.validateInputLength(text, info.maxInputLength);

    try {
      const model = this.getModelName();
      const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          input: [text],
          model,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }

      const data = await response.json() as any;

      if (!data.data || data.data.length === 0) {
        throw new Error('No embeddings returned from Voyage');
      }

      const embedding = data.data[0].embedding;
      const normalizedEmbedding = this.shouldNormalize() 
        ? this.normalizeVector(embedding)
        : embedding;

      return {
        embedding: normalizedEmbedding,
        dimensions: embedding.length,
        provider: 'voyage',
        model,
        tokens: data.usage?.total_tokens
      };
    } catch (error) {
      throw this.createError(
        `Voyage embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async batchEmbed(texts: string[]): Promise<BatchEmbeddingResult> {
    const info = this.getInfo();
    
    // Validate inputs
    texts.forEach(text => this.validateInputLength(text, info.maxInputLength));

    // Handle large batches by chunking
    if (texts.length > info.maxBatchSize) {
      return this.batchEmbedWithChunking(texts, info.maxBatchSize);
    }

    return this.batchEmbedChunk(texts);
  }

  protected async batchEmbedChunk(texts: string[]): Promise<BatchEmbeddingResult> {
    try {
      const model = this.getModelName();
      const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          input: texts,
          model,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }

      const data = await response.json() as any;

      if (!data.data) {
        throw new Error('No embeddings returned from Voyage');
      }

      const embeddings = data.data.map((item: any) => {
        const embedding = item.embedding;
        return this.shouldNormalize() 
          ? this.normalizeVector(embedding)
          : embedding;
      });

      return {
        embeddings,
        dimensions: embeddings[0]?.length || 0,
        provider: 'voyage',
        model,
        totalTokens: data.usage?.total_tokens
      };
    } catch (error) {
      throw this.createError(
        `Voyage batch embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      'voyage-large-2': 1536,
      'voyage-code-2': 1536,
      'voyage-2': 1024,
      'voyage-lite-02-instruct': 1024
    };
    return dimensions[model] || 1536;
  }

  /**
   * Get available models with their capabilities
   */
  static getModelInfo(): Array<{
    name: string;
    dimensions: number;
    maxTokens: number;
    costPer1kTokens: number;
    specialty: string;
  }> {
    return [
      {
        name: 'voyage-large-2',
        dimensions: 1536,
        maxTokens: 16000,
        costPer1kTokens: 0.00012,
        specialty: 'General purpose, high performance'
      },
      {
        name: 'voyage-code-2',
        dimensions: 1536,
        maxTokens: 16000,
        costPer1kTokens: 0.00012,
        specialty: 'Code and technical documents'
      },
      {
        name: 'voyage-2',
        dimensions: 1024,
        maxTokens: 4000,
        costPer1kTokens: 0.0001,
        specialty: 'Balanced performance and cost'
      },
      {
        name: 'voyage-lite-02-instruct',
        dimensions: 1024,
        maxTokens: 4000,
        costPer1kTokens: 0.0001,
        specialty: 'Lightweight, instruction-tuned'
      }
    ];
  }
}