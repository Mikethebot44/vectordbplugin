# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Supabase Semantic Search Plugin that provides automatic embedding generation and vector similarity search capabilities. The plugin integrates OpenAI's text-embedding-3-small model with Supabase's pgvector extension for semantic search functionality.

## Key Architecture Components

### Core SDK (`src/index.ts`)
- `SupabaseSemanticSearch` class: Main API for semantic search operations
- `createSemanticSearch()`: Factory function for creating instances
- Supports both generic table search via `semanticSearch()` and document-specific search via `searchDocuments()`
- Handles embedding generation, similarity search, and table registration

### Queue-Based Processing System
- **Database Triggers**: Automatically queue embedding jobs when text columns are updated
- **Edge Function Worker** (`supabase/functions/embed-worker/`): Processes queues jobs asynchronously
- **PGMQ Integration**: Uses PostgreSQL message queue for reliable job processing

### SQL Infrastructure (`sql/` directory)
- `01_extensions.sql`: Enables pgvector and pgmq extensions
- `02_register_embedding_function.sql`: Core function for registering tables/columns for embedding
- `03_trigger_function.sql`: Database trigger that queues embedding jobs
- `04_search_functions.sql`: Semantic search functions (`semantic_search`, `search_documents`)
- `05_example_table.sql`: Example documents table setup

### CLI Tool (`src/cli.ts`)
- Project initialization tool accessible via `npx supabase-semantic-search init`
- Copies SQL migrations, Edge Functions, and creates example files

## Development Commands

### Build System
```bash
npm run build          # Full build (CJS + ESM + CLI + post-processing)
npm run build:cjs      # CommonJS build only
npm run build:esm      # ES modules build only
npm run build:cli      # CLI build only
npm run clean          # Remove dist folder
```

### Development
```bash
npm run dev            # TypeScript watch mode
npm test               # Run validation tests
```

### Publishing
```bash
npm run prepublishOnly # Build + test before publishing
```

## Build Configuration

The project uses multiple TypeScript configurations:
- `tsconfig.json`: Base configuration
- `tsconfig.cjs.json`: CommonJS output (`dist/index.js`)
- `tsconfig.esm.json`: ES modules output (`dist/index.mjs`)  
- `tsconfig.cli.json`: CLI executable output (`dist/cli.js`)

Post-build processing via `scripts/fix-esm.js` adds `.mjs` extensions to ESM imports.

## Testing

The test system (`test/example.js`) validates:
- Module imports and exports
- Instance creation with credentials (if env vars provided)
- Basic search functionality (expects database setup)

Environment variables for testing:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` 
- `OPENAI_API_KEY`

## Database Setup Workflow

1. Run SQL migrations in order (01-05)
2. Deploy Edge Function with environment variables
3. Use `register_embedding(table_name, column_name)` to enable automatic embeddings
4. Insert/update text data triggers automatic embedding generation

## Architecture Pattern

```
Text Insert/Update → Database Trigger → PGMQ Queue → Edge Function → OpenAI API → Update Embedding → Vector Search
```

The system is designed to be simple, robust, and functional with minimal configuration required from users.