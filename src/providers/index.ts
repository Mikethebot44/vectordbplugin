// Types
export * from './types';

// Base provider
export { BaseEmbeddingProvider } from './base';

// Individual providers
export { OpenAIEmbeddingProvider } from './openai';
export { CohereEmbeddingProvider } from './cohere';
export { VoyageEmbeddingProvider } from './voyage';
export { AnthropicEmbeddingProvider } from './anthropic';

// Main client
export { AIClient, createAIClient, type AIClientConfig } from './client';

// Provider information utilities
export const PROVIDER_INFO = {
  openai: {
    name: 'OpenAI',
    website: 'https://openai.com',
    documentation: 'https://platform.openai.com/docs/guides/embeddings',
    defaultDimensions: 1536,
    strengths: ['High quality', 'Fast', 'Reliable', 'Well documented'],
    considerations: ['API rate limits', 'Usage costs', 'Data privacy']
  },
  cohere: {
    name: 'Cohere',
    website: 'https://cohere.ai',
    documentation: 'https://docs.cohere.ai/reference/embed',
    defaultDimensions: 1024,
    strengths: ['Multilingual support', 'Competitive pricing', 'Light models available'],
    considerations: ['Smaller ecosystem', 'Different API patterns']
  },
  voyage: {
    name: 'Voyage AI',
    website: 'https://www.voyageai.com',
    documentation: 'https://docs.voyageai.com',
    defaultDimensions: 1536,
    strengths: ['High performance', 'Code specialization', 'Good pricing'],
    considerations: ['Newer provider', 'Limited model selection']
  },
  anthropic: {
    name: 'Anthropic',
    website: 'https://anthropic.com',
    documentation: 'https://docs.anthropic.com',
    defaultDimensions: 1536,
    strengths: ['Coming soon'],
    considerations: ['Not yet available']
  }
} as const;

/**
 * Get provider recommendations based on use case
 */
export function getProviderRecommendation(useCase: 'general' | 'code' | 'multilingual' | 'cost' | 'performance') {
  const recommendations = {
    general: {
      primary: 'openai',
      model: 'text-embedding-3-small',
      fallback: 'cohere',
      reasoning: 'OpenAI provides the best balance of quality and reliability'
    },
    code: {
      primary: 'voyage',
      model: 'voyage-code-2', 
      fallback: 'openai',
      reasoning: 'Voyage Code-2 is specifically optimized for code understanding'
    },
    multilingual: {
      primary: 'cohere',
      model: 'embed-multilingual-v3.0',
      fallback: 'openai', 
      reasoning: 'Cohere has the best multilingual support across 100+ languages'
    },
    cost: {
      primary: 'cohere',
      model: 'embed-english-light-v3.0',
      fallback: 'openai',
      reasoning: 'Cohere Light models offer good quality at lower cost'
    },
    performance: {
      primary: 'voyage',
      model: 'voyage-large-2',
      fallback: 'openai',
      reasoning: 'Voyage Large-2 delivers highest quality embeddings'
    }
  };

  return recommendations[useCase];
}