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

# AI Provider Configuration (choose one as primary)
AI_PROVIDER=openai
AI_MODEL=text-embedding-3-small

# Provider API Keys (add keys for providers you want to use)
OPENAI_API_KEY=your-openai-api-key
COHERE_API_KEY=your-cohere-api-key
VOYAGE_API_KEY=your-voyage-api-key
# ANTHROPIC_API_KEY=your-anthropic-key  # Coming soon

# Fallback Configuration
ENABLE_FALLBACK=true
FALLBACK_PROVIDERS=[{"provider": "cohere", "model": "embed-english-v3.0"}]

# Provider Examples:
# For OpenAI (recommended for general use):
# AI_PROVIDER=openai
# OPENAI_API_KEY=sk-...

# For Cohere (great for multilingual):
# AI_PROVIDER=cohere
# COHERE_API_KEY=your-cohere-key
# AI_MODEL=embed-multilingual-v3.0

# For Voyage (excellent for code):
# AI_PROVIDER=voyage  
# VOYAGE_API_KEY=your-voyage-key
# AI_MODEL=voyage-code-2

# With fallback (automatically switch on errors):
# ENABLE_FALLBACK=true
# FALLBACK_PROVIDERS=[{"provider": "cohere"}]
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

function createConfigTemplate() {
  const configTemplate = {
    "supabase": {
      "url": "https://your-project.supabase.co",
      "anonKey": "your-anon-key"
    },
    "aiProvider": {
      "primary": {
        "provider": "openai",
        "apiKey": "sk-your-openai-key",
        "model": "text-embedding-3-small"
      },
      "fallbacks": [
        {
          "provider": "cohere",
          "apiKey": "your-cohere-key",
          "model": "embed-english-v3.0"
        }
      ],
      "enableFallback": true
    },
    "search": {
      "defaultTopK": 5,
      "defaultThreshold": 0.7,
      "hybridSearch": {
        "alpha": 0.3,
        "beta": 0.7,
        "normalization": "min-max"
      }
    }
  };

  try {
    if (!fs.existsSync('semantic-search.config.json')) {
      fs.writeFileSync('semantic-search.config.json', JSON.stringify(configTemplate, null, 2));
      console.log('✅ Created semantic-search.config.json template');
    } else {
      console.log('⚠️  semantic-search.config.json already exists, skipping');
    }
  } catch (error) {
    console.error('❌ Failed to create config template:', error);
  }
}

function createExampleUsage() {
  const exampleCode = `import { 
  createSemanticSearch, 
  createSemanticSearchWithProvider, 
  createWithCohere,
  SupabaseSemanticSearch 
} from 'supabase-semantic-search';

async function example() {
  // Example 1: Legacy OpenAI usage (backward compatible)
  const semanticSearch = createSemanticSearch(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    process.env.OPENAI_API_KEY!
  );

  // Example 2: Multi-model with configuration
  const multiModelSearch = createSemanticSearchWithProvider({
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

  // Example 3: Provider-specific convenience function
  const cohereSearch = createWithCohere(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    process.env.COHERE_API_KEY!,
    'embed-multilingual-v3.0'  // Great for multilingual content
  );

  // Register a table for semantic search
  await semanticSearch.registerEmbedding('documents', 'content');

  // Get provider information
  console.log('🤖 Current Provider:', semanticSearch.getProviderInfo());
  
  // Get provider recommendations
  const codeRec = SupabaseSemanticSearch.getProviderRecommendation('code');
  console.log('📋 Code Recommendation:', codeRec);

  // Semantic search example
  console.log('\\n🔍 Semantic Search Results:');
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

  // Provider switching example
  console.log('\\n🔄 Switching to Voyage for code search:');
  if (process.env.VOYAGE_API_KEY) {
    semanticSearch.switchProvider({
      provider: 'voyage',
      apiKey: process.env.VOYAGE_API_KEY,
      model: 'voyage-code-2'
    });
    
    console.log('New provider:', semanticSearch.getProviderInfo().provider);
  }

  // Validate all providers
  console.log('\\n✅ Provider Validation:');
  const validationResults = await multiModelSearch.validateProviders();
  validationResults.forEach(result => {
    console.log(\`   \${result.provider}: \${result.isValid ? '✅ OK' : '❌ Failed'}\`);
  });
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
      
      // Create JSON configuration template
      createConfigTemplate();
      
      // Create example usage
      createExampleUsage();
      
      console.log(`
🎉 Setup complete! Next steps:

1. 📝 Configure your environment (choose one):
   
   Option A - Environment Variables:
   cp .env.example .env
   # Edit .env with your actual keys and preferred AI provider
   
   Option B - JSON Configuration:
   # Edit semantic-search.config.json with your settings
   # Supports multiple providers and fallbacks

2. 🗄️  Run SQL migrations on your Supabase database:
   # In Supabase Dashboard > SQL Editor, run files in order:
   # supabase-semantic-search-sql/01_extensions.sql
   # supabase-semantic-search-sql/02_register_embedding_function.sql
   # supabase-semantic-search-sql/03_trigger_function.sql
   # supabase-semantic-search-sql/04_search_functions.sql
   # supabase-semantic-search-sql/05_example_table.sql
   # supabase-semantic-search-sql/06_hybrid_search_functions.sql
   # supabase-semantic-search-sql/07_multi_model_support.sql

3. 🚀 Deploy Edge Function:
   supabase functions deploy embed-worker --project-ref your-project-ref
   # Copy from: supabase-semantic-search-functions/functions/embed-worker/

4. 🧪 Test with the example:
   node semantic-search-example.js

🤖 AI Provider Options:
   • OpenAI: Best overall, reliable (text-embedding-3-small)
   • Cohere: Great for multilingual (embed-multilingual-v3.0)
   • Voyage: Excellent for code (voyage-code-2)
   • Anthropic: Coming soon

💡 New Features:
   ✨ Multi-provider support with automatic fallbacks
   ✨ Hybrid search (semantic + keyword matching)
   ✨ Provider switching and migration tools
   ✨ Configuration-driven setup

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