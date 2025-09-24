// fixed-orchestrator.js - Unified data orchestrator with proper API integration
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

class UniversalDataOrchestrator {
  constructor() {
    // API key availability
    this.hasGoogleKey = !!process.env.GOOGLE_API_KEY;
    this.hasCensusKey = !!process.env.CENSUS_API_KEY;
    this.hasWeatherKey = !!process.env.WEATHER_API_KEY;
    this.hasBLSKey = !!process.env.BLS_API_KEY;
    this.hasNewsKey = !!process.env.NEWS_API_KEY;
    
    // Rate limiting
    this.lastApiCalls = {
      google: 0,
      census: 0,
      weather: 0,
      bls: 0,
      news: 0
    };
    
    this.rateLimits = {
      google: 100,    // ms between calls
      census: 200,
      weather: 1000,
      bls: 500,
      news: 1000
    };

    // BLS Metro Area Codes for universal coverage
    this.blsMetroAreas = {
      'new_york': '35620', 'boston': '14460', 'philadelphia': '37980',
      'atlanta': '12060', 'miami': '33100', 'charlotte': '16740',
      'chicago': '16980', 'detroit': '19820', 'minneapolis': '33460',
      'dallas': '19100', 'houston': '26420', 'austin': '12420',
      'los_angeles': '31080', 'san_francisco': '41860', 'seattle': '42660',
      'denver': '19740', 'phoenix': '38060', 'las_vegas': '29820'
    };
  }

  async buildLocationAnalysis(location, mode = 'point', topN = 5) {
    const startTime = Date.now();
    console.log(`\n=== BUILDING UNIVERSAL LOCATION ANALYSIS ===`);
    console.log(`Location: ${location}`);
    console.log(`Mode: ${mode}`);
    
    const slug = this.createSlug(location);
    const outputDir = path.join(process.cwd(), 'outputs', slug);
    await fs.mkdir(outputDir, { recursive: true });
    
    const analysisData = {
      meta: {
        query: location,
        mode,
        topN: mode === 'region' ? topN : null,
        created_at: new Date().toISOString(),
        slug,
        api_keys_available: {
          google: this.hasGoogleKey,
          census: this.hasCensusKey,
          weather: this.hasWeatherKey,
          bls: this.hasBLSKey,
          news: this.hasNewsKey
        }
      },
      raw_data: {
        geography: null,
        census: null,
        bls: null,
        zillow: null,
        places: null,
        weather: null,
        news: null,
        flood: null
      },
      processed_metrics: {},
      investment_score: 0,
      data_quality: {}
    };

    try {
      // Step 1: Establish canonical geography
      console.log('Step 1: Geocoding and geography establishment...');
      analysisData.raw_data.geography = await this.geocodeLocation(location);
      
      if (!analysisData.raw_data.geography.coordinates) {
        throw new Error('Could not geocode location - analysis cannot proceed');
      }

      const { lat, lng } = analysisData.raw_data.geography.coordinates;
      console.log(`✓ Coordinates: ${lat}, ${lng}`);

      // Step 2: Get Census geography hierarchy
      console.log('Step 2: Census geography lookup...');
      const geoHierarchy = await this.getCensusGeography(lat, lng);
      analysisData.raw_data.geography.hierarchy = geoHierarchy;

      // Step 3: Gather all data sources in parallel
      console.log('Step 3: Gathering data from all sources...');
      const [
        censusData,
        blsData,
        zillowData,
        placesData,
        weatherData,
        newsData
      ] = await Promise.all([
        this.fetchCensusData(geoHierarchy),
        this.fetchBLSData(lat, lng, location),
        this.fetchZillowData(location),
        this.fetchGooglePlaces(lat, lng),
        this.fetchWeatherData(lat, lng),
        this.fetchNewsData(location)
      ]);

      // Assign data
      analysisData.raw_data.census = censusData;
      analysisData.raw_data.bls = blsData;
      analysisData.raw_data.zillow = zillowData;
      analysisData.raw_data.places = placesData;
      analysisData.raw_data.weather = weatherData;
      analysisData.raw_data.news = newsData;

      // Step 4: Process metrics
      console.log('Step 4: Processing investment metrics...');
      analysisData.processed_metrics = this.calculateInvestmentMetrics(analysisData.raw_data);

      // Step 5: Calculate investment score
      console.log('Step 5: Computing investment score...');
      analysisData.investment_score = this.computeInvestmentScore(analysisData.processed_metrics);

      // Step 6: Data quality assessment
      analysisData.data_quality = this.assessDataQuality(analysisData.raw_data);

      // Step 7: Save all outputs
      await this.saveAnalysisOutputs(analysisData, outputDir, slug);

      const processingTime = Date.now() - startTime;
      console.log(`✓ Analysis completed in ${processingTime}ms`);
      console.log(`✓ Investment Score: ${analysisData.investment_score.final_score}/100`);
      console.log(`✓ Data Quality: ${analysisData.data_quality.overall_score}%`);

      return {
        success: true,
        analysis_data: analysisData,
        output_dir: outputDir,
        processing_time: processingTime
      };

    } catch (error) {
      console.error('Universal analysis error:', error);
      
      const errorOutput = {
        error: error.message,
        location,
        mode,
        timestamp: new Date().toISOString(),
        partial_data: analysisData
      };
      
      await fs.writeFile(
        path.join(outputDir, `${slug}_error.json`),
        JSON.stringify(errorOutput, null, 2)
      );
      
      throw error;
    }
  }

  // === CORE GEOCODING ===
  async geocodeLocation(location) {
    if (!this.hasGoogleKey) {
      return {
        confidence: 'missing',
        error: 'Google API key not configured',
        coordinates: null
      };
    }

    await this.rateLimitDelay('google');

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${process.env.GOOGLE_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        return {
          confidence: 'good',
          source: 'google_geocoding_api',
          retrieved_at: new Date().toISOString(),
          formatted_address: result.formatted_address,
          coordinates: result.geometry.location,
          place_id: result.place_id,
          address_components: result.address_components,
          raw_result: result
        };
      } else {
        throw new Error(`Geocoding failed: ${data.status}`);
      }
    } catch (error) {
      return {
        confidence: 'missing',
        error: error.message,
        coordinates: null,
        retrieved_at: new Date().toISOString()
      };
    }
  }

  // === CENSUS DATA ===
  async getCensusGeography(lat, lng) {
    try {
      const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.result?.geographies) {
        return {
          confidence: 'good',
          source: url,
          retrieved_at: new Date().toISOString(),
          tract: data.result.geographies['Census Tracts']?.[0] || null,
          county: data.result.geographies['Counties']?.[0] || null,
          state: data.result.geographies['States']?.[0] || null,
          place: data.result.geographies['Incorporated Places']?.[0] || null,
          zcta: data.result.geographies['Zip Code Tabulation Areas']?.[0] || null
        };
      } else {
        throw new Error('No geography data returned');
      }
    } catch (error) {
      return {
        confidence: 'missing',
        error: error.message,
        retrieved_at: new Date().toISOString()
      };
    }
  }

  async fetchCensusData(geoHierarchy) {
    if (!this.hasCensusKey || !geoHierarchy.tract) {
      return {
        confidence: 'missing',
        error: this.hasCensusKey ? 'No tract data available' : 'Census API key not configured',
        retrieved_at: new Date().toISOString()
      };
    }

    await this.rateLimitDelay('census');

    try {
      const tract = geoHierarchy.tract;
      const state = tract.STATE;
      const county = tract.COUNTY;
      const tractCode = tract.TRACT;

      // Key variables for real estate analysis
      const variables = [
        'B01003_001E', // Total population
        'B19013_001E', // Median household income
        'B25001_001E', // Total housing units
        'B25003_001E', // Total occupied housing units
        'B25003_002E', // Owner occupied
        'B25003_003E', // Renter occupied
        'B25077_001E', // Median home value
        'B25064_001E', // Median gross rent
        'B23025_002E', // Labor force
        'B23025_005E', // Unemployed
        'B15003_022E', // Bachelor's degree
        'B15003_001E'  // Education universe
      ];

      const url = `https://api.census.gov/data/2022/acs/acs5?get=${variables.join(',')}&for=tract:${tractCode}&in=state:${state}%20county:${county}&key=${process.env.CENSUS_API_KEY}`;
      
      const response = await fetch(url);
      const responseData = await response.json();

      if (Array.isArray(responseData) && responseData.length > 1) {
        const [headers, values] = responseData;
        const acsData = {};
        headers.forEach((header, index) => {
          acsData[header] = values[index];
        });

        // Calculate derived metrics
        const population = parseInt(acsData['B01003_001E']) || 0;
        const medianIncome = parseInt(acsData['B19013_001E']) || 0;
        const housingUnits = parseInt(acsData['B25001_001E']) || 0;
        const occupiedUnits = parseInt(acsData['B25003_001E']) || 0;
        const ownerOccupied = parseInt(acsData['B25003_002E']) || 0;
        const renterOccupied = parseInt(acsData['B25003_003E']) || 0;
        const medianHomeValue = parseInt(acsData['B25077_001E']) || 0;
        const medianRent = parseInt(acsData['B25064_001E']) || 0;
        const laborForce = parseInt(acsData['B23025_002E']) || 0;
        const unemployed = parseInt(acsData['B23025_005E']) || 0;
        const bachelorPlus = parseInt(acsData['B15003_022E']) || 0;
        const eduUniverse = parseInt(acsData['B15003_001E']) || 1;

        return {
          confidence: 'good',
          source: url,
          retrieved_at: new Date().toISOString(),
          tract_fips: `${state}${county}${tractCode}`,
          raw_acs: acsData,
          computed_metrics: {
            population,
            median_household_income: medianIncome,
            total_housing_units: housingUnits,
            occupied_housing_units: occupiedUnits,
            ownership_rate: occupiedUnits > 0 ? (ownerOccupied / occupiedUnits) * 100 : 0,
            rental_rate: occupiedUnits > 0 ? (renterOccupied / occupiedUnits) * 100 : 0,
            vacancy_rate: housingUnits > 0 ? ((housingUnits - occupiedUnits) / housingUnits) * 100 : 0,
            median_home_value: medianHomeValue,
            median_gross_rent: medianRent,
            unemployment_rate: laborForce > 0 ? (unemployed / laborForce) * 100 : 0,
            bachelor_plus_rate: (bachelorPlus / eduUniverse) * 100,
            price_to_income_ratio: medianIncome > 0 ? medianHomeValue / medianIncome : 0,
            rent_to_income_ratio: medianIncome > 0 ? (medianRent * 12) / medianIncome : 0
          }
        };
      } else {
        throw new Error('No ACS data returned');
      }
    } catch (error) {
      return {
        confidence: 'missing',
        error: error.message,
        retrieved_at: new Date().toISOString()
      };
    }
  }

  // === BLS DATA ===
  async fetchBLSData(lat, lng, location) {
    if (!this.hasBLSKey) {
      return {
        confidence: 'missing',
        error: 'BLS API key not configured',
        retrieved_at: new Date().toISOString()
      };
    }

    await this.rateLimitDelay('bls');

    try {
      // Map location to BLS area code
      const areaCode = this.getBLSAreaCode(lat, lng, location);
      
      if (!areaCode) {
        return {
          confidence: 'partial',
          error: 'Could not map location to BLS area',
          note: 'Location not covered by major metro BLS data',
          retrieved_at: new Date().toISOString()
        };
      }

      const seriesId = `LAUMT${areaCode}000000003`; // Unemployment rate
      const currentYear = new Date().getFullYear();
      
      const requestBody = {
        seriesid: [seriesId],
        startyear: (currentYear - 3).toString(),
        endyear: currentYear.toString(),
        registrationkey: process.env.BLS_API_KEY
      };

      const response = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (data.status === 'REQUEST_SUCCEEDED' && data.Results?.series?.length > 0) {
        const series = data.Results.series[0];
        const recentData = series.data.slice(0, 12); // Last 12 months
        
        return {
          confidence: 'good',
          source: 'bls_laus_api',
          retrieved_at: new Date().toISOString(),
          area_code: areaCode,
          series_id: seriesId,
          current_unemployment_rate: parseFloat(recentData[0]?.value) || null,
          time_series: recentData.map(item => ({
            year: item.year,
            period: item.period,
            value: parseFloat(item.value),
            date: `${item.year}-${item.period.replace('M', '').padStart(2, '0')}-01`
          }))
        };
      } else {
        throw new Error(`BLS API error: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      return {
        confidence: 'missing',
        error: error.message,
        retrieved_at: new Date().toISOString()
      };
    }
  }

  getBLSAreaCode(lat, lng, location) {
    // Simple distance-based matching to BLS metro areas
    const metros = {
      'new_york': { lat: 40.7128, lng: -74.0060, code: '35620' },
      'boston': { lat: 42.3601, lng: -71.0589, code: '14460' },
      'philadelphia': { lat: 39.9526, lng: -75.1652, code: '37980' },
      'atlanta': { lat: 33.7490, lng: -84.3880, code: '12060' },
      'chicago': { lat: 41.8781, lng: -87.6298, code: '16980' },
      'dallas': { lat: 32.7767, lng: -96.7970, code: '19100' },
      'los_angeles': { lat: 34.0522, lng: -118.2437, code: '31080' },
      'san_francisco': { lat: 37.7749, lng: -122.4194, code: '41860' },
      'seattle': { lat: 47.6062, lng: -122.3321, code: '42660' },
      'denver': { lat: 39.7392, lng: -104.9903, code: '19740' }
    };

    let closestMetro = null;
    let minDistance = Infinity;
    
    for (const [name, metro] of Object.entries(metros)) {
      const distance = Math.sqrt(
        Math.pow(lat - metro.lat, 2) + Math.pow(lng - metro.lng, 2)
      );
      
      if (distance < minDistance && distance < 2.0) { // Within ~2 degrees
        minDistance = distance;
        closestMetro = metro.code;
      }
    }
    
    return closestMetro;
  }

  // === ZILLOW DATA ===
  async fetchZillowData(location) {
    try {
      const ZillowProcessor = require('./zillow-processor');
      const processor = new ZillowProcessor();
      
      const locationMetrics = await processor.processLocationData(location);
      
      if (locationMetrics && !locationMetrics.error) {
        return {
          confidence: 'good',
          source: 'local_zillow_csv',
          retrieved_at: new Date().toISOString(),
          metro_name: locationMetrics.metro_name,
          metrics: locationMetrics
        };
      } else {
        return {
          confidence: 'missing',
          error: locationMetrics?.error || 'No Zillow data available',
          retrieved_at: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        confidence: 'missing',
        error: error.message,
        retrieved_at: new Date().toISOString()
      };
    }
  }

  // === GOOGLE PLACES ===
  async fetchGooglePlaces(lat, lng) {
    if (!this.hasGoogleKey) {
      return {
        confidence: 'missing',
        error: 'Google API key not configured',
        retrieved_at: new Date().toISOString()
      };
    }

    await this.rateLimitDelay('google');

    try {
      const amenityTypes = ['restaurant', 'grocery_or_supermarket', 'hospital', 'school', 'park', 'gym'];
      const amenityCounts = {};
      
      for (const type of amenityTypes) {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=1600&type=${type}&key=${process.env.GOOGLE_API_KEY}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        amenityCounts[type] = {
          count: data.results?.length || 0,
          status: data.status
        };
        
        await this.rateLimitDelay('google');
      }
      
      return {
        confidence: 'good',
        source: 'google_places_api',
        retrieved_at: new Date().toISOString(),
        coordinates: { lat, lng },
        radius_meters: 1600,
        amenity_counts: amenityCounts
      };
    } catch (error) {
      return {
        confidence: 'missing',
        error: error.message,
        retrieved_at: new Date().toISOString()
      };
    }
  }

  // === WEATHER DATA ===
  async fetchWeatherData(lat, lng) {
    if (!this.hasWeatherKey) {
      return {
        confidence: 'missing',
        error: 'Weather API key not configured',
        retrieved_at: new Date().toISOString()
      };
    }

    await this.rateLimitDelay('weather');

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${process.env.WEATHER_API_KEY}&units=imperial`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.main) {
        return {
          confidence: 'good',
          source: url,
          retrieved_at: new Date().toISOString(),
          current_temperature: data.main.temp,
          conditions: data.weather[0]?.description,
          humidity: data.main.humidity,
          raw_data: data
        };
      } else {
        throw new Error('Invalid weather response');
      }
    } catch (error) {
      return {
        confidence: 'missing',
        error: error.message,
        retrieved_at: new Date().toISOString()
      };
    }
  }

  // === NEWS DATA ===
  async fetchNewsData(location) {
    if (!this.hasNewsKey && !this.hasGoogleKey) {
      return {
        confidence: 'missing',
        error: 'No news API keys configured',
        retrieved_at: new Date().toISOString()
      };
    }

    await this.rateLimitDelay('news');

    try {
      // Use Google Custom Search if available
      if (this.hasGoogleKey && process.env.GOOGLE_CUSTOM_SEARCH_ID) {
        const query = `${location} real estate development news`;
        const url = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CUSTOM_SEARCH_ID}&q=${encodeURIComponent(query)}&num=10`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        return {
          confidence: 'good',
          source: 'google_custom_search',
          retrieved_at: new Date().toISOString(),
          query,
          results_count: data.items?.length || 0,
          articles: data.items || []
        };
      }
      
      return {
        confidence: 'partial',
        error: 'Google Custom Search ID not configured',
        retrieved_at: new Date().toISOString()
      };
    } catch (error) {
      return {
        confidence: 'missing',
        error: error.message,
        retrieved_at: new Date().toISOString()
      };
    }
  }

  // === METRICS CALCULATION ===
  calculateInvestmentMetrics(rawData) {
    const metrics = {
      market_momentum: this.calculateMarketMomentum(rawData),
      supply_demand: this.calculateSupplyDemand(rawData),
      rental_strength: this.calculateRentalStrength(rawData),
      affordability: this.calculateAffordability(rawData),
      economic_fundamentals: this.calculateEconomicFundamentals(rawData),
      amenities_access: this.calculateAmenitiesAccess(rawData)
    };
    
    return metrics;
  }

  calculateMarketMomentum(rawData) {
    let score = 50; // Base score
    const factors = [];
    
    if (rawData.zillow?.confidence === 'good') {
      const zhvi1y = parseFloat(rawData.zillow.metrics.zhvi_1y_growth);
      if (!isNaN(zhvi1y)) {
        if (zhvi1y > 10) score += 25;
        else if (zhvi1y > 5) score += 15;
        else if (zhvi1y > 0) score += 5;
        else if (zhvi1y < -5) score -= 15;
        
        factors.push(`ZHVI 1Y Growth: ${zhvi1y}%`);
      }
      
      const marketTemp = parseFloat(rawData.zillow.metrics.market_temperature);
      if (!isNaN(marketTemp)) {
        if (marketTemp > 60) score += 10;
        else if (marketTemp < 40) score -= 10;
        
        factors.push(`Market Temperature: ${marketTemp}`);
      }
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      factors,
      confidence: rawData.zillow?.confidence || 'missing'
    };
  }

  calculateSupplyDemand(rawData) {
    let score = 50;
    const factors = [];
    
    if (rawData.census?.confidence === 'good') {
      const vacancyRate = rawData.census.computed_metrics.vacancy_rate;
      if (vacancyRate < 5) score += 20;
      else if (vacancyRate < 8) score += 10;
      else if (vacancyRate > 15) score -= 20;
      
      factors.push(`Vacancy Rate: ${vacancyRate.toFixed(1)}%`);
    }
    
    if (rawData.zillow?.confidence === 'good') {
      const monthsSupply = parseFloat(rawData.zillow.metrics.months_supply);
      if (!isNaN(monthsSupply)) {
        if (monthsSupply < 3) score += 15;
        else if (monthsSupply < 6) score += 5;
        else if (monthsSupply > 10) score -= 15;
        
        factors.push(`Months Supply: ${monthsSupply}`);
      }
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      factors,
      confidence: rawData.census?.confidence === 'good' ? 'good' : 'partial'
    };
  }

  calculateRentalStrength(rawData) {
    let score = 50;
    const factors = [];
    
    if (rawData.census?.confidence === 'good') {
      const rentalRate = rawData.census.computed_metrics.rental_rate;
      if (rentalRate > 60) score += 15;
      else if (rentalRate > 40) score += 10;
      
      factors.push(`Rental Rate: ${rentalRate.toFixed(1)}%`);
      
      const rentToIncome = rawData.census.computed_metrics.rent_to_income_ratio;
      if (rentToIncome < 0.3) score += 10;
      else if (rentToIncome > 0.5) score -= 10;
      
      factors.push(`Rent-to-Income: ${(rentToIncome * 100).toFixed(1)}%`);
    }
    
    if (rawData.zillow?.confidence === 'good') {
      const zori1y = parseFloat(rawData.zillow.metrics.zori_1y_growth);
      if (!isNaN(zori1y)) {
        if (zori1y > 8) score += 15;
        else if (zori1y > 4) score += 8;
        else if (zori1y < 0) score -= 10;
        
        factors.push(`ZORI 1Y Growth: ${zori1y}%`);
      }
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      factors,
      confidence: rawData.census?.confidence === 'good' ? 'good' : 'partial'
    };
  }

  calculateAffordability(rawData) {
    let score = 50;
    const factors = [];
    
    if (rawData.census?.confidence === 'good') {
      const priceToIncome = rawData.census.computed_metrics.price_to_income_ratio;
      if (priceToIncome < 3) score += 20;
      else if (priceToIncome < 4) score += 10;
      else if (priceToIncome > 6) score -= 15;
      else if (priceToIncome > 8) score -= 25;
      
      factors.push(`Price-to-Income: ${priceToIncome.toFixed(1)}x`);
      
      const medianIncome = rawData.census.computed_metrics.median_household_income;
      if (medianIncome > 80000) score += 10;
      else if (medianIncome > 60000) score += 5;
      
      factors.push(`Median Income: $${medianIncome.toLocaleString()}`);
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      factors,
      confidence: rawData.census?.confidence || 'missing'
    };
  }

  calculateEconomicFundamentals(rawData) {
    let score = 50;
    const factors = [];
    
    if (rawData.bls?.confidence === 'good') {
      const unemploymentRate = rawData.bls.current_unemployment_rate;
      if (unemploymentRate < 3) score += 20;
      else if (unemploymentRate < 5) score += 10;
      else if (unemploymentRate > 8) score -= 20;
      
      factors.push(`Unemployment: ${unemploymentRate}%`);
    }
    
    if (rawData.census?.confidence === 'good') {
      const bachelorRate = rawData.census.computed_metrics.bachelor_plus_rate;
      if (bachelorRate > 40) score += 15;
      else if (bachelorRate > 25) score += 8;
      
      factors.push(`Bachelor+ Rate: ${bachelorRate.toFixed(1)}%`);
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      factors,
      confidence: rawData.bls?.confidence === 'good' ? 'good' : 'partial'
    };
  }

  calculateAmenitiesAccess(rawData) {
    let score = 50;
    const factors = [];
    
    if (rawData.places?.confidence === 'good') {
      const amenities = rawData.places.amenity_counts;
      let totalAmenities = 0;
      
      Object.entries(amenities).forEach(([type, data]) => {
        totalAmenities += data.count;
        factors.push(`${type}: ${data.count}`);
      });
      
      if (totalAmenities > 100) score += 20;
      else if (totalAmenities > 50) score += 15;
      else if (totalAmenities > 25) score += 10;
      else if (totalAmenities < 10) score -= 15;
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      factors,
      confidence: rawData.places?.confidence || 'missing'
    };
  }

  // === INVESTMENT SCORING ===
  computeInvestmentScore(metrics) {
    const weights = {
      market_momentum: 0.25,
      supply_demand: 0.20,
      rental_strength: 0.20,
      affordability: 0.15,
      economic_fundamentals: 0.15,
      amenities_access: 0.05
    };
    
    let weightedScore = 0;
    let totalWeight = 0;
    const componentScores = {};
    
    Object.entries(weights).forEach(([component, weight]) => {
      if (metrics[component]) {
        const score = metrics[component].score;
        const confidence = metrics[component].confidence;
        const multiplier = confidence === 'good' ? 1.0 : (confidence === 'partial' ? 0.8 : 0.0);
        
        weightedScore += (score * weight * multiplier);
        totalWeight += (weight * multiplier);
        
        componentScores[component] = {
          raw_score: score,
          weighted_score: score * weight * multiplier,
          confidence,
          factors: metrics[component].factors
        };
      }
    });
    
    const finalScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
    
    let band = 'Avoid';
    if (finalScore >= 90) band = 'Exceptional';
    else if (finalScore >= 75) band = 'Strong Buy';
    else if (finalScore >= 60) band = 'Moderate Opportunity';
    else if (finalScore >= 40) band = 'Market Rate';
    else if (finalScore >= 25) band = 'Below Average';
    
    return {
      final_score: finalScore,
      band,
      component_scores: componentScores,
      data_coverage: totalWeight / Object.values(weights).reduce((a, b) => a + b, 0),
      calculated_at: new Date().toISOString()
    };
  }

  // === DATA QUALITY ===
  assessDataQuality(rawData) {
    const sources = ['geography', 'census', 'bls', 'zillow', 'places', 'weather', 'news'];
    let totalScore = 0;
    let maxScore = 0;
    const sourceQualities = {};
    
    sources.forEach(source => {
      const data = rawData[source];
      let score = 0;
      let weight = 1;
      
      if (source === 'geography') weight = 3; // Critical
      else if (['census', 'zillow'].includes(source)) weight = 2; // Important
      
      if (data?.confidence === 'good') score = 100;
      else if (data?.confidence === 'partial') score = 60;
      else score = 0;
      
      sourceQualities[source] = {
        score,
        confidence: data?.confidence || 'missing',
        weight
      };
      
      totalScore += (score * weight);
      maxScore += (100 * weight);
    });
    
    return {
      overall_score: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      source_qualities: sourceQualities,
      assessment_date: new Date().toISOString()
    };
  }

  // === OUTPUT SAVING ===
  async saveAnalysisOutputs(analysisData, outputDir, slug) {
    // Save main analysis file
    await fs.writeFile(
      path.join(outputDir, `${slug}_analysis.json`),
      JSON.stringify(analysisData, null, 2)
    );
    
    // Save metrics summary
    const metricsSummary = {
      location: analysisData.meta.query,
      investment_score: analysisData.investment_score.final_score,
      band: analysisData.investment_score.band,
      data_quality: analysisData.data_quality.overall_score,
      key_metrics: {
        population: analysisData.raw_data.census?.computed_metrics?.population,
        median_income: analysisData.raw_data.census?.computed_metrics?.median_household_income,
        unemployment_rate: analysisData.raw_data.bls?.current_unemployment_rate,
        zhvi_1y_growth: analysisData.raw_data.zillow?.metrics?.zhvi_1y_growth,
        current_zhvi: analysisData.raw_data.zillow?.metrics?.current_zhvi
      },
      generated_at: new Date().toISOString()
    };
    
    await fs.writeFile(
      path.join(outputDir, `${slug}_summary.json`),
      JSON.stringify(metricsSummary, null, 2)
    );
    
    console.log(`✓ Saved analysis outputs to: ${outputDir}`);
  }

  // === UTILITY METHODS ===
  async rateLimitDelay(apiType) {
    const now = Date.now();
    const lastCall = this.lastApiCalls[apiType];
    const delay = this.rateLimits[apiType];
    const timeSinceLastCall = now - lastCall;
    
    if (timeSinceLastCall < delay) {
      await new Promise(resolve => setTimeout(resolve, delay - timeSinceLastCall));
    }
    
    this.lastApiCalls[apiType] = Date.now();
  }

  createSlug(location) {
    return location.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60);
  }
}

module.exports = UniversalDataOrchestrator;