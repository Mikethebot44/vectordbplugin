# Multi-Model Support Guide

## Overview

The Supabase Semantic Search wrapper now supports multiple embedding providers, allowing you to:

- **Switch between AI providers** without changing your code
- **Use automatic fallbacks** when providers fail
- **Choose specialized models** for different use cases
- **Avoid vendor lock-in** and reduce dependency risks

## Supported Providers

| Provider | Strengths | Best For | Default Model | Dimensions |
|----------|-----------|----------|---------------|------------|
| **OpenAI** | Reliable, fast, well-documented | General use, production apps | `text-embedding-3-small` | 1536 |
| **Cohere** | Multilingual, cost-effective | International content, translations | `embed-english-v3.0` | 1024 |
| **Voyage** | High performance, code-specialized | Technical docs, code search | `voyage-large-2` | 1536 |
| **Anthropic** | Coming soon | TBD | TBD | TBD |

## Quick Start

### Legacy Usage (Backward Compatible)
```typescript
import { createSemanticSearch } from 'supabase-semantic-search';

// Still works exactly as before
const search = createSemanticSearch(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  process.env.OPENAI_API_KEY!
);
```

### Multi-Model Usage

```typescript
import { createSemanticSearchWithProvider } from 'supabase-semantic-search';

const search = createSemanticSearchWithProvider({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_ANON_KEY!,
  aiProvider: {
    provider: 'cohere',
    apiKey: process.env.COHERE_API_KEY!,
    model: 'embed-english-v3.0'
  },
  enableFallback: true,
  fallbackProviders: [{
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY!
  }]
});
```

### Provider-Specific Shortcuts

```typescript
import { createWithCohere, createWithVoyage } from 'supabase-semantic-search';

// For multilingual content
const cohereSearch = createWithCohere(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  process.env.COHERE_API_KEY!,
  'embed-multilingual-v3.0'
);

// For code search
const voyageSearch = createWithVoyage(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  process.env.VOYAGE_API_KEY!,
  'voyage-code-2'
);
```

## Configuration Options

### Environment Variables

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Primary AI Provider
AI_PROVIDER=cohere
AI_MODEL=embed-english-v3.0

# Provider API Keys
OPENAI_API_KEY=sk-your-openai-key
COHERE_API_KEY=your-cohere-key
VOYAGE_API_KEY=your-voyage-key

# Fallback Configuration
ENABLE_FALLBACK=true
FALLBACK_PROVIDERS=[{"provider": "openai"}]
```

### JSON Configuration

```json
{
  "supabase": {
    "url": "https://your-project.supabase.co",
    "anonKey": "your-anon-key"
  },
  "aiProvider": {
    "primary": {
      "provider": "voyage",
      "apiKey": "your-voyage-key",
      "model": "voyage-code-2"
    },
    "fallbacks": [
      {
        "provider": "openai",
        "apiKey": "sk-your-openai-key"
      }
    ],
    "enableFallback": true
  }
}
```

## Provider Management

### Switch Providers Dynamically

```typescript
// Check current provider
console.log('Current provider:', search.getProviderInfo().provider);

// Switch to a different provider
search.switchProvider({
  provider: 'voyage',
  apiKey: process.env.VOYAGE_API_KEY!,
  model: 'voyage-code-2'
});

console.log('New provider:', search.getProviderInfo().provider);
```

### Add Fallback Providers

```typescript
// Add Cohere as a fallback
search.addFallbackProvider({
  provider: 'cohere',
  apiKey: process.env.COHERE_API_KEY!,
  model: 'embed-english-v3.0'
});

// Validate all providers
const results = await search.validateProviders();
results.forEach(result => {
  console.log(`${result.provider}: ${result.isValid ? '✅' : '❌'}`);
});
```

### Provider Recommendations

```typescript
import { SupabaseSemanticSearch } from 'supabase-semantic-search';

// Get recommendations for different use cases
const generalRec = SupabaseSemanticSearch.getProviderRecommendation('general');
const codeRec = SupabaseSemanticSearch.getProviderRecommendation('code');
const multilingualRec = SupabaseSemanticSearch.getProviderRecommendation('multilingual');

console.log('For general use:', generalRec.provider, generalRec.model);
console.log('For code:', codeRec.provider, codeRec.model);
console.log('For multilingual:', multilingualRec.provider, multilingualRec.model);
```

## Use Case Examples

### General Purpose Application

```typescript
const search = createSemanticSearchWithProvider({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_ANON_KEY!,
  aiProvider: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small'
  },
  enableFallback: true,
  fallbackProviders: [{
    provider: 'cohere',
    apiKey: process.env.COHERE_API_KEY!
  }]
});
```

### Code Documentation Search

```typescript
const codeSearch = createWithVoyage(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  process.env.VOYAGE_API_KEY!,
  'voyage-code-2'
);

// Excellent for searching technical documentation
const results = await codeSearch.hybridSearchDocuments('async function error handling', {
  topK: 10,
  alpha: 0.4,  // Higher weight for exact code terms
  beta: 0.6
});
```

### Multilingual Content Platform

```typescript
const multilingualSearch = createWithCohere(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  process.env.COHERE_API_KEY!,
  'embed-multilingual-v3.0'
);

// Great for content in multiple languages
const results = await multilingualSearch.searchDocuments('artificial intelligence', {
  topK: 15,
  threshold: 0.6
});
```

### Cost-Optimized Setup

```typescript
const costOptimizedSearch = createSemanticSearchWithProvider({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_ANON_KEY!,
  aiProvider: {
    provider: 'cohere',
    apiKey: process.env.COHERE_API_KEY!,
    model: 'embed-english-light-v3.0'  // Lower cost, smaller dimensions
  }
});

console.log('Dimensions:', costOptimizedSearch.getEmbeddingDimensions()); // 384
```

## Migration and Provider Switching

### Migrating Between Providers

```typescript
// Get current provider stats
const stats = await search.getProviderStats('documents');
console.log('Current provider usage:', stats.data);

// Migrate from OpenAI to Cohere
const migrationResult = await search.migrateProvider(
  'documents',
  'openai', 'text-embedding-3-small',
  'cohere', 'embed-english-v3.0'
);

if (migrationResult.error) {
  console.error('Migration failed:', migrationResult.error);
} else {
  console.log('Migration completed');
}
```

**Important**: Migration clears existing embeddings and marks them for re-generation. This is necessary because different providers have different embedding dimensions and value ranges.

### Database Schema Updates

The multi-model support adds these columns to your tables:

```sql
-- Added automatically by the migration
ALTER TABLE your_table ADD COLUMN embedding_provider text DEFAULT 'openai';
ALTER TABLE your_table ADD COLUMN embedding_model text DEFAULT 'text-embedding-3-small';
ALTER TABLE your_table ADD COLUMN embedding_dimensions int DEFAULT 1536;
ALTER TABLE your_table ADD COLUMN embedding_normalized boolean DEFAULT true;
```

## Advanced Configuration

### Custom Provider Normalization

```typescript
const search = createSemanticSearchWithProvider({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_ANON_KEY!,
  aiProvider: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY!,
  }
});

// Use custom normalization for hybrid search
const results = await search.hybridSearchDocuments('machine learning', {
  topK: 10,
  alpha: 0.3,
  beta: 0.7,
  normalization: 'z-score'  // min-max | z-score | none
});
```

### Provider-Specific Database Functions

```sql
-- Search only within specific provider/model
SELECT * FROM semantic_search_multi(
  'documents',
  '[0.1, 0.2, ...]'::vector(1536),
  10,  -- k
  'openai',  -- provider filter
  'text-embedding-3-small'  -- model filter
);

-- Hybrid search with provider filtering
SELECT * FROM hybrid_search_multi(
  'documents', 'content',
  'search query',
  '[0.1, 0.2, ...]'::vector(1536),
  0.3, 0.7, 10,  -- alpha, beta, k
  'cohere'  -- provider filter
);
```

## Best Practices

### Provider Selection

1. **General applications**: Start with OpenAI (reliable, well-tested)
2. **Multilingual content**: Use Cohere multilingual models
3. **Code/technical docs**: Use Voyage code-specialized models
4. **Cost-sensitive apps**: Consider Cohere light models
5. **High-performance needs**: Use Voyage large models

### Fallback Strategy

```typescript
// Recommended fallback pattern
const search = createSemanticSearchWithProvider({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_ANON_KEY!,
  aiProvider: {
    provider: 'openai',  // Primary: reliable
    apiKey: process.env.OPENAI_API_KEY!
  },
  enableFallback: true,
  fallbackProviders: [{
    provider: 'cohere',  // Fallback: different provider
    apiKey: process.env.COHERE_API_KEY!
  }]
});
```

### Dimension Compatibility

- **OpenAI**: 1536 dimensions (text-embedding-3-small), 3072 (3-large)
- **Cohere**: 1024 dimensions (standard), 384 (light models)  
- **Voyage**: 1536 dimensions (large models), 1024 (standard)

⚠️ **Important**: You cannot mix providers with different dimensions in the same table. Use migration when switching between incompatible providers.

### Performance Optimization

1. **Enable fallbacks** for production reliability
2. **Use provider-specific models** for specialized use cases
3. **Monitor provider statistics** to optimize costs
4. **Validate providers** during deployment
5. **Cache provider info** to avoid repeated calls

## Troubleshooting

### Common Issues

**Error: "Dimension mismatch"**
- Different providers have different embedding dimensions
- Use migration function to switch between incompatible providers

**Error: "Provider validation failed"** 
- Check API keys are correct and have sufficient credits
- Verify network connectivity to provider APIs
- Use `validateProviders()` to diagnose issues

**Error: "Fallback loop detected"**
- Ensure fallback providers use different services
- Check that at least one provider is properly configured

### Debugging

```typescript
// Check provider status
const validation = await search.validateProviders();
console.log('Provider status:', validation);

// Get provider statistics
const stats = await search.getProviderStats('documents');
console.log('Usage stats:', stats.data);

// Check current configuration
console.log('Current provider:', search.getProviderInfo());
console.log('Embedding dimensions:', search.getEmbeddingDimensions());
```

## API Reference

### New Methods

- `getProviderInfo()`: Get current provider information
- `switchProvider(config)`: Change to different provider
- `addFallbackProvider(config)`: Add fallback provider
- `validateProviders()`: Test all configured providers
- `getEmbeddingDimensions()`: Get current embedding dimensions
- `getProviderStats(table)`: Get provider usage statistics
- `migrateProvider(...)`: Migrate between providers

### New Exports

- `createSemanticSearchWithProvider()`: Multi-model constructor
- `createWithCohere()`, `createWithVoyage()`: Provider-specific constructors
- `PROVIDER_INFO`: Provider capabilities and information
- `AIClient`: Direct provider abstraction (advanced usage)

## Migration from v0.1.x

The new multi-model version is **100% backward compatible**. Existing code continues to work without changes:

```typescript
// This continues to work exactly as before
const search = createSemanticSearch(
  supabaseUrl,
  supabaseKey, 
  openaiApiKey
);
```

To adopt multi-model features:

1. **Run new SQL migration**: `07_multi_model_support.sql`
2. **Install new dependencies**: `npm install` (adds Cohere/Voyage SDKs)
3. **Optional**: Switch to new constructor for additional features
4. **Optional**: Add fallback providers for reliability

The upgrade is non-breaking and can be done gradually.