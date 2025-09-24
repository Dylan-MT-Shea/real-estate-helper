// server/fetchers/fema.js
import fetch from 'node-fetch';

export async function fetchFloodData(lat, lng, radius = 1000) {
  const FLOOD_API_KEY = process.env.FLOOD_API_KEY;
  
  if (!FLOOD_API_KEY) {
    return {
      retrieved_at: new Date().toISOString(),
      source: 'flood_api',
      confidence: 'missing',
      error: 'FLOOD_API_KEY not configured'
    };
  }

  try {
    // First, try FEMA's National Flood Hazard Layer
    const femaUrl = `https://hazards.fema.gov/gis/nfhl/services/data/NFHL/NFHLREST/services/FIRMette/exportFIRMette/execute`;
    
    // Alternative: if your FLOOD_API_KEY is for a different service
    // Try FloodFactor API or similar flood risk services
    const floodFactorUrl = `https://api.floodfactor.com/v1/risk?lat=${lat}&lng=${lng}&key=${FLOOD_API_KEY}`;
    
    let response = await fetch(floodFactorUrl);
    
    if (!response.ok) {
      // Try FEMA WMS service as backup
      const femaWmsUrl = `https://hazards.fema.gov/gis/nfhl/services/data/NFHL/NFHLWMS/MapServer/WMSServer?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&BBOX=${lng-0.01},${lat-0.01},${lng+0.01},${lat+0.01}&WIDTH=100&HEIGHT=100&LAYERS=0&QUERY_LAYERS=0&X=50&Y=50&FORMAT=application/json`;
      
      response = await fetch(femaWmsUrl);
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Flood API error: ${data.message || 'Unknown error'}`);
    }

    // Process flood risk data
    const floodRisk = {
      flood_zone: data.zone || data.floodZone || 'Unknown',
      risk_level: data.risk || data.riskLevel || 'Unknown',
      annual_chance: data.annualChance || null,
      flood_factor_score: data.score || null,
      historical_events: data.historicalEvents || [],
      projected_risk: data.projectedRisk || null
    };

    return {
      retrieved_at: new Date().toISOString(),
      source: floodFactorUrl,
      confidence: 'good',
      coordinates: { lat, lng },
      flood_risk: floodRisk,
      raw_data: data
    };

  } catch (error) {
    // Fallback to FEMA public data if available
    try {
      const femaPublicUrl = `https://www.fema.gov/api/open/v1/FemaWebDisasterSummaries?$filter=state eq '${getStateFromCoords(lat, lng)}'`;
      const fallbackResponse = await fetch(femaPublicUrl);
      const fallbackData = await fallbackResponse.json();
      
      return {
        retrieved_at: new Date().toISOString(),
        source: 'fema_disaster_summaries',
        confidence: 'partial',
        coordinates: { lat, lng },
        disaster_history: fallbackData.DisasterSummaries || [],
        note: 'Using FEMA disaster history as flood risk proxy'
      };
    } catch (fallbackError) {
      return {
        retrieved_at: new Date().toISOString(),
        source: 'flood_data',
        confidence: 'missing',
        error: error.message,
        fallback_error: fallbackError.message
      };
    }
  }
}

function getStateFromCoords(lat, lng) {
  // Simple state detection - in production you'd use a proper geocoding service
  const stateMap = {
    'FL': { minLat: 24.5, maxLat: 31.0, minLng: -87.6, maxLng: -80.0 },
    'CA': { minLat: 32.5, maxLat: 42.0, minLng: -124.4, maxLng: -114.1 },
    'TX': { minLat: 25.8, maxLat: 36.5, minLng: -106.6, maxLng: -93.5 },
    'NY': { minLat: 40.5, maxLat: 45.0, minLng: -79.8, maxLng: -71.9 }
  };
  
  for (const [state, bounds] of Object.entries(stateMap)) {
    if (lat >= bounds.minLat && lat <= bounds.maxLat && 
        lng >= bounds.minLng && lng <= bounds.maxLng) {
      return state;
    }
  }
  return 'Unknown';
}