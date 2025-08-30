#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { createSemanticSearch } from './index';
import * as dotenv from 'dotenv';

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

  // Semantic search example
  console.log('🔍 Semantic Search Results:');
  const semanticResults = await semanticSearch.searchDocuments('machine learning algorithms', {
    topK: 5,
    threshold: 0.7
  });

  if (semanticResults.error) {
    console.error('Semantic search failed:', semanticResults.error);
  } else {
    console.log('Semantic results:', semanticResults.data);
  }

  // Hybrid search example - combines semantic + keyword matching
  console.log('\\n🔍 Hybrid Search Results:');
  const hybridResults = await semanticSearch.hybridSearchDocuments('apple earnings report', {
    topK: 5,
    alpha: 0.3,  // 30% weight for keyword/BM25 matching
    beta: 0.7,   // 70% weight for semantic similarity
    threshold: 0.1
  });

  if (hybridResults.error) {
    console.error('Hybrid search failed:', hybridResults.error);
  } else {
    hybridResults.data?.forEach((doc, i) => {
      console.log(\`\${i+1}. Score: \${doc.hybrid_score.toFixed(3)} (BM25: \${doc.bm25_score.toFixed(3)}, Vector: \${doc.vector_score.toFixed(3)})\`);
      console.log(\`   Content: \${doc.content.substring(0, 100)}...\\n\`);
    });
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

async function showStatus() {
  // Load environment variables
  dotenv.config();
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!supabaseUrl || !supabaseKey || !openaiKey) {
    console.error(`❌ Missing required environment variables:
    
Required:
  - SUPABASE_URL=${supabaseUrl ? '✅' : '❌'}
  - SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY=${supabaseKey ? '✅' : '❌'}
  - OPENAI_API_KEY=${openaiKey ? '✅' : '❌'}
  
💡 Make sure your .env file is configured correctly.`);
    process.exit(1);
  }
  
  try {
    console.log('🔍 Checking embedding queue status...\n');
    
    const semanticSearch = createSemanticSearch(supabaseUrl, supabaseKey, openaiKey);
    
    // Get queue status
    const queueStatus = await semanticSearch.getQueueStatus();
    if (queueStatus.error) {
      console.error('❌ Failed to get queue status:', queueStatus.error);
      return;
    }
    
    const status = queueStatus.data;
    if (!status) {
      console.error('❌ No status data received');
      return;
    }
    
    console.log('📊 Queue Status:');
    console.log(`   Pending: ${status.queue.pending_messages} jobs`);
    console.log(`   Processing: ${status.queue.processing_messages} jobs`);
    console.log(`   Total in queue: ${status.queue.total_messages} jobs\n`);
    
    console.log('📈 Processing Metrics (24h):');
    console.log(`   Completed: ${status.processing.completed_today} jobs`);
    console.log(`   Failed: ${status.processing.failed_today} jobs`);
    console.log(`   Success rate: ${status.processing.success_rate_24h}%`);
    console.log(`   Avg processing time: ${status.processing.avg_processing_time_ms}ms\n`);
    
    console.log('⚠️  Failure Analysis:');
    console.log(`   Recent failures (1h): ${status.failures.recent_failures}`);
    console.log(`   Stuck jobs: ${status.failures.stuck_jobs}`);
    
    if (Object.keys(status.failures.failure_types).length > 0) {
      console.log('   Failure types:');
      Object.entries(status.failures.failure_types).forEach(([type, count]) => {
        console.log(`     ${type}: ${count}`);
      });
    }
    
    // Get recent failed jobs
    const failedJobs = await semanticSearch.getFailedJobs(false);
    if (failedJobs.data && failedJobs.data.length > 0) {
      console.log(`\n❌ Recent Failed Jobs (${Math.min(5, failedJobs.data.length)} of ${failedJobs.data.length}):`);
      failedJobs.data.slice(0, 5).forEach((job, i) => {
        console.log(`   ${i + 1}. Table: ${job.table_name}, Row: ${job.row_id}`);
        console.log(`      Error: ${job.error_type} - ${job.error_message?.substring(0, 80)}...`);
        console.log(`      Can retry: ${job.can_retry ? '✅' : '❌'}\n`);
      });
    }
    
    console.log(`🕐 Last updated: ${new Date(status.last_updated).toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Status check failed:', error);
    process.exit(1);
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
   # supabase-semantic-search-sql/06_hybrid_search_functions.sql
   # supabase-semantic-search-sql/07_observability_functions.sql

3. 🚀 Deploy Edge Function:
   supabase functions deploy embed-worker --project-ref your-project-ref
   # Copy from: supabase-semantic-search-functions/functions/embed-worker/

4. 🧪 Test with the example:
   node semantic-search-example.js

📚 Documentation: https://github.com/mjupp/supabase-semantic-search
      `);
      break;
      
    case 'status':
      await showStatus();
      break;
      
    case 'help':
    case '--help':
    case '-h':
      console.log(`
Usage: npx supabase-semantic-search [command]

Commands:
  init     Initialize semantic search setup (default)
  status   Show embedding queue status and metrics
  help     Show this help message

Examples:
  npx supabase-semantic-search init
  npx supabase-semantic-search status
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