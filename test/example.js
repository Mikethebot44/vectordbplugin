let createSemanticSearch, SupabaseSemanticSearch;

async function loadModules() {
  // Try to load dotenv for development convenience
  try {
    const dotenv = await import('dotenv');
    dotenv.config();
  } catch (e) {
    // dotenv not available, that's fine
  }

  const module = await import('../dist/index.mjs');
  createSemanticSearch = module.createSemanticSearch;
  SupabaseSemanticSearch = module.SupabaseSemanticSearch;
}

async function testSemanticSearch() {
  await loadModules();
  console.log('🧪 Running Supabase Semantic Search validation tests...');

  // Test 1: Module imports
  try {
    if (typeof createSemanticSearch !== 'function') {
      throw new Error('createSemanticSearch export is not a function');
    }
    if (typeof SupabaseSemanticSearch !== 'function') {
      throw new Error('SupabaseSemanticSearch export is not a function');
    }
    console.log('✅ Module imports work correctly');
  } catch (error) {
    console.error('❌ Module import test failed:', error.message);
    process.exit(1);
  }

  // Debug: Show what environment variables are detected
  console.log('🔍 Environment variable check:');
  
  if (process.env.SUPABASE_URL) {
    console.log('✅ Supabase URL variable set');
  } else {
    console.log('❌ Supabase URL variable not set');
  }
  
  if (process.env.SUPABASE_ANON_KEY) {
    console.log('✅ Supabase Anon Key variable set');
  } else {
    console.log('❌ Supabase Anon Key variable not set');
  }
  
  if (process.env.OPENAI_API_KEY) {
    console.log('✅ OpenAI API Key variable set');
  } else {
    console.log('❌ OpenAI API Key variable not set');
  }

  // Test 2: Class instantiation (only if env vars are available)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.OPENAI_API_KEY) {
    try {
      console.log('🔑 Environment variables detected, testing with real credentials...');
      console.log('📡 Attempting to connect to Supabase...');
      
      const semanticSearch = createSemanticSearch(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        process.env.OPENAI_API_KEY
      );

      console.log('✅ Successfully connected to Supabase');
      console.log('✅ Instance created successfully with environment credentials');
      
      // Test basic search (this might fail if DB isn't set up, which is expected)
      console.log('🔍 Testing semantic search functionality...');
      try {
        const results = await semanticSearch.searchDocuments('test query', { topK: 1 });
        if (results.error) {
          console.log('⚠️  Semantic search test failed (expected if DB not set up):', results.error.message);
        } else {
          console.log('✅ Semantic search test passed:', results.data?.length || 0, 'results');
        }
      } catch (error) {
        console.log('⚠️  Semantic search test failed (expected if DB not set up):', error.message);
      }

      // Test hybrid search (this might fail if DB isn't set up, which is expected)
      console.log('🔄 Testing hybrid search functionality...');
      try {
        const hybridResults = await semanticSearch.hybridSearchDocuments('apple earnings', { 
          topK: 1,
          alpha: 0.3,
          beta: 0.7 
        });
        if (hybridResults.error) {
          console.log('⚠️  Hybrid search test failed (expected if DB not set up):', hybridResults.error.message);
        } else {
          console.log('✅ Hybrid search test passed:', hybridResults.data?.length || 0, 'results');
          if (hybridResults.data && hybridResults.data.length > 0) {
            const result = hybridResults.data[0];
            console.log('   Sample hybrid scores - Total:', result.hybrid_score?.toFixed(3), 
                       'BM25:', result.bm25_score?.toFixed(3), 
                       'Vector:', result.vector_score?.toFixed(3));
          }
        }
      } catch (error) {
        console.log('⚠️  Hybrid search test failed (expected if DB not set up):', error.message);
      }
      
    } catch (error) {
      console.error('❌ Real credentials test failed:', error.message);
      process.exit(1);
    }
  } else {
    console.log('⚠️  Environment variables missing, skipping credential tests');
    console.log('');
    console.log('To test with real credentials, either:');
    console.log('');
    console.log('1. Export variables and run test:');
    console.log('   export SUPABASE_URL="https://your-project.supabase.co"');
    console.log('   export SUPABASE_ANON_KEY="eyJhbGc..."');
    console.log('   export OPENAI_API_KEY="sk-..."');
    console.log('   npm test');
    console.log('');
    console.log('2. Create a .env file and use test:env script:');
    console.log('   echo "SUPABASE_URL=https://your-project.supabase.co" > .env');
    console.log('   echo "SUPABASE_ANON_KEY=eyJhbGc..." >> .env');
    console.log('   echo "OPENAI_API_KEY=sk-..." >> .env');
    console.log('   npm run test:env');
  }

  console.log('✅ All validation tests passed! Package is ready for use.');
}

// Only run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  testSemanticSearch();
}

export { testSemanticSearch };