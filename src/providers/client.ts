import {
  IEmbeddingProvider,
  ProviderConfig,
  EmbeddingResult,
  BatchEmbeddingResult,
  ProviderInfo,
  EmbeddingProviderError,
  EmbeddingProvider as EmbeddingProviderType
} from './types';
import { OpenAIEmbeddingProvider } from './openai';
import { CohereEmbeddingProvider } from './cohere';
import { VoyageEmbeddingProvider } from './voyage';
import { AnthropicEmbeddingProvider } from './anthropic';

/**
 * Configuration for AIClient with provider fallbacks
 */
export interface AIClientConfig {
  /** Primary provider configuration */
  provider: ProviderConfig;
  /** Optional fallback providers in order of preference */
  fallbackProviders?: ProviderConfig[];
  /** Whether to enable automatic fallback on provider errors */
  enableFallback?: boolean;
  /** Timeout for provider validation in milliseconds */
  validationTimeout?: number;
}

/**
 * Unified AI client that abstracts embedding providers
 * 
 * This class provides a consistent interface across different embedding providers,
 * handles provider fallbacks, and normalizes responses.
 */
export class AIClient {
  private primaryProvider: IEmbeddingProvider;
  private fallbackProviders: IEmbeddingProvider[] = [];
  private config: AIClientConfig;

  constructor(config: AIClientConfig) {
    this.config = config;
    this.primaryProvider = this.createProvider(config.provider);
    
    if (config.fallbackProviders) {
      this.fallbackProviders = config.fallbackProviders.map(providerConfig =>
        this.createProvider(providerConfig)
      );
    }
  }

  /**
   * Create a provider instance based on configuration
   */
  private createProvider(config: ProviderConfig): IEmbeddingProvider {
    switch (config.provider) {
      case 'openai':
        return new OpenAIEmbeddingProvider(config);
      case 'cohere':
        return new CohereEmbeddingProvider(config);
      case 'voyage':
        return new VoyageEmbeddingProvider(config);
      case 'anthropic':
        return new AnthropicEmbeddingProvider(config);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  /**
   * Generate embedding for a single text with automatic fallback
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const providers = [this.primaryProvider, ...this.fallbackProviders];
    
    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      const isLastProvider = i === providers.length - 1;
      
      try {
        return await provider.embed(text);
      } catch (error) {
        // If fallback is disabled or this is the last provider, throw the error
        if (!this.config.enableFallback || isLastProvider) {
          throw error;
        }
        
        // Log the error and try the next provider
        console.warn(`Provider ${provider.getInfo().provider} failed, trying fallback:`, error);
        continue;
      }
    }
    
    throw new EmbeddingProviderError(
      'All providers failed',
      this.config.provider.provider
    );
  }

  /**
   * Generate embeddings for multiple texts with automatic fallback
   */
  async batchEmbed(texts: string[]): Promise<BatchEmbeddingResult> {
    const providers = [this.primaryProvider, ...this.fallbackProviders];
    
    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      const isLastProvider = i === providers.length - 1;
      
      try {
        return await provider.batchEmbed(texts);
      } catch (error) {
        // If fallback is disabled or this is the last provider, throw the error
        if (!this.config.enableFallback || isLastProvider) {
          throw error;
        }
        
        // Log the error and try the next provider
        console.warn(`Provider ${provider.getInfo().provider} failed, trying fallback:`, error);
        continue;
      }
    }
    
    throw new EmbeddingProviderError(
      'All providers failed',
      this.config.provider.provider
    );
  }

  /**
   * Get information about the primary provider
   */
  getProviderInfo(): ProviderInfo {
    return this.primaryProvider.getInfo();
  }

  /**
   * Get information about all available providers
   */
  getAllProviderInfo(): ProviderInfo[] {
    return [this.primaryProvider, ...this.fallbackProviders].map(provider =>
      provider.getInfo()
    );
  }

  /**
   * Validate that the primary provider is working
   */
  async validate(): Promise<boolean> {
    try {
      return await this.primaryProvider.validate();
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate all configured providers
   */
  async validateAllProviders(): Promise<Array<{
    provider: EmbeddingProviderType;
    isValid: boolean;
    error?: string;
  }>> {
    const results = [];
    const allProviders = [this.primaryProvider, ...this.fallbackProviders];
    
    for (const provider of allProviders) {
      try {
        const isValid = await provider.validate();
        results.push({
          provider: provider.getInfo().provider,
          isValid
        });
      } catch (error) {
        results.push({
          provider: provider.getInfo().provider,
          isValid: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return results;
  }

  /**
   * Switch to a different primary provider
   */
  switchProvider(newConfig: ProviderConfig): void {
    this.primaryProvider = this.createProvider(newConfig);
    this.config.provider = newConfig;
  }

  /**
   * Add a fallback provider
   */
  addFallbackProvider(config: ProviderConfig): void {
    const provider = this.createProvider(config);
    this.fallbackProviders.push(provider);
    
    if (!this.config.fallbackProviders) {
      this.config.fallbackProviders = [];
    }
    this.config.fallbackProviders.push(config);
  }

  /**
   * Get embedding dimensions for the current provider and model
   */
  getDimensions(): number {
    return this.primaryProvider.getInfo().defaultDimensions;
  }

  /**
   * Check if two providers are compatible (same dimensions)
   */
  static areProvidersCompatible(provider1: ProviderConfig, provider2: ProviderConfig): boolean {
    const client1 = new AIClient({ provider: provider1 });
    const client2 = new AIClient({ provider: provider2 });
    
    return client1.getDimensions() === client2.getDimensions();
  }

  /**
   * Get recommended provider based on use case
   */
  static getRecommendedProvider(useCase: string): {
    provider: EmbeddingProviderType;
    model: string;
    reasoning: string;
  } {
    const recommendations: Record<string, {
      provider: EmbeddingProviderType;
      model: string;
      reasoning: string;
    }> = {
      'general': {
        provider: 'openai',
        model: 'text-embedding-3-small',
        reasoning: 'Best balance of performance, cost, and reliability'
      },
      'code': {
        provider: 'voyage',
        model: 'voyage-code-2',
        reasoning: 'Specialized for code and technical documentation'
      },
      'multilingual': {
        provider: 'cohere',
        model: 'embed-multilingual-v3.0',
        reasoning: 'Excellent multilingual support'
      },
      'cost-sensitive': {
        provider: 'cohere',
        model: 'embed-english-light-v3.0',
        reasoning: 'Lower cost with good performance for English text'
      },
      'high-performance': {
        provider: 'voyage',
        model: 'voyage-large-2',
        reasoning: 'Highest quality embeddings available'
      }
    };
    
    return recommendations[useCase.toLowerCase()] || recommendations['general'];
  }
}

/**
 * Factory function to create AIClient with simplified configuration
 */
export function createAIClient(
  provider: EmbeddingProviderType,
  apiKey: string,
  options: {
    model?: string;
    enableFallback?: boolean;
    fallbackProviders?: Array<{ provider: EmbeddingProviderType; apiKey: string; model?: string }>;
  } = {}
): AIClient {
  const config: AIClientConfig = {
    provider: {
      provider,
      apiKey,
      model: options.model
    },
    enableFallback: options.enableFallback || false
  };

  if (options.fallbackProviders) {
    config.fallbackProviders = options.fallbackProviders.map(fallback => ({
      provider: fallback.provider,
      apiKey: fallback.apiKey,
      model: fallback.model
    }));
  }

  return new AIClient(config);
}