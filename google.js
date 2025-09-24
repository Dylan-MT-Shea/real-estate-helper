// server/fetchers/google.js
import fetch from 'node-fetch';

const BASE_URL = 'https://maps.googleapis.com/maps/api';
const API_KEY = process.env.GOOGLE_API_KEY;

export async function geocodeAddress(location) {
  if (!API_KEY) {
    return { 
      retrieved_at: new Date().toISOString(), 
      source: 'google_geocoding', 
      confidence: 'missing', 
      error: 'GOOGLE_API_KEY not configured' 
    };
  }

  const url = `${BASE_URL}/geocode/json?address=${encodeURIComponent(location)}&key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    return {
      retrieved_at: new Date().toISOString(),
      source: url,
      confidence: data.status === 'OK' ? 'good' : 'missing',
      raw: data,
      location: data.results?.[0] || null
    };
  } catch (error) {
    return {
      retrieved_at: new Date().toISOString(),
      source: url,
      confidence: 'missing',
      error: error.message
    };
  }
}

export async function placesNearby(lat, lng, radius = 1600, type = null) {
  if (!API_KEY) {
    return { 
      retrieved_at: new Date().toISOString(), 
      source: 'google_places', 
      confidence: 'missing', 
      error: 'GOOGLE_API_KEY not configured' 
    };
  }

  const baseUrl = `${BASE_URL}/place/nearbysearch/json`;
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: radius.toString(),
    key: API_KEY
  });
  
  if (type) params.append('type', type);
  
  const url = `${baseUrl}?${params}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    let allResults = data.results || [];
    
    // Handle pagination with next_page_token
    let nextPageToken = data.next_page_token;
    while (nextPageToken && allResults.length < 60) { // Limit to prevent excessive calls
      // Google requires a delay before using next_page_token
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const nextUrl = `${baseUrl}?pagetoken=${nextPageToken}&key=${API_KEY}`;
      const nextResponse = await fetch(nextUrl);
      const nextData = await nextResponse.json();
      
      if (nextData.results) {
        allResults = allResults.concat(nextData.results);
      }
      
      nextPageToken = nextData.next_page_token;
    }
    
    return {
      retrieved_at: new Date().toISOString(),
      source: url,
      confidence: data.status === 'OK' ? 'good' : 'partial',
      places: allResults,
      total_count: allResults.length
    };
  } catch (error) {
    return {
      retrieved_at: new Date().toISOString(),
      source: url,
      confidence: 'missing',
      error: error.message
    };
  }
}

export async function getPlaceDetails(placeId) {
  if (!API_KEY) {
    return { 
      retrieved_at: new Date().toISOString(), 
      source: 'google_place_details', 
      confidence: 'missing', 
      error: 'GOOGLE_API_KEY not configured' 
    };
  }

  const url = `${BASE_URL}/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,price_level,opening_hours,reviews&key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    return {
      retrieved_at: new Date().toISOString(),
      source: url,
      confidence: data.status === 'OK' ? 'good' : 'missing',
      details: data.result || null
    };
  } catch (error) {
    return {
      retrieved_at: new Date().toISOString(),
      source: url,
      confidence: 'missing',
      error: error.message
    };
  }
}

export async function getAmenityAnalysis(lat, lng) {
  const radii = [400, 800, 1600, 3200]; // meters
  const amenityTypes = [
    'restaurant', 'cafe', 'grocery_or_supermarket', 'pharmacy',
    'hospital', 'school', 'bank', 'gas_station', 'park',
    'gym', 'shopping_mall', 'transit_station'
  ];
  
  const results = {};
  
  for (const radius of radii) {
    results[radius] = {};
    
    for (const amenityType of amenityTypes) {
      const amenityData = await placesNearby(lat, lng, radius, amenityType);
      results[radius][amenityType] = {
        count: amenityData.places?.length || 0,
        confidence: amenityData.confidence
      };
      
      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return {
    retrieved_at: new Date().toISOString(),
    source: 'google_places_amenity_analysis',
    confidence: 'good',
    amenity_analysis: results
  };
}