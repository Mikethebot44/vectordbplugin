const { createSemanticSearch } = require('../dist/index.js');

async function testSemanticSearch() {
  // Initialize with your credentials
  const semanticSearch = createSemanticSearch(
    process.env.SUPABASE_URL || 'your-supabase-url',
    process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key',
    process.env.OPENAI_API_KEY || 'your-openai-api-key'
  );

  try {
    console.log('Testing semantic search...');
    
    // Test searching documents
    const results = await semanticSearch.searchDocuments('contract renewal', {
      topK: 5,
      threshold: 0.7
    });

    if (results.error) {
      console.error('Search error:', results.error.message);
    } else {
      console.log('Search results:', results.data);
    }

    // Test generic search
    const genericResults = await semanticSearch.semanticSearch(
      'documents',
      'machine learning algorithms',
      { topK: 3 }
    );

    if (genericResults.error) {
      console.error('Generic search error:', genericResults.error.message);
    } else {
      console.log('Generic search results:', genericResults.data);
    }

  } catch (error) {
    console.error('Test error:', error);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testSemanticSearch();
}

module.exports = { testSemanticSearch };