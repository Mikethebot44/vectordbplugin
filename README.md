# Supabase Semantic Search

A semantic search plugin for Supabase that provides automatic embedding generation and vector similarity search capabilities. Built with OpenAI's text-embedding-3-small model and Supabase's pgvector extension.

## Features

- Automatic embedding generation for text columns
- Queue-based processing with Supabase Edge Functions  
- Simple semantic search API
- Hybrid search combining semantic and keyword search
- OpenAI text-embedding-3-small integration
- Vector similarity search with pgvector
- PostgreSQL message queue (PGMQ) for reliable job processing

## Installation

Install the package via npm:

```bash
npm install supabase-semantic-search
```

## Initialization

Use the CLI tool to initialize your project with the necessary SQL migrations and Edge Functions:

```bash
npx supabase-semantic-search init
```

This command will:
- Copy SQL migration files to your project
- Copy the Edge Function worker to your Supabase functions directory
- Create example files and documentation

## Setup

### 1. Run SQL Migrations

After initialization, run the SQL migrations in order:

```bash
# Using Supabase CLI (recommended)
supabase db reset

# Or manually with psql
psql -h your-db-host -U your-user -d your-db -f sql/01_extensions.sql
psql -h your-db-host -U your-user -d your-db -f sql/02_register_embedding_function.sql
psql -h your-db-host -U your-user -d your-db -f sql/03_trigger_function.sql
psql -h your-db-host -U your-user -d your-db -f sql/04_search_functions.sql
psql -h your-db-host -U your-user -d your-db -f sql/05_example_table.sql
psql -h your-db-host -U your-user -d your-db -f sql/06_hybrid_search_functions.sql
psql -h your-db-host -U your-user -d your-db -f sql/07_observability_functions.sql
```

### 2. Deploy Edge Function

Deploy the embedding worker Edge Function:

```bash
supabase functions deploy embed-worker --project-ref your-project-ref
```

### 3. Set Environment Variables

Configure the following environment variables for your Edge Function:

```bash
# In your Supabase dashboard or via CLI
supabase secrets set OPENAI_API_KEY=your-openai-api-key
supabase secrets set SUPABASE_URL=your-supabase-project-url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Register Tables for Embedding

Register any table and text column for automatic embedding generation:

```sql
SELECT register_embedding('your_table_name', 'your_text_column');
```

## Usage

### Basic Setup

```typescript
import { createSemanticSearch } from 'supabase-semantic-search';

const semanticSearch = createSemanticSearch(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  process.env.OPENAI_API_KEY
);
```

### Document Search

Search the default `documents` table:

```typescript
// Basic semantic search
const results = await semanticSearch.searchDocuments('contract renewal', {
  topK: 5,
  threshold: 0.7
});

console.log(results.data);
// Returns: Array of documents with similarity scores
```

### Generic Table Search

Search any registered table:

```typescript
// Search custom table
const results = await semanticSearch.semanticSearch(
  'articles', 
  'content', 
  'machine learning trends',
  {
    topK: 10,
    threshold: 0.8
  }
);
```

### Hybrid Search

Combine semantic search with keyword search for better results:

```typescript
// Hybrid search (semantic + keyword)
const hybridResults = await semanticSearch.hybridSearchDocuments('apple earnings', {
  topK: 5,
  alpha: 0.3,    // Weight for keyword search (BM25)
  beta: 0.7,     // Weight for semantic search
  threshold: 0.6
});

console.log(hybridResults.data);
// Returns: Documents with combined semantic and keyword scores
```

### Advanced Usage

#### Custom Search Options

```typescript
const results = await semanticSearch.searchDocuments('query', {
  topK: 20,           // Number of results to return
  threshold: 0.75,    // Minimum similarity threshold
  filter: {           // Additional filters
    category: 'legal',
    status: 'active'
  }
});
```

#### Error Handling

```typescript
try {
  const results = await semanticSearch.searchDocuments('query');
  
  if (results.error) {
    console.error('Search error:', results.error);
  } else {
    console.log('Results:', results.data);
  }
} catch (error) {
  console.error('Network error:', error);
}
```

## API Reference

### `createSemanticSearch(url, anonKey, openaiKey)`

Creates a new semantic search instance.

**Parameters:**
- `url` (string): Your Supabase project URL
- `anonKey` (string): Your Supabase anonymous key
- `openaiKey` (string): Your OpenAI API key

### `searchDocuments(query, options?)`

Search the documents table for similar content.

**Parameters:**
- `query` (string): Search query text
- `options` (object, optional):
  - `topK` (number): Maximum results to return (default: 10)
  - `threshold` (number): Minimum similarity score (default: 0.5)
  - `filter` (object): Additional SQL filters

### `hybridSearchDocuments(query, options?)`

Perform hybrid search combining semantic and keyword search.

**Parameters:**
- `query` (string): Search query text
- `options` (object, optional):
  - `topK` (number): Maximum results to return (default: 10)
  - `alpha` (number): Weight for keyword search (default: 0.5)
  - `beta` (number): Weight for semantic search (default: 0.5)
  - `threshold` (number): Minimum combined score (default: 0.5)

### `semanticSearch(table, column, query, options?)`

Search any registered table for similar content.

**Parameters:**
- `table` (string): Table name to search
- `column` (string): Text column name
- `query` (string): Search query text
- `options` (object, optional): Same as `searchDocuments`

## Development

### Build

```bash
npm install
npm run build
```

### Test

```bash
npm test
```

Set up environment variables for testing:

```bash
# Create .env file
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key  
OPENAI_API_KEY=your-openai-api-key
```

### Development Commands

```bash
npm run dev          # TypeScript watch mode
npm run build:cjs    # Build CommonJS version
npm run build:esm    # Build ES modules version
npm run build:cli    # Build CLI tool
npm run clean        # Remove dist folder
```

## Architecture

The system follows this flow:

```
Text Insert/Update → Database Trigger → PGMQ Queue → Edge Function → OpenAI API → Update Embedding → Vector Search
```

### Components

1. **Database Triggers**: Automatically queue embedding jobs when text columns are updated
2. **Edge Function Worker**: Processes embedding jobs asynchronously using PGMQ
3. **Vector Storage**: Embeddings stored as pgvector columns for fast similarity search
4. **Search Functions**: SQL functions for semantic and hybrid search operations

## Contributing

We welcome contributions! Please follow these steps:

### Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/supabase-semantic-search.git`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/your-feature-name`

### Development Setup

1. Set up environment variables in `.env`:
   ```bash
   SUPABASE_URL=your-test-supabase-url
   SUPABASE_ANON_KEY=your-test-anon-key
   OPENAI_API_KEY=your-openai-key
   ```

2. Run tests to ensure everything works:
   ```bash
   npm test
   ```

### Making Changes

1. Make your changes
2. Add tests for new functionality
3. Ensure all tests pass: `npm test`
4. Build the project: `npm run build`
5. Update documentation if needed

### Submitting Changes

1. Commit your changes with a clear message
2. Push to your fork: `git push origin feature/your-feature-name`  
3. Create a Pull Request with:
   - Clear description of changes
   - Any breaking changes noted
   - Test results

### Code Style

- Follow existing TypeScript conventions
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions focused and single-purpose

### Areas for Contribution

- Additional embedding providers (Azure OpenAI, Anthropic, etc.)
- Performance optimizations
- Enhanced search filtering options
- Better error handling and logging
- Documentation improvements
- Example applications

## License

MIT License - see LICENSE file for details.