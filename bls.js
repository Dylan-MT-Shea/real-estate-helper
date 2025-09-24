// server/fetchers/bls.js
import fetch from 'node-fetch';

export async function fetchBLSData(areaCode) {
  const API_KEY = process.env.BLS_API_KEY;
  
  try {
    if (!API_KEY) {
      return {
        retrieved_at: new Date().toISOString(),
        source: 'bls_api',
        confidence: 'missing',
        error: 'BLS_API_KEY not configured'
      };
    }

    // Bureau of Labor Statistics API
    const url = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';
    
    // Example: Get unemployment rate for area
    const seriesId = `LAUCT${areaCode}0000000003`; // Unemployment rate
    
    const requestBody = {
      seriesid: [seriesId],
      startyear: "2020",
      endyear: "2024"
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (data.status !== 'REQUEST_SUCCEEDED') {
      throw new Error(`BLS API error: ${data.message?.[0] || 'Unknown error'}`);
    }

    return {
      retrieved_at: new Date().toISOString(),
      source: url,
      confidence: 'good',
      series: data.Results?.series || [],
      area_code: areaCode
    };
  } catch (error) {
    return {
      retrieved_at: new Date().toISOString(),
      source: 'bls_api',
      confidence: 'missing',
      error: error.message
    };
  }
}
