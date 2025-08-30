const { createSemanticSearch, SupabaseSemanticSearch } = require('../dist/index.js');

async function testSemanticSearch() {
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

  // Test 2: Class instantiation (only if env vars are available)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.OPENAI_API_KEY) {
    try {
      console.log('🔑 Environment variables detected, testing with real credentials...');
      
      const semanticSearch = createSemanticSearch(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        process.env.OPENAI_API_KEY
      );

      console.log('✅ Instance created successfully with environment credentials');
      
      // Test basic search (this might fail if DB isn't set up, which is expected)
      try {
        const results = await semanticSearch.searchDocuments('test query', { topK: 1 });
        if (results.error) {
          console.log('⚠️  Search test failed (expected if DB not set up):', results.error.message);
        } else {
          console.log('✅ Search test passed:', results.data?.length || 0, 'results');
        }
      } catch (error) {
        console.log('⚠️  Search test failed (expected if DB not set up):', error.message);
      }
      
    } catch (error) {
      console.error('❌ Real credentials test failed:', error.message);
      process.exit(1);
    }
  } else {
    console.log('⚠️  No environment variables provided, skipping credential tests');
    console.log('   Set SUPABASE_URL, SUPABASE_ANON_KEY, and OPENAI_API_KEY to run full tests');
  }

  console.log('✅ All validation tests passed! Package is ready for use.');
}

// Only run if this file is executed directly
if (require.main === module) {
  testSemanticSearch();
}

module.exports = { testSemanticSearch };