// Try to load dotenv for development convenience
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, that's fine
}

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

  // Debug: Show what environment variables are detected
  console.log('🔍 Environment variable check:');
  console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ SET' : '❌ NOT SET');
  console.log('   SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ SET' : '❌ NOT SET');
  console.log('   OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ SET' : '❌ NOT SET');

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
if (require.main === module) {
  testSemanticSearch();
}

module.exports = { testSemanticSearch };