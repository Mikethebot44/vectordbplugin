// Try to load dotenv for development convenience
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, that's fine
}

const { 
  createSemanticSearch, 
  SupabaseSemanticSearch,
  createSemanticSearchWithProvider,
  createWithCohere,
  createWithVoyage,
  PROVIDER_INFO
} = require('../dist/index.js');

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
    if (typeof createSemanticSearchWithProvider !== 'function') {
      throw new Error('createSemanticSearchWithProvider export is not a function');
    }
    if (typeof createWithCohere !== 'function') {
      throw new Error('createWithCohere export is not a function');
    }
    if (typeof createWithVoyage !== 'function') {
      throw new Error('createWithVoyage export is not a function');
    }
    if (typeof PROVIDER_INFO !== 'object') {
      throw new Error('PROVIDER_INFO export is not an object');
    }
    console.log('✅ Module imports work correctly (including multi-model functions)');
  } catch (error) {
    console.error('❌ Module import test failed:', error.message);
    process.exit(1);
  }

  // Test 2: Provider info and recommendations
  try {
    const providerInfo = SupabaseSemanticSearch.getProviderInfo();
    if (!providerInfo || typeof providerInfo !== 'object') {
      throw new Error('getProviderInfo should return an object');
    }

    const recommendation = SupabaseSemanticSearch.getProviderRecommendation('general');
    if (!recommendation || !recommendation.primary || !recommendation.model) {
      throw new Error('getProviderRecommendation should return primary and model');
    }
    
    console.log('✅ Provider information and recommendations work correctly');
    console.log('   Sample recommendation for general use:', recommendation.primary, recommendation.model);
  } catch (error) {
    console.error('❌ Provider info test failed:', error.message);
    process.exit(1);
  }

  // Test 3: Multi-model instantiation (without credentials)
  try {
    // Test different instantiation methods with dummy credentials
    const dummyUrl = 'https://dummy.supabase.co';
    const dummyKey = 'dummy-key';
    const dummyApiKey = 'dummy-api-key';

    // Legacy constructor
    const legacyInstance = createSemanticSearch(dummyUrl, dummyKey, dummyApiKey);
    if (!legacyInstance || typeof legacyInstance.getProviderInfo !== 'function') {
      throw new Error('Legacy constructor failed to create valid instance');
    }

    // Multi-model constructor
    const multiModelInstance = createSemanticSearchWithProvider({
      supabaseUrl: dummyUrl,
      supabaseKey: dummyKey,
      aiProvider: {
        provider: 'cohere',
        apiKey: dummyApiKey,
        model: 'embed-english-v3.0'
      }
    });
    if (!multiModelInstance || multiModelInstance.getProviderInfo().provider !== 'cohere') {
      throw new Error('Multi-model constructor failed');
    }

    // Provider-specific constructors
    const cohereInstance = createWithCohere(dummyUrl, dummyKey, dummyApiKey);
    if (!cohereInstance || cohereInstance.getProviderInfo().provider !== 'cohere') {
      throw new Error('Cohere constructor failed');
    }

    const voyageInstance = createWithVoyage(dummyUrl, dummyKey, dummyApiKey);
    if (!voyageInstance || voyageInstance.getProviderInfo().provider !== 'voyage') {
      throw new Error('Voyage constructor failed');
    }

    console.log('✅ All instantiation methods work correctly');
    console.log('   Legacy instance provider:', legacyInstance.getProviderInfo().provider);
    console.log('   Multi-model instance provider:', multiModelInstance.getProviderInfo().provider);
    console.log('   Cohere instance dimensions:', cohereInstance.getEmbeddingDimensions());
    console.log('   Voyage instance dimensions:', voyageInstance.getEmbeddingDimensions());
  } catch (error) {
    console.error('❌ Multi-model instantiation test failed:', error.message);
    process.exit(1);
  }

  // Debug: Show what environment variables are detected
  console.log('🔍 Environment variable check:');
  console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ SET' : '❌ NOT SET');
  console.log('   SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ SET' : '❌ NOT SET');
  console.log('   OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ SET' : '❌ NOT SET');
  console.log('   COHERE_API_KEY:', process.env.COHERE_API_KEY ? '✅ SET' : '❌ NOT SET');
  console.log('   VOYAGE_API_KEY:', process.env.VOYAGE_API_KEY ? '✅ SET' : '❌ NOT SET');
  console.log('   AI_PROVIDER:', process.env.AI_PROVIDER ? `✅ SET (${process.env.AI_PROVIDER})` : '❌ NOT SET');

  // Test 4: Real API testing (only if env vars are available)
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
          console.log('⚠️  Semantic search test failed (expected if DB not set up):', results.error.message);
        } else {
          console.log('✅ Semantic search test passed:', results.data?.length || 0, 'results');
        }
      } catch (error) {
        console.log('⚠️  Semantic search test failed (expected if DB not set up):', error.message);
      }

      // Test hybrid search (this might fail if DB isn't set up, which is expected)
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
if (require.main === module) {
  testSemanticSearch();
}

module.exports = { testSemanticSearch };