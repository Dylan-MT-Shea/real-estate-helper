// Enhanced Property Intelligence AI Background Script with Google Location Intelligence
console.log('=== ENHANCED PROPERTY INTELLIGENCE BACKGROUND STARTING ===');

// API Keys
const API_KEYS = {
    openai: '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',
    google: 'AIzaSyCSk3U29dOPQ0OVWxlkAaVPZYDTuWTsR5A',
    weather: 'fdcbf1d4ee044196bde220505250307'
};

// Major cities for distance calculations
const MAJOR_CITIES = [
    { name: 'New York, NY', lat: 40.7128, lng: -74.0060 },
    { name: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437 },
    { name: 'Chicago, IL', lat: 41.8781, lng: -87.6298 },
    { name: 'Houston, TX', lat: 29.7604, lng: -95.3698 },
    { name: 'Phoenix, AZ', lat: 33.4484, lng: -112.0740 },
    { name: 'Philadelphia, PA', lat: 39.9526, lng: -75.1652 },
    { name: 'San Antonio, TX', lat: 29.4241, lng: -98.4936 },
    { name: 'San Diego, CA', lat: 32.7157, lng: -117.1611 },
    { name: 'Dallas, TX', lat: 32.7767, lng: -96.7970 },
    { name: 'San Jose, CA', lat: 37.3382, lng: -121.8863 },
    { name: 'Austin, TX', lat: 30.2672, lng: -97.7431 },
    { name: 'Jacksonville, FL', lat: 30.3322, lng: -81.6557 },
    { name: 'Fort Worth, TX', lat: 32.7555, lng: -97.3308 },
    { name: 'Columbus, OH', lat: 39.9612, lng: -82.9988 },
    { name: 'Charlotte, NC', lat: 35.2271, lng: -80.8431 },
    { name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194 },
    { name: 'Indianapolis, IN', lat: 39.7684, lng: -86.1581 },
    { name: 'Seattle, WA', lat: 47.6062, lng: -122.3321 },
    { name: 'Denver, CO', lat: 39.7392, lng: -104.9903 },
    { name: 'Boston, MA', lat: 42.3601, lng: -71.0589 },
    { name: 'Atlanta, GA', lat: 33.7490, lng: -84.3880 },
    { name: 'Miami, FL', lat: 25.7617, lng: -80.1918 },
    { name: 'Las Vegas, NV', lat: 36.1699, lng: -115.1398 },
    { name: 'Portland, OR', lat: 45.5152, lng: -122.6784 },
    { name: 'Detroit, MI', lat: 42.3314, lng: -83.0458 }
];

// Major airports database for accurate airport detection
const MAJOR_AIRPORTS = [
    // International Airports
    { name: 'John F. Kennedy International Airport', code: 'JFK', lat: 40.6413, lng: -73.7781, type: 'international', city: 'New York' },
    { name: 'Los Angeles International Airport', code: 'LAX', lat: 33.9425, lng: -118.4081, type: 'international', city: 'Los Angeles' },
    { name: 'Chicago O\'Hare International Airport', code: 'ORD', lat: 41.9742, lng: -87.9073, type: 'international', city: 'Chicago' },
    { name: 'Dallas/Fort Worth International Airport', code: 'DFW', lat: 32.8998, lng: -97.0403, type: 'international', city: 'Dallas' },
    { name: 'Denver International Airport', code: 'DEN', lat: 39.8561, lng: -104.6737, type: 'international', city: 'Denver' },
    { name: 'San Francisco International Airport', code: 'SFO', lat: 37.6213, lng: -122.3790, type: 'international', city: 'San Francisco' },
    { name: 'Seattle-Tacoma International Airport', code: 'SEA', lat: 47.4502, lng: -122.3088, type: 'international', city: 'Seattle' },
    { name: 'Las Vegas McCarran International Airport', code: 'LAS', lat: 36.0840, lng: -115.1537, type: 'international', city: 'Las Vegas' },
    { name: 'Miami International Airport', code: 'MIA', lat: 25.7959, lng: -80.2870, type: 'international', city: 'Miami' },
    { name: 'Atlanta Hartsfield-Jackson International Airport', code: 'ATL', lat: 33.6407, lng: -84.4277, type: 'international', city: 'Atlanta' },
    { name: 'Boston Logan International Airport', code: 'BOS', lat: 42.3656, lng: -71.0096, type: 'international', city: 'Boston' },
    { name: 'Phoenix Sky Harbor International Airport', code: 'PHX', lat: 33.4342, lng: -112.0116, type: 'international', city: 'Phoenix' },
    { name: 'Philadelphia International Airport', code: 'PHL', lat: 39.8744, lng: -75.2424, type: 'international', city: 'Philadelphia' },
    { name: 'Houston George Bush Intercontinental Airport', code: 'IAH', lat: 29.9902, lng: -95.3368, type: 'international', city: 'Houston' },
    { name: 'Detroit Metropolitan Wayne County Airport', code: 'DTW', lat: 42.2162, lng: -83.3554, type: 'international', city: 'Detroit' },
    { name: 'Minneapolis-Saint Paul International Airport', code: 'MSP', lat: 44.8848, lng: -93.2223, type: 'international', city: 'Minneapolis' },
    { name: 'Orlando International Airport', code: 'MCO', lat: 28.4312, lng: -81.3081, type: 'international', city: 'Orlando' },
    { name: 'Charlotte Douglas International Airport', code: 'CLT', lat: 35.2144, lng: -80.9473, type: 'international', city: 'Charlotte' },
    { name: 'Newark Liberty International Airport', code: 'EWR', lat: 40.6895, lng: -74.1745, type: 'international', city: 'Newark' },
    { name: 'San Diego International Airport', code: 'SAN', lat: 32.7338, lng: -117.1933, type: 'international', city: 'San Diego' },
    
    // Regional Airports
    { name: 'Hartford Bradley International Airport', code: 'BDL', lat: 41.9387, lng: -72.6851, type: 'regional', city: 'Hartford' },
    { name: 'Albany International Airport', code: 'ALB', lat: 42.7483, lng: -73.8017, type: 'regional', city: 'Albany' },
    { name: 'Burlington International Airport', code: 'BTV', lat: 44.4720, lng: -73.1531, type: 'regional', city: 'Burlington' },
    { name: 'Manchester-Boston Regional Airport', code: 'MHT', lat: 42.9326, lng: -71.4357, type: 'regional', city: 'Manchester' },
    { name: 'Providence T.F. Green Airport', code: 'PVD', lat: 41.7240, lng: -71.4281, type: 'regional', city: 'Providence' },
    { name: 'Westchester County Airport', code: 'HPN', lat: 41.0670, lng: -73.7076, type: 'regional', city: 'White Plains' },
    { name: 'Tweed New Haven Airport', code: 'HVN', lat: 41.2639, lng: -72.8867, type: 'regional', city: 'New Haven' },
    { name: 'Long Island MacArthur Airport', code: 'ISP', lat: 40.7952, lng: -73.1009, type: 'regional', city: 'Islip' },
    { name: 'Teterboro Airport', code: 'TEB', lat: 40.8501, lng: -74.0606, type: 'regional', city: 'Teterboro' },
    { name: 'Republic Airport', code: 'FRG', lat: 40.7288, lng: -73.4134, type: 'regional', city: 'Farmingdale' },
    { name: 'Danbury Municipal Airport', code: 'DXR', lat: 41.3715, lng: -73.4822, type: 'regional', city: 'Danbury' },
    { name: 'Groton-New London Airport', code: 'GON', lat: 41.3301, lng: -72.0451, type: 'regional', city: 'Groton' },
    { name: 'Oxford Airport', code: 'OXC', lat: 41.4781, lng: -73.1353, type: 'regional', city: 'Oxford' },
    { name: 'Waterbury-Oxford Airport', code: 'OXC', lat: 41.4781, lng: -73.1353, type: 'regional', city: 'Waterbury' },
    { name: 'Windham Airport', code: 'IJD', lat: 41.7440, lng: -72.1801, type: 'regional', city: 'Windham' },
    { name: 'Chester Airport', code: 'SNC', lat: 41.3784, lng: -72.5068, type: 'regional', city: 'Chester' },
    { name: 'Robertson Field', code: 'PLB', lat: 41.3517, lng: -73.6284, type: 'regional', city: 'Plainville' }
];

chrome.runtime.onInstalled.addListener(() => {
    console.log('✅ Enhanced Property Intelligence background script installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('=== BACKGROUND MESSAGE RECEIVED ===');
    console.log('Action:', request.action);
    
    try {
        // Original sequential API testing actions
        if (request.action === 'testGeocodingOnly') {
            console.log('🧪 Testing Geocoding API only');
            testGeocodingOnly(request.address, sendResponse);
            return true;
        }
        
        if (request.action === 'testGooglePlacesOnly') {
            console.log('🧪 Testing Google Places API only');
            testGooglePlacesOnly(request.lat, request.lng, sendResponse);
            return true;
        }
        
        if (request.action === 'testWeatherOnly') {
            console.log('🧪 Testing Weather API only');
            testWeatherOnly(request.lat, request.lng, sendResponse);
            return true;
        }
        
        if (request.action === 'testOpenAIOnly') {
            console.log('🧪 Testing OpenAI API only');
            testOpenAIOnly(request.location, sendResponse);
            return true;
        }
        
        // Enhanced Google Location Intelligence actions
        if (request.action === 'geocodeAddress') {
            console.log('🌐 Enhanced Geocoding address:', request.address);
            geocodeAddressEnhanced(request.address, sendResponse);
            return true;
        }
        
        if (request.action === 'findNearestAirports') {
            console.log('✈️ Finding nearest airports (enhanced)');
            findNearestAirportsEnhanced(request.lat, request.lng, sendResponse);
            return true;
        }
        
        if (request.action === 'findNearestCities') {
            console.log('🏙️ Finding nearest cities');
            findNearestCities(request.lat, request.lng, sendResponse);
            return true;
        }
        
        if (request.action === 'analyzeRoadAccess') {
            console.log('🛣️ Analyzing road access');
            analyzeRoadAccess(request.lat, request.lng, sendResponse);
            return true;
        }
        
        if (request.action === 'findCommercialAmenities') {
            console.log('🛒 Finding commercial amenities');
            findCommercialAmenities(request.lat, request.lng, sendResponse);
            return true;
        }
        
        if (request.action === 'findHealthcareAndParks') {
            console.log('🏥 Finding healthcare and parks');
            findHealthcareAndParks(request.lat, request.lng, sendResponse);
            return true;
        }
        
        if (request.action === 'getElevationData') {
            console.log('🏔️ Getting elevation data');
            getElevationData(request.lat, request.lng, sendResponse);
            return true;
        }
        
        console.log('❓ Unknown action:', request.action);
        sendResponse({ success: false, error: 'Unknown action: ' + request.action });
        return true;
        
    } catch (error) {
        console.error('❌ Background error:', error);
        sendResponse({ success: false, error: error.message });
        return true;
    }
});

// === ORIGINAL SEQUENTIAL API TESTING FUNCTIONS ===
async function testGeocodingOnly(address, sendResponse) {
    console.log('🌐 Testing Geocoding API for:', address);
    
    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEYS.google}`;
        console.log('Geocoding URL:', url);
        
        const response = await fetch(url);
        console.log('Geocoding response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Geocoding data status:', data.status);
        
        if (data.status === 'OK' && data.results.length > 0) {
            const location = data.results[0].geometry.location;
            console.log('✅ Geocoding successful:', location);
            
            sendResponse({
                success: true,
                lat: location.lat,
                lng: location.lng,
                fullAddress: data.results[0].formatted_address,
                apiStatus: data.status,
                resultsCount: data.results.length
            });
        } else {
            console.log('❌ Geocoding failed with status:', data.status);
            sendResponse({
                success: false,
                error: `Geocoding failed: ${data.status}`,
                apiStatus: data.status,
                details: data
            });
        }
    } catch (error) {
        console.error('❌ Geocoding exception:', error);
        sendResponse({
            success: false,
            error: error.message,
            type: 'exception'
        });
    }
}

async function testGooglePlacesOnly(lat, lng, sendResponse) {
    console.log('🌐 Testing Google Places API for:', lat, lng);
    
    try {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=3000&type=restaurant&key=${API_KEYS.google}`;
        console.log('Places URL:', url);
        
        const response = await fetch(url);
        console.log('Places response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Places data status:', data.status, 'Results:', data.results?.length || 0);
        
        if (data.status === 'OK') {
            console.log('✅ Google Places successful');
            sendResponse({
                success: true,
                restaurantCount: data.results.length,
                apiStatus: data.status,
                sampleResults: data.results.slice(0, 3).map(r => r.name)
            });
        } else {
            console.log('❌ Google Places failed with status:', data.status);
            sendResponse({
                success: false,
                error: `Places API failed: ${data.status}`,
                apiStatus: data.status,
                details: data
            });
        }
    } catch (error) {
        console.error('❌ Google Places exception:', error);
        sendResponse({
            success: false,
            error: error.message,
            type: 'exception'
        });
    }
}

async function testWeatherOnly(lat, lng, sendResponse) {
    console.log('🌤️ Testing Weather API for:', lat, lng);
    
    try {
        const url = `https://api.weatherapi.com/v1/current.json?key=${API_KEYS.weather}&q=${lat},${lng}&aqi=yes`;
        console.log('Weather URL:', url);
        
        const response = await fetch(url);
        console.log('Weather response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('Weather error response:', errorText);
            throw new Error(`HTTP error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Weather data received - Location:', data.location?.name, 'Temp:', data.current?.temp_f);
        
        if (data.current && data.location) {
            console.log('✅ Weather API successful');
            sendResponse({
                success: true,
                location: data.location.name,
                temperature: data.current.temp_f,
                condition: data.current.condition.text,
                humidity: data.current.humidity,
                airQuality: data.current.air_quality?.['us-epa-index'] || null
            });
        } else {
            console.log('❌ Weather API returned invalid data structure');
            sendResponse({
                success: false,
                error: 'Invalid weather data structure',
                receivedData: data
            });
        }
    } catch (error) {
        console.error('❌ Weather API exception:', error);
        sendResponse({
            success: false,
            error: error.message,
            type: 'exception'
        });
    }
}

async function testOpenAIOnly(location, sendResponse) {
    console.log('🤖 Testing OpenAI API for:', location);
    
    try {
        const prompt = `Provide a brief real estate analysis for ${location} in JSON format:
        
{
  "medianHouseholdIncome": 85000,
  "walkScore": 65,
  "schoolRating": 4.2,
  "marketTrend": "Stable"
}`;

        console.log('OpenAI prompt length:', prompt.length);
        
        const requestBody = {
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a real estate expert. Respond with valid JSON only.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 300,
            temperature: 0.1
        };
        
        console.log('Sending OpenAI request...');
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEYS.openai}`
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('OpenAI response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('OpenAI error response:', errorText);
            throw new Error(`HTTP error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
        }
        
        const data = await response.json();
        console.log('OpenAI tokens used:', data.usage?.total_tokens || 0);
        
        if (data.choices && data.choices[0] && data.choices[0].message) {
            console.log('✅ OpenAI successful');
            sendResponse({
                success: true,
                content: data.choices[0].message.content,
                tokensUsed: data.usage?.total_tokens || 0,
                model: data.model
            });
        } else {
            console.log('❌ OpenAI returned invalid response structure');
            sendResponse({
                success: false,
                error: 'Invalid OpenAI response structure',
                receivedData: data
            });
        }
    } catch (error) {
        console.error('❌ OpenAI exception:', error);
        sendResponse({
            success: false,
            error: error.message,
            type: 'exception'
        });
    }
}

// === ENHANCED GOOGLE LOCATION INTELLIGENCE FUNCTIONS ===

// Enhanced Geocoding
async function geocodeAddressEnhanced(address, sendResponse) {
    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEYS.google}`;
        console.log('Enhanced Geocoding URL:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Enhanced Geocoding status:', data.status);
        
        if (data.status === 'OK' && data.results.length > 0) {
            const location = data.results[0].geometry.location;
            sendResponse({
                success: true,
                lat: location.lat,
                lng: location.lng,
                formattedAddress: data.results[0].formatted_address
            });
        } else {
            throw new Error(`Geocoding failed: ${data.status}`);
        }
    } catch (error) {
        console.error('❌ Enhanced Geocoding error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Enhanced Airport Finding (from original code)
async function findNearestAirportsEnhanced(lat, lng, sendResponse) {
    try {
        console.log('🛫 Searching for airports near:', lat, lng);
        
        // Calculate distances to all airports
        const airportsWithDistance = MAJOR_AIRPORTS.map(airport => {
            const distance = calculateDistance(lat, lng, airport.lat, airport.lng);
            return {
                ...airport,
                distance: formatDistance(distance),
                distanceKm: distance
            };
        }).sort((a, b) => a.distanceKm - b.distanceKm);
        
        // Find nearest international and regional airports
        const nearestInternational = airportsWithDistance.find(airport => airport.type === 'international');
        const nearestRegional = airportsWithDistance.find(airport => airport.type === 'regional');
        
        console.log('✅ Nearest International:', nearestInternational?.name, nearestInternational?.distance);
        console.log('✅ Nearest Regional:', nearestRegional?.name, nearestRegional?.distance);
        
        // Also try Google Places API as backup/supplementary data
        try {
            const radius = 100000; // 100km
            const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=airport&key=${API_KEYS.google}`;
            
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'OK' && data.results.length > 0) {
                    console.log('📊 Google Places found', data.results.length, 'additional airports');
                    
                    // Process Google Places results as backup
                    const googleAirports = data.results.map(airport => {
                        const distance = calculateDistance(lat, lng, airport.geometry.location.lat, airport.geometry.location.lng);
                        return {
                            name: airport.name,
                            distance: formatDistance(distance),
                            distanceKm: distance,
                            source: 'google_places'
                        };
                    }).sort((a, b) => a.distanceKm - b.distanceKm);
                    
                    // Use Google data if our known airports list didn't find anything close
                    if (!nearestInternational && googleAirports.length > 0) {
                        const possibleIntl = googleAirports.find(airport => 
                            airport.name.toLowerCase().includes('international') ||
                            airport.name.toLowerCase().includes('intl')
                        );
                        if (possibleIntl) {
                            console.log('🔄 Using Google Places international airport:', possibleIntl.name);
                        }
                    }
                }
            }
        } catch (googleError) {
            console.log('⚠️ Google Places backup failed:', googleError.message);
        }
        
        sendResponse({
            success: true,
            airports: {
                international: nearestInternational ? {
                    name: `${nearestInternational.name} (${nearestInternational.code})`,
                    distance: nearestInternational.distance,
                    city: nearestInternational.city
                } : null,
                regional: nearestRegional ? {
                    name: `${nearestRegional.name} (${nearestRegional.code})`,
                    distance: nearestRegional.distance,
                    city: nearestRegional.city
                } : null
            }
        });
        
    } catch (error) {
        console.error('❌ Enhanced Airport search error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Find Nearest Cities
async function findNearestCities(lat, lng, sendResponse) {
    try {
        // Calculate distances to major cities
        const citiesWithDistance = MAJOR_CITIES.map(city => {
            const distance = calculateDistance(lat, lng, city.lat, city.lng);
            return {
                ...city,
                distance: formatDistance(distance),
                distanceKm: distance
            };
        }).sort((a, b) => a.distanceKm - b.distanceKm);
        
        // Return top 3 nearest cities
        sendResponse({
            success: true,
            cities: citiesWithDistance.slice(0, 3)
        });
    } catch (error) {
        console.error('❌ City search error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Analyze Road Access
async function analyzeRoadAccess(lat, lng, sendResponse) {
    try {
        // Use Places API to find roads nearby and assess connectivity
        const radius = 2000; // 2km
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=route&key=${API_KEYS.google}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Analyze road quality based on nearby route types and connectivity
        let quality = 'Unknown';
        
        if (data.status === 'OK') {
            const routeCount = data.results.length;
            
            if (routeCount > 20) {
                quality = 'Excellent - Urban Grid';
            } else if (routeCount > 10) {
                quality = 'Good - Well Connected';
            } else if (routeCount > 5) {
                quality = 'Fair - Some Connectivity';
            } else if (routeCount > 0) {
                quality = 'Limited - Rural Access';
            } else {
                quality = 'Poor - Remote Location';
            }
        }
        
        sendResponse({
            success: true,
            roadAccess: {
                quality: quality,
                routeCount: data.results ? data.results.length : 0
            }
        });
    } catch (error) {
        console.error('❌ Road access analysis error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Find Commercial Amenities
async function findCommercialAmenities(lat, lng, sendResponse) {
    try {
        const radius = 5000; // 5km
        
        // Search for grocery stores
        const groceryPromise = searchPlaces(lat, lng, radius, 'grocery_or_supermarket');
        
        // Search for restaurants
        const restaurantPromise = searchPlaces(lat, lng, radius, 'restaurant');
        
        // Search for shopping (stores)
        const shoppingPromise = searchPlaces(lat, lng, radius, 'store');
        
        const [groceryResult, restaurantResult, shoppingResult] = await Promise.all([
            groceryPromise,
            restaurantPromise,
            shoppingPromise
        ]);
        
        sendResponse({
            success: true,
            grocery: processPlacesResult(groceryResult, lat, lng),
            restaurants: processPlacesResult(restaurantResult, lat, lng),
            shops: processPlacesResult(shoppingResult, lat, lng)
        });
        
    } catch (error) {
        console.error('❌ Commercial amenities search error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Find Healthcare and Parks
async function findHealthcareAndParks(lat, lng, sendResponse) {
    try {
        const hospitalRadius = 20000; // 20km for hospitals
        const parkRadius = 10000; // 10km for parks
        
        // Search for hospitals
        const hospitalPromise = searchPlaces(lat, lng, hospitalRadius, 'hospital');
        
        // Search for parks
        const parkPromise = searchPlaces(lat, lng, parkRadius, 'park');
        
        const [hospitalResult, parkResult] = await Promise.all([
            hospitalPromise,
            parkPromise
        ]);
        
        sendResponse({
            success: true,
            hospitals: processPlacesResult(hospitalResult, lat, lng),
            parks: processPlacesResult(parkResult, lat, lng)
        });
        
    } catch (error) {
        console.error('❌ Healthcare and parks search error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Get Elevation Data
async function getElevationData(lat, lng, sendResponse) {
    try {
        // Get elevation for the main point
        const elevationUrl = `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${API_KEYS.google}`;
        
        // Get elevation for surrounding points to determine terrain
        const surroundingPoints = [
            `${lat + 0.01},${lng}`,
            `${lat - 0.01},${lng}`,
            `${lat},${lng + 0.01}`,
            `${lat},${lng - 0.01}`
        ];
        const terrainUrl = `https://maps.googleapis.com/maps/api/elevation/json?locations=${surroundingPoints.join('|')}&key=${API_KEYS.google}`;
        
        const [elevationResponse, terrainResponse] = await Promise.all([
            fetch(elevationUrl),
            fetch(terrainUrl)
        ]);
        
        if (!elevationResponse.ok || !terrainResponse.ok) {
            throw new Error('Elevation API request failed');
        }
        
        const elevationData = await elevationResponse.json();
        const terrainData = await terrainResponse.json();
        
        if (elevationData.status === 'OK' && terrainData.status === 'OK') {
            const elevation = Math.round(elevationData.results[0].elevation);
            
            // Analyze terrain variation
            const elevations = terrainData.results.map(r => r.elevation);
            const maxElevation = Math.max(...elevations);
            const minElevation = Math.min(...elevations);
            const variation = maxElevation - minElevation;
            
            let terrain = 'Flat';
            let landscape = 'Plains';
            
            if (variation > 100) {
                terrain = 'Very Hilly';
                landscape = 'Mountainous';
            } else if (variation > 50) {
                terrain = 'Hilly';
                landscape = 'Rolling Hills';
            } else if (variation > 20) {
                terrain = 'Gently Rolling';
                landscape = 'Undulating';
            } else if (variation > 10) {
                terrain = 'Slightly Undulating';
                landscape = 'Gentle Slopes';
            }
            
            // Determine landscape based on elevation
            if (elevation > 2000) {
                landscape = 'Alpine/Mountain';
            } else if (elevation > 1000) {
                landscape = 'Highland';
            } else if (elevation > 500) {
                landscape = 'Upland';
            } else if (elevation < 10) {
                landscape = 'Coastal Plain';
            }
            
            sendResponse({
                success: true,
                elevation: elevation,
                terrain: terrain,
                landscape: landscape,
                variation: Math.round(variation)
            });
        } else {
            throw new Error(`Elevation API failed: ${elevationData.status}`);
        }
    } catch (error) {
        console.error('❌ Elevation data error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// === HELPER FUNCTIONS ===
async function searchPlaces(lat, lng, radius, type) {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${API_KEYS.google}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }
    
    return await response.json();
}

function processPlacesResult(result, originLat, originLng) {
    if (result.status !== 'OK') {
        return { count: 0, list: [] };
    }
    
    const places = result.results.map(place => {
        const distance = calculateDistance(
            originLat, 
            originLng, 
            place.geometry.location.lat, 
            place.geometry.location.lng
        );
        
        return {
            name: place.name,
            distance: formatDistance(distance),
            distanceKm: distance,
            rating: place.rating || 0,
            types: place.types || []
        };
    }).sort((a, b) => a.distanceKm - b.distanceKm);
    
    return {
        count: places.length,
        list: places.slice(0, 10) // Return top 10 nearest
    };
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function formatDistance(distanceKm) {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)}m`;
    } else if (distanceKm < 10) {
        return `${distanceKm.toFixed(1)}km`;
    } else {
        return `${Math.round(distanceKm)}km`;
    }
}

console.log('=== ENHANCED PROPERTY INTELLIGENCE BACKGROUND LOADED ===');
