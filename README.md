# Supabase Semantic Search Plugin MVP

A simple, functional semantic search plugin for Supabase that automatically handles embeddings and provides easy-to-use search capabilities.

## Features

- 🔄 Automatic embedding generation for text columns
- 🚀 Queue-based processing with Supabase Edge Functions
- 🔍 Simple semantic search API
- 📊 OpenAI text-embedding-3-small integration
- ⚡ Vector similarity search with pgvector

## Quick Start

### 1. Database Setup

Run the SQL migrations in order:

```bash
psql -h your-db-host -U your-user -d your-db -f sql/01_extensions.sql
psql -h your-db-host -U your-user -d your-db -f sql/02_register_embedding_function.sql
psql -h your-db-host -U your-user -d your-db -f sql/03_trigger_function.sql
psql -h your-db-host -U your-user -d your-db -f sql/04_search_functions.sql
psql -h your-db-host -U your-user -d your-db -f sql/05_example_table.sql
```

### 2. Deploy Edge Function

```bash
supabase functions deploy embed-worker --project-ref your-project-ref
```

Set environment variables:
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 3. Use the SDK

```typescript
import { createSemanticSearch } from 'supabase-semantic-search';

const semanticSearch = createSemanticSearch(
  'your-supabase-url',
  'your-supabase-anon-key',
  'your-openai-api-key'
);

// Search documents
const results = await semanticSearch.searchDocuments('contract renewal', {
  topK: 5,
  threshold: 0.7
});

console.log(results.data);
```

### 4. Register New Tables

```sql
SELECT register_embedding('your_table', 'your_text_column');
```

## How It Works

1. **Registration**: Call `register_embedding()` to set up a table column for automatic embedding
2. **Triggers**: When text data is inserted/updated, a trigger queues an embedding job
3. **Worker**: The Edge Function processes jobs, generates embeddings via OpenAI, and updates rows
4. **Search**: Use the SDK to perform semantic searches with automatic query embedding

## Environment Variables

```bash
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-api-key
```

## Build

```bash
npm install
npm run build
```

## Test

```bash
npm test
```

## Architecture

```
Insert/Update → Trigger → Queue → Edge Function → OpenAI → Update Embedding → Search
```

Simple, robust, functional.