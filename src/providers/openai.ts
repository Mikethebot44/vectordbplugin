import OpenAI from 'openai';
import { BaseEmbeddingProvider } from './base';
import {
  ProviderConfig,
  EmbeddingResult,
  BatchEmbeddingResult,
  ProviderInfo
} from './types';

/**
 * OpenAI embedding provider implementation
 */
export class OpenAIEmbeddingProvider extends BaseEmbeddingProvider {
  private client: OpenAI;

  constructor(config: ProviderConfig) {
    super(config);
    this.client = new OpenAI({ 
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout || 60000
    });
  }

  getInfo(): ProviderInfo {
    return {
      provider: 'openai',
      defaultModel: 'text-embedding-3-small',
      availableModels: [
        'text-embedding-3-small',
        'text-embedding-3-large',
        'text-embedding-ada-002'
      ],
      defaultDimensions: 1536,
      maxInputLength: 8191, // tokens, approximate
      maxBatchSize: 2048,
      normalizedByDefault: false
    };
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const info = this.getInfo();
    this.validateInputLength(text, info.maxInputLength);

    try {
      const model = this.getModelName();
      const response = await this.client.embeddings.create({
        model,
        input: text,
      });

      const embedding = response.data[0].embedding;
      const normalizedEmbedding = this.shouldNormalize() 
        ? this.normalizeVector(embedding)
        : embedding;

      return {
        embedding: normalizedEmbedding,
        dimensions: embedding.length,
        provider: 'openai',
        model,
        tokens: response.usage?.total_tokens
      };
    } catch (error) {
      throw this.createError(
        `OpenAI embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      const response = await this.client.embeddings.create({
        model,
        input: texts,
      });

      const embeddings = response.data.map(item => {
        const embedding = item.embedding;
        return this.shouldNormalize() 
          ? this.normalizeVector(embedding)
          : embedding;
      });

      return {
        embeddings,
        dimensions: embeddings[0]?.length || 0,
        provider: 'openai',
        model,
        totalTokens: response.usage?.total_tokens
      };
    } catch (error) {
      throw this.createError(
        `OpenAI batch embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-ada-002': 1536
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
  }> {
    return [
      {
        name: 'text-embedding-3-small',
        dimensions: 1536,
        maxTokens: 8191,
        costPer1kTokens: 0.00002
      },
      {
        name: 'text-embedding-3-large',
        dimensions: 3072,
        maxTokens: 8191,
        costPer1kTokens: 0.00013
      },
      {
        name: 'text-embedding-ada-002',
        dimensions: 1536,
        maxTokens: 8191,
        costPer1kTokens: 0.0001
      }
    ];
  }
}