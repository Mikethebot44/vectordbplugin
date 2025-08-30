#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const PACKAGE_ROOT = path.join(__dirname, '..');

function printBanner() {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║         Supabase Semantic Search Setup               ║
║                                                       ║
║  Initialize your project with semantic search        ║
║  capabilities using OpenAI embeddings and pgvector   ║
╚═══════════════════════════════════════════════════════╝
  `);
}

function copyFile(src: string, dest: string, description: string) {
  try {
    const content = fs.readFileSync(src, 'utf8');
    fs.writeFileSync(dest, content);
    console.log(`✅ ${description}`);
  } catch (error) {
    console.error(`❌ Failed to copy ${description}:`, error);
  }
}

function copyDirectory(src: string, dest: string, description: string) {
  try {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const files = fs.readdirSync(src);
    files.forEach(file => {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      
      if (fs.statSync(srcPath).isDirectory()) {
        copyDirectory(srcPath, destPath, `${description}/${file}`);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
    
    console.log(`✅ ${description}`);
  } catch (error) {
    console.error(`❌ Failed to copy ${description}:`, error);
  }
}

function createEnvTemplate() {
  const envTemplate = `# Supabase Configuration
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Usage Example:
# SUPABASE_URL=https://abcdefgh.supabase.co
# SUPABASE_ANON_KEY=eyJhbGc...
# OPENAI_API_KEY=sk-...
`;

  try {
    if (!fs.existsSync('.env.example')) {
      fs.writeFileSync('.env.example', envTemplate);
      console.log('✅ Created .env.example template');
    } else {
      console.log('⚠️  .env.example already exists, skipping');
    }
  } catch (error) {
    console.error('❌ Failed to create .env.example:', error);
  }
}

function createExampleUsage() {
  const exampleCode = `import { createSemanticSearch } from 'supabase-semantic-search';

async function example() {
  const semanticSearch = createSemanticSearch(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    process.env.OPENAI_API_KEY!
  );

  // Register a table for semantic search
  await semanticSearch.registerEmbedding('documents', 'content');

  // Search for similar content
  const results = await semanticSearch.searchDocuments('machine learning algorithms', {
    topK: 5,
    threshold: 0.7
  });

  if (results.error) {
    console.error('Search failed:', results.error);
  } else {
    console.log('Search results:', results.data);
  }
}

example().catch(console.error);
`;

  try {
    if (!fs.existsSync('semantic-search-example.js')) {
      fs.writeFileSync('semantic-search-example.js', exampleCode);
      console.log('✅ Created semantic-search-example.js');
    } else {
      console.log('⚠️  semantic-search-example.js already exists, skipping');
    }
  } catch (error) {
    console.error('❌ Failed to create example file:', error);
  }
}

async function main() {
  printBanner();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'init':
    case undefined:
      console.log('🚀 Setting up Supabase Semantic Search...\n');
      
      // Copy SQL files
      const sqlSrc = path.join(PACKAGE_ROOT, 'sql');
      const sqlDest = './supabase-semantic-search-sql';
      if (fs.existsSync(sqlSrc)) {
        copyDirectory(sqlSrc, sqlDest, 'SQL migration files');
      }
      
      // Copy Supabase Edge Function
      const functionSrc = path.join(PACKAGE_ROOT, 'supabase');
      const functionDest = './supabase-semantic-search-functions';
      if (fs.existsSync(functionSrc)) {
        copyDirectory(functionSrc, functionDest, 'Supabase Edge Function');
      }
      
      // Create environment template
      createEnvTemplate();
      
      // Create example usage
      createExampleUsage();
      
      console.log(`
🎉 Setup complete! Next steps:

1. 📝 Configure your environment:
   cp .env.example .env
   # Edit .env with your actual keys

2. 🗄️  Run SQL migrations on your Supabase database:
   # In Supabase Dashboard > SQL Editor, run files in order:
   # supabase-semantic-search-sql/01_extensions.sql
   # supabase-semantic-search-sql/02_register_embedding_function.sql
   # supabase-semantic-search-sql/03_trigger_function.sql
   # supabase-semantic-search-sql/04_search_functions.sql
   # supabase-semantic-search-sql/05_example_table.sql

3. 🚀 Deploy Edge Function:
   supabase functions deploy embed-worker --project-ref your-project-ref
   # Copy from: supabase-semantic-search-functions/functions/embed-worker/

4. 🧪 Test with the example:
   node semantic-search-example.js

📚 Documentation: https://github.com/mjupp/supabase-semantic-search
      `);
      break;
      
    case 'help':
    case '--help':
    case '-h':
      console.log(`
Usage: npx supabase-semantic-search [command]

Commands:
  init     Initialize semantic search setup (default)
  help     Show this help message

Examples:
  npx supabase-semantic-search init
  npx supabase-semantic-search help
      `);
      break;
      
    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log('Run "npx supabase-semantic-search help" for usage information.');
      process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});