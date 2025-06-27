// Property Intelligence AI Background Service Worker with API Handling
console.log('=== PROPERTY INTELLIGENCE AI BACKGROUND SCRIPT STARTING ===');

// API Keys
const API_KEYS = {
    openai: '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',
    google: 'AIzaSyCWa3VmOnojtfoZjPeVrcASArqecTZowy8'
};

chrome.runtime.onInstalled.addListener(() => {
  console.log('Property Intelligence AI Extension v2.0 installed successfully!');
  
  // Initialize storage with default settings and API keys
  chrome.storage.local.set({
    extensionSettings: {
      enableRealTimeData: true,
      cacheResults: true,
      maxCacheAge: 3600000, // 1 hour
      enableNotifications: true
    },
    cachedData: {},
    installDate: new Date().toISOString(),
    openaiApiKey: API_KEYS.openai,
    googleApiKey: API_KEYS.google
  }).then(() => {
    console.log('Extension settings and API keys initialized successfully');
  }).catch(error => {
    console.error('Failed to initialize extension settings:', error);
  });
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  // Handle storage requests
  if (request.action === 'getSettings') {
    chrome.storage.local.get(['extensionSettings']).then(result => {
      sendResponse({ settings: result.extensionSettings || {} });
    }).catch(error => {
      console.error('Failed to get settings:', error);
      sendResponse({ error: error.message });
    });
    return true;
  }
  
  if (request.action === 'setSettings') {
    chrome.storage.local.set({ extensionSettings: request.settings }).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Failed to set settings:', error);
      sendResponse({ error: error.message });
    });
    return true;
  }
  
  // Handle cache requests
  if (request.action === 'getCachedData') {
    chrome.storage.local.get(['cachedData']).then(result => {
      const cachedData = result.cachedData || {};
      const cached = cachedData[request.key];
      
      if (cached && (Date.now() - cached.timestamp) < 3600000) { // 1 hour
        sendResponse({ data: cached.data });
      } else {
        sendResponse({ data: null });
      }
    }).catch(error => {
      console.error('Failed to get cached data:', error);
      sendResponse({ data: null });
    });
    return true;
  }
  
  if (request.action === 'setCachedData') {
    chrome.storage.local.get(['cachedData']).then(result => {
      const cachedData = result.cachedData || {};
      cachedData[request.key] = {
        data: request.data,
        timestamp: Date.now()
      };
      
      return chrome.storage.local.set({ cachedData });
    }).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Failed to set cached data:', error);
      sendResponse({ error: error.message });
    });
    return true;
  }

  // ===== API HANDLING =====
  
  // Google Places API calls
  if (request.action === 'googleGeocode') {
    handleGoogleGeocode(request.address, sendResponse);
    return true;
  }
  
  if (request.action === 'googlePlaces') {
    handleGooglePlaces(request.lat, request.lng, request.type, sendResponse);
    return true;
  }
  
  // OpenAI API calls
  if (request.action === 'openaiAnalysis') {
    handleOpenAIAnalysis(request.prompt, sendResponse);
    return true;
  }
  
  // Combined analysis
  if (request.action === 'fullPropertyAnalysis') {
    handleFullPropertyAnalysis(request.propertyData, request.locationInfo, request.countyData, sendResponse);
    return true;
  }
  
  // Log unknown actions
  if (request.action) {
    console.warn('Unknown action in background script:', request.action);
    sendResponse({ error: 'Unknown action: ' + request.action });
  }
  
  return true;
});

// Google Geocoding API handler
async function handleGoogleGeocode(address, sendResponse) {
  console.log('=== BACKGROUND: GEOCODING ADDRESS ===');
  console.log('Address:', address);
  
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEYS.google}`;
    console.log('Geocoding URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Geocoding response:', data);
    
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      sendResponse({ 
        success: true, 
        lat: location.lat, 
        lng: location.lng,
        fullAddress: data.results[0].formatted_address
      });
    } else {
      console.error('Geocoding failed:', data);
      sendResponse({ 
        success: false, 
        error: `Geocoding failed: ${data.status}`,
        details: data
      });
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

// Google Places API handler
async function handleGooglePlaces(lat, lng, type, sendResponse) {
  console.log(`=== BACKGROUND: PLACES SEARCH (${type}) ===`);
  console.log(`Location: ${lat}, ${lng}`);
  
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=3000&type=${type}&key=${API_KEYS.google}`;
    console.log('Places URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`Places response for ${type}:`, data);
    
    if (data.status === 'OK') {
      sendResponse({ 
        success: true, 
        count: data.results.length,
        places: data.results.slice(0, 20) // Limit to 20 results
      });
    } else {
      console.error(`Places search failed for ${type}:`, data);
      sendResponse({ 
        success: false, 
        error: `Places search failed: ${data.status}`,
        details: data
      });
    }
  } catch (error) {
    console.error(`Places search error for ${type}:`, error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

// Universal GPT-4 OpenAI API handler
async function handleOpenAIAnalysis(prompt, sendResponse) {
    console.log('=== UNIVERSAL GPT-4 ANALYSIS ===');
    console.log('Prompt length:', prompt.length);
    
    try {
        const requestBody = {
            model: 'gpt-4o', // UPGRADED TO GPT-4
            messages: [
                {
                    role: 'system',
                    content: `You are ChatGPT, a helpful AI assistant. When asked to analyze real estate markets and property locations, you provide the same detailed, accurate, and well-researched responses you would give to any user asking these questions directly.

Your expertise includes:
- Current demographic data for cities and towns across the US
- Transportation infrastructure and airport information
- School district ratings and quality assessments  
- Local economic conditions and market trends
- Realistic property valuations and market analysis

Provide thorough, accurate answers with specific data points and insights, just as you would in a normal conversation. Always research and verify information rather than making assumptions.`
                },
                {
                    role: 'user', 
                    content: prompt
                }
            ],
            max_tokens: 3000, // Increased for detailed responses
            temperature: 0.1, // Low for factual accuracy
            top_p: 0.1
        };
        
        console.log('Making Universal GPT-4 request...');
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEYS.openai}`
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('GPT-4 response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('GPT-4 API error:', errorText);
            sendResponse({ 
                success: false, 
                error: `GPT-4 API failed: ${response.status}`,
                details: errorText
            });
            return;
        }
        
        const data = await response.json();
        console.log('GPT-4 response:', data);
        
        // Calculate cost
        const cost = calculateGPT4Cost(data.usage);
        
        if (data.choices && data.choices[0] && data.choices[0].message) {
            sendResponse({ 
                success: true, 
                content: data.choices[0].message.content,
                usage: data.usage,
                model: 'gpt-4o-universal',
                cost: cost
            });
        } else {
            sendResponse({ 
                success: false, 
                error: 'Invalid GPT-4 response format',
                details: data
            });
        }
    } catch (error) {
        console.error('GPT-4 error:', error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}

// GPT-4 cost calculation
function calculateGPT4Cost(usage) {
    if (!usage) return null;
    
    // GPT-4o pricing (as of 2024)
    const inputCostPer1K = 0.005;  // $0.005 per 1K input tokens
    const outputCostPer1K = 0.015; // $0.015 per 1K output tokens
    
    const inputCost = (usage.prompt_tokens / 1000) * inputCostPer1K;
    const outputCost = (usage.completion_tokens / 1000) * outputCostPer1K;
    const totalCost = inputCost + outputCost;
    
    console.log('=== GPT-4 COST BREAKDOWN ===');
    console.log('Input tokens:', usage.prompt_tokens);
    console.log('Output tokens:', usage.completion_tokens);
    console.log('Total cost: $' + totalCost.toFixed(4));
    console.log('===========================');
    
    return {
        input_tokens: usage.prompt_tokens,
        output_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        estimated_cost: totalCost.toFixed(4)
    };
}

// UPDATED: Improved analysis prompt - direct questions approach
function createAnalysisPrompt(propertyData, locationInfo, countyData, googleData) {
    const currentYear = new Date().getFullYear();
    const googleDataText = googleData ? `

VERIFIED AMENITIES DATA (Google Places API):
- Grocery Stores: ${googleData.groceryStores}
- Restaurants: ${googleData.restaurants}
- Hospitals: ${googleData.hospitals}
- Schools: ${googleData.schools}
- Parks: ${googleData.parks}` : '';

    return `Analyze this property location with the same depth and accuracy you would provide if asked directly:

PROPERTY: ${propertyData.address || `Property in ${locationInfo.city}, ${locationInfo.state}`}
LOCATION: ${locationInfo.city}, ${locationInfo.state}${googleDataText}

Provide a comprehensive real estate analysis by researching the following for ${locationInfo.city}, ${locationInfo.state}:

1. What is the nearest major airport to ${locationInfo.city}, ${locationInfo.state}, how many miles away is it, and what type of airport is it (International/Regional/Municipal)?

2. What is the current median household income for ${locationInfo.city}, ${locationInfo.state} specifically? (Not the county average - the actual city/town data)

3. What are the current median home values in ${locationInfo.city}, ${locationInfo.state}?

4. What is the walk score for a typical residential area in ${locationInfo.city}, ${locationInfo.state}? Consider the actual urban/suburban density.

5. What is the typical commute time from ${locationInfo.city}, ${locationInfo.state} to the nearest major employment center?

6. How would you rate the school district serving ${locationInfo.city}, ${locationInfo.state} on a scale of 1-5?

7. What is the current real estate market trend in ${locationInfo.city}, ${locationInfo.state} - is it rising, stable, or declining?

8. What type of community is ${locationInfo.city}, ${locationInfo.state}? (Urban, suburban, rural, college town, etc.)

9. What are the main economic drivers in ${locationInfo.city}, ${locationInfo.state}?

10. What would be 3 key insights about ${locationInfo.city}, ${locationInfo.state} that would be important for someone considering buying property there?

Respond in this exact JSON format with your researched answers:

{
  "transportationAnalysis": {
    "airportDistance": [exact miles to nearest major airport],
    "airportType": "[International/Regional/Municipal]",
    "avgCommutTime": [realistic minutes to employment centers],
    "publicTransitScore": [1-10 rating]
  },
  "demographicsActual": {
    "medianHouseholdIncome": [actual local median income for this city],
    "medianHomeValue": [actual local median home value],
    "homeOwnershipRate": [local rate as percentage],
    "collegeEducated": [local percentage with college degrees]
  },
  "neighborhoodAnalysis": {
    "walkScore": [realistic score 0-100 based on area density],
    "crimeRating": "[Low/Medium/High]",
    "safetyScore": [1-10 rating],
    "neighborhoodType": "[accurate description]"
  },
  "schoolAnalysis": {
    "avgSchoolRating": [1-5 rating for district],
    "schoolDistrict": "[actual district name]",
    "schoolQuality": "[Excellent/Good/Fair/Poor]",
    "elementarySchools": [estimated count in area]
  },
  "marketAnalysis": {
    "marketTrend": "[Rising/Stable/Declining]",
    "priceGrowth1Year": [recent appreciation percentage],
    "daysOnMarket": [typical days for this market],
    "marketHotness": "[Hot/Warm/Cool/Cold]"
  },
  "locationProfile": {
    "communityType": "[Urban/Suburban/Rural/College Town/etc.]",
    "economicDrivers": "[main local industries/economy]",
    "populationTrend": "[Growing/Stable/Declining]"
  },
  "amenitiesAnalysis": {
    "groceryStores": ${googleData?.groceryStores || '[estimate]'},
    "restaurants": ${googleData?.restaurants || '[estimate]'},
    "hospitals": ${googleData?.hospitals || '[estimate]'},
    "parks": ${googleData?.parks || '[estimate]'}
  },
  "investmentAnalysis": {
    "rentalYield": [estimated annual rental yield %],
    "appreciationPotential": "[High/Medium/Low]",
    "investmentRating": [1-10 overall investment score],
    "capRate": [estimated cap rate %]
  },
  "insights": [
    "[Key insight #1 about this location]",
    "[Key insight #2 about this location]", 
    "[Key insight #3 about this location]"
  ]
}

Research each answer thoroughly and provide accurate, current information for ${locationInfo.city}, ${locationInfo.state} specifically.`;
}

// Full property analysis handler
async function handleFullPropertyAnalysis(propertyData, locationInfo, countyData, sendResponse) {
  console.log('=== BACKGROUND: FULL PROPERTY ANALYSIS ===');
  
  try {
    const analysisResults = {
      googleData: null,
      aiData: null,
      errors: []
    };
    
    // Step 1: Get Google Places data
    console.log('Step 1: Getting Google Places data...');
    if (propertyData.address) {
      try {
        // First geocode the address
        const geocodeResult = await new Promise((resolve) => {
          handleGoogleGeocode(propertyData.address, resolve);
        });
        
        if (geocodeResult.success) {
          console.log('Geocoding successful, getting places...');
          
          // Get places data for different types
          const placeTypes = [
            'grocery_or_supermarket',
            'restaurant', 
            'hospital',
            'school',
            'park',
            'bank',
            'pharmacy',
            'gas_station'
          ];
          
          const placesData = {
            groceryStores: 0,
            restaurants: 0,
            hospitals: 0,
            schools: 0,
            parks: 0,
            banks: 0,
            pharmacies: 0,
            gasStations: 0
          };
          
          const placeTypeMap = {
            'grocery_or_supermarket': 'groceryStores',
            'restaurant': 'restaurants',
            'hospital': 'hospitals', 
            'school': 'schools',
            'park': 'parks',
            'bank': 'banks',
            'pharmacy': 'pharmacies',
            'gas_station': 'gasStations'
          };
          
          // Get data for each place type
          for (const type of placeTypes) {
            try {
              const placeResult = await new Promise((resolve) => {
                handleGooglePlaces(geocodeResult.lat, geocodeResult.lng, type, resolve);
              });
              
              if (placeResult.success) {
                placesData[placeTypeMap[type]] = placeResult.count;
                console.log(`Found ${placeResult.count} ${type}(s)`);
              }
              
              // Rate limit delay
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (placeError) {
              console.error(`Error getting ${type} data:`, placeError);
              analysisResults.errors.push(`Failed to get ${type} data: ${placeError.message}`);
            }
          }
          
          analysisResults.googleData = {
            ...placesData,
            coordinates: { lat: geocodeResult.lat, lng: geocodeResult.lng },
            dataSource: 'google-api'
          };
          
          console.log('✅ Google Places data complete:', analysisResults.googleData);
        } else {
          analysisResults.errors.push(`Geocoding failed: ${geocodeResult.error}`);
        }
      } catch (googleError) {
        console.error('Google API error:', googleError);
        analysisResults.errors.push(`Google API failed: ${googleError.message}`);
      }
    }
    
    // Step 2: Get AI analysis
    console.log('Step 2: Getting AI analysis...');
    try {
      const prompt = createAnalysisPrompt(propertyData, locationInfo, countyData, analysisResults.googleData);
      
      const aiResult = await new Promise((resolve) => {
        handleOpenAIAnalysis(prompt, resolve);
      });
      
      if (aiResult.success) {
        analysisResults.aiData = {
          content: aiResult.content,
          usage: aiResult.usage,
          cost: aiResult.cost,
          dataSource: 'gpt-4o-universal'
        };
        console.log('✅ AI analysis complete');
      } else {
        analysisResults.errors.push(`AI analysis failed: ${aiResult.error}`);
      }
    } catch (aiError) {
      console.error('AI analysis error:', aiError);
      analysisResults.errors.push(`AI analysis failed: ${aiError.message}`);
    }
    
    // Return results
    sendResponse({
      success: true,
      results: analysisResults
    });
    
  } catch (error) {
    console.error('Full analysis error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Context menu for quick access (optional)
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.contextMenus) {
    try {
      chrome.contextMenus.create({
        id: 'analyzeProperty',
        title: 'Analyze this property with AI',
        contexts: ['page'],
        documentUrlPatterns: [
          '*://*.zillow.com/*',
          '*://*.realtor.com/*',
          '*://*.redfin.com/*'
        ]
      });
      console.log('Context menu created successfully');
    } catch (error) {
      console.warn('Failed to create context menu:', error);
    }
  }
});

// Handle context menu clicks
if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'analyzeProperty') {
      console.log('Context menu clicked - opening extension popup');
      if (chrome.action && chrome.action.openPopup) {
        chrome.action.openPopup().catch(error => {
          console.warn('Could not open popup:', error);
        });
      }
    }
  });
}

// Periodic cleanup of old cached data
if (chrome.alarms) {
  chrome.alarms.create('cleanupCache', { periodInMinutes: 60 });

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'cleanupCache') {
      try {
        const result = await chrome.storage.local.get(['cachedData']);
        const cachedData = result.cachedData || {};
        const maxAge = 3600000; // 1 hour
        const now = Date.now();
        
        let cleaned = false;
        for (const [key, cached] of Object.entries(cachedData)) {
          if (now - cached.timestamp > maxAge) {
            delete cachedData[key];
            cleaned = true;
          }
        }
        
        if (cleaned) {
          await chrome.storage.local.set({ cachedData });
          console.log('Cache cleanup completed');
        }
      } catch (error) {
        console.error('Cache cleanup failed:', error);
      }
    }
  });
}

// Error tracking
self.addEventListener('error', (event) => {
  console.error('Background script error:', {
    message: event.error?.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

console.log('=== BACKGROUND SCRIPT LOADED SUCCESSFULLY ===');