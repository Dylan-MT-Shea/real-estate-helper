// server/fetchers/news.js
import fetch from 'node-fetch';

export async function fetchLocalNews(location, limit = 10) {
  try {
    const API_KEY = process.env.GOOGLE_API_KEY;
    const SEARCH_ENGINE_ID = process.env.GOOGLE_CUSTOM_SEARCH_ID;
    
    if (!API_KEY || !SEARCH_ENGINE_ID) {
      return {
        retrieved_at: new Date().toISOString(),
        source: 'google_custom_search',
        confidence: 'missing',
        error: 'Google Custom Search not configured'
      };
    }

    // Search for real estate development news in the location
    const queries = [
      `${location} real estate development news`,
      `${location} new construction permits`,
      `${location} housing market trends`,
      `${location} zoning changes planning`
    ];
    
    const allResults = [];
    
    for (const query of queries) {
      const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=${Math.ceil(limit/queries.length)}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (response.ok && data.items) {
        allResults.push(...data.items);
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Process and categorize results
    const categorizedNews = {
      development: allResults.filter(item => 
        item.title?.toLowerCase().includes('development') || 
        item.title?.toLowerCase().includes('construction') ||
        item.snippet?.toLowerCase().includes('new project')
      ),
      market_trends: allResults.filter(item =>
        item.title?.toLowerCase().includes('market') ||
        item.title?.toLowerCase().includes('price') ||
        item.title?.toLowerCase().includes('sale')
      ),
      policy_zoning: allResults.filter(item =>
        item.title?.toLowerCase().includes('zoning') ||
        item.title?.toLowerCase().includes('planning') ||
        item.title?.toLowerCase().includes('permit')
      )
    };

    return {
      retrieved_at: new Date().toISOString(),
      source: 'google_custom_search_real_estate',
      confidence: 'good',
      total_results: allResults.length,
      categorized_news: categorizedNews,
      all_results: allResults.slice(0, limit)
    };
  } catch (error) {
    return {
      retrieved_at: new Date().toISOString(),
      source: 'local_news',
      confidence: 'missing',
      error: error.message
    };
  }
}

export async function fetchDevelopmentNews(location) {
  return await fetchLocalNews(location + ' development construction zoning', 15);
}