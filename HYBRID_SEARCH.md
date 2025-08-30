# Hybrid Search Implementation

## Overview
This implementation adds **hybrid search** to the Supabase Semantic Search wrapper, combining vector similarity (semantic meaning) with BM25/full-text search (lexical keyword matching) for production-ready search capabilities.

## Features
- **Semantic + Keyword Search**: Best of both worlds - semantic understanding with exact keyword precision
- **Configurable Weighting**: Adjust alpha/beta parameters to favor keyword matching vs semantic similarity
- **Multiple Normalization Methods**: Min-max, z-score, or no normalization
- **Server-side Optimization**: Uses PostgreSQL functions for efficient hybrid scoring
- **Client-side Fallback**: Custom normalization handled in TypeScript when needed

## API Usage

### Basic Hybrid Search

```typescript
import { createSemanticSearch } from 'supabase-semantic-search';

const semanticSearch = createSemanticSearch(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  process.env.OPENAI_API_KEY!
);

// Generic hybrid search on any table
const results = await semanticSearch.hybridSearch('documents', 'content', 'apple earnings', {
  topK: 10,
  alpha: 0.3,    // 30% weight for BM25/keyword matching  
  beta: 0.7,     // 70% weight for vector similarity
  normalization: 'min-max',
  threshold: 0.1
});

// Convenience method for documents table
const docResults = await semanticSearch.hybridSearchDocuments('contract renewal', {
  alpha: 0.4,  // Favor exact keywords more
  beta: 0.6    // Still use semantic similarity
});
```

### Weight Configuration Examples

```typescript
// Favor semantic similarity (good for concept-based queries)
const conceptQuery = await semanticSearch.hybridSearchDocuments('innovation strategy', {
  alpha: 0.2,  // Low keyword weight
  beta: 0.8    // High semantic weight
});

// Favor exact keyword matching (good for specific terms, names, numbers)
const exactQuery = await semanticSearch.hybridSearchDocuments('Q4 2023 earnings', {
  alpha: 0.6,  // High keyword weight  
  beta: 0.4    // Lower semantic weight
});

// Balanced approach (general purpose)
const balancedQuery = await semanticSearch.hybridSearchDocuments('apple financial performance', {
  alpha: 0.3,  // Default balanced weights
  beta: 0.7
});
```

## Database Functions

The implementation adds these PostgreSQL functions:

### Core Functions
- `fulltext_search()`: BM25-style ranking using PostgreSQL's ts_rank_cd
- `fulltext_search_documents()`: Convenience function for documents table
- `hybrid_search()`: Server-side hybrid scoring with normalization
- `hybrid_search_documents()`: Optimized hybrid search for documents table

### Installation
Run the new SQL migration file after existing ones:
```sql
-- Run in Supabase Dashboard > SQL Editor
-- supabase-semantic-search-sql/06_hybrid_search_functions.sql
```

## Score Calculation

### Formula
```
final_score = α * normalized_bm25_score + β * normalized_vector_score
```

Where:
- `α` (alpha) = weight for BM25/keyword matching (default: 0.3)
- `β` (beta) = weight for vector similarity (default: 0.7)  
- `α + β = 1.0` (weights should sum to 1 for best results)

### Normalization Methods

1. **min-max** (default): Scales scores to 0-1 range
2. **z-score**: Standardizes scores using mean and standard deviation  
3. **none**: Uses raw scores without normalization

## Architecture

### Server-side Processing (Default)
- Uses PostgreSQL functions for optimal performance
- Single query combines vector and full-text search
- Server-side score normalization and ranking
- Recommended for production use

### Client-side Processing (Custom normalization)
- Runs separate vector and full-text queries in parallel
- Merges and normalizes results in TypeScript
- Supports custom normalization methods
- Used when normalization != 'min-max'

## Performance Characteristics

### Advantages over Pure Vector Search
- **Exact Match Precision**: Catches specific terms, names, numbers that vectors might miss
- **Reduced Hallucination**: BM25 provides grounding in actual document keywords  
- **Better Enterprise Relevance**: Handles domain-specific terminology and acronyms

### Advantages over Pure Keyword Search  
- **Semantic Understanding**: Finds conceptually related content
- **Query Expansion**: Works with natural language queries
- **Synonym Handling**: Matches related terms and concepts

## Production Considerations

### Query Type Optimization
```typescript
// For queries with specific terms/numbers - favor BM25
if (query.match(/\d{4}|Q[1-4]|[A-Z]{3,}/)) {
  options.alpha = 0.5; // Higher keyword weight
  options.beta = 0.5;
}

// For conceptual queries - favor semantic
if (query.includes('strategy') || query.includes('approach')) {
  options.alpha = 0.2; // Lower keyword weight  
  options.beta = 0.8;
}
```

### Performance Tuning
- Use `topK * 2` internally to get better scoring distribution
- Server-side functions are ~2x faster than client-side merging
- Consider caching for frequently used queries
- Monitor both BM25 and vector scores to tune weights

## Migration Guide

### From Pure Vector Search
```typescript
// Before (vector only)
const results = await semanticSearch.searchDocuments('apple earnings');

// After (hybrid search)  
const results = await semanticSearch.hybridSearchDocuments('apple earnings', {
  alpha: 0.3,  // Add keyword matching
  beta: 0.7    // Keep semantic similarity
});
```

### New Result Format
```typescript
interface HybridSearchResultItem {
  // Original document fields
  id: string;
  content: string;
  
  // New hybrid scoring fields
  hybrid_score: number;  // Combined score
  bm25_score: number;    // Keyword matching score  
  vector_score: number;  // Semantic similarity score
}
```

## Use Cases

### Ideal for Hybrid Search
- **Enterprise Documents**: Mix of technical terms and concepts
- **Financial Reports**: Specific numbers + conceptual analysis  
- **Legal Documents**: Exact terminology + semantic understanding
- **Customer Support**: Product names + problem descriptions
- **Research Papers**: Citations + conceptual relationships

### When to Use Pure Vector
- **Conversational Queries**: Natural language questions
- **Broad Topic Discovery**: Exploring related concepts
- **Cross-language Search**: Semantic similarity across languages

### When to Use Pure Keyword  
- **Exact Code Search**: Function names, variables
- **Regulatory Compliance**: Specific required terminology
- **Database Queries**: Structured data lookup