// server/fetchers/census.js
import fetch from 'node-fetch';

const CENSUS_API_KEY = process.env.CENSUS_API_KEY;
const BASE_URL = 'https://api.census.gov/data';

// Key ACS variables for real estate analysis
const HOUSING_VARIABLES = {
  'B25001_001E': 'total_housing_units',
  'B25003_001E': 'total_occupied_units',
  'B25003_002E': 'owner_occupied',
  'B25003_003E': 'renter_occupied',
  'B25077_001E': 'median_home_value',
  'B25064_001E': 'median_gross_rent',
  'B25004_008E': 'vacant_for_rent',
  'B25004_004E': 'vacant_for_sale'
};

const DEMOGRAPHIC_VARIABLES = {
  'B01003_001E': 'total_population',
  'B19013_001E': 'median_household_income',
  'B25119_001E': 'median_household_income_owner',
  'B25119_003E': 'median_household_income_renter',
  'B15003_022E': 'bachelors_degree',
  'B08303_001E': 'total_commuters',
  'B08303_013E': 'commute_over_60min'
};

const ECONOMIC_VARIABLES = {
  'B23025_002E': 'labor_force',
  'B23025_005E': 'unemployed',
  'B08124_001E': 'median_travel_time_work'
};

export async function fetchCensusACS(geoids, year = 2022, geography = 'tract') {
  if (!CENSUS_API_KEY) {
    return { 
      retrieved_at: new Date().toISOString(), 
      source: 'census_acs', 
      confidence: 'missing', 
      error: 'CENSUS_API_KEY not configured' 
    };
  }

  // Combine all variables
  const allVariables = { ...HOUSING_VARIABLES, ...DEMOGRAPHIC_VARIABLES, ...ECONOMIC_VARIABLES };
  const variableList = Object.keys(allVariables).join(',');
  
  const results = {};
  
  // Process geoids in batches (Census API has limits)
  const batchSize = 10;
  const geoidArray = Array.isArray(geoids) ? geoids : [geoids];
  
  for (let i = 0; i < geoidArray.length; i += batchSize) {
    const batch = geoidArray.slice(i, i + batchSize);
    
    for (const geoid of batch) {
      try {
        const tractData = await fetchSingleGeoid(geoid, variableList, year, geography);
        results[geoid] = tractData;
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results[geoid] = {
          error: error.message,
          confidence: 'missing'
        };
      }
    }
  }
  
  return {
    retrieved_at: new Date().toISOString(),
    source: `${BASE_URL}/${year}/acs/acs5`,
    confidence: Object.values(results).some(r => r.confidence === 'good') ? 'partial' : 'missing',
    data: results,
    variable_definitions: allVariables
  };
}

async function fetchSingleGeoid(geoid, variableList, year, geography) {
  let url;
  
  if (geography === 'tract') {
    // Parse tract GEOID (11 digits: state(2) + county(3) + tract(6))
    const state = geoid.substring(0, 2);
    const county = geoid.substring(2, 5);
    const tract = geoid.substring(5);
    
    url = `${BASE_URL}/${year}/acs/acs5?get=${variableList}&for=tract:${tract}&in=state:${state}%20county:${county}&key=${CENSUS_API_KEY}`;
  } else if (geography === 'zcta') {
    // ZIP Code Tabulation Area
    url = `${BASE_URL}/${year}/acs/acs5?get=${variableList}&for=zip%20code%20tabulation%20area:${geoid}&key=${CENSUS_API_KEY}`;
  } else if (geography === 'place') {
    // Place (city/town)
    const state = geoid.substring(0, 2);
    const place = geoid.substring(2);
    url = `${BASE_URL}/${year}/acs/acs5?get=${variableList}&for=place:${place}&in=state:${state}&key=${CENSUS_API_KEY}`;
  }
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (!response.ok || !data || data.length < 2) {
    throw new Error(`Census API error for ${geoid}: ${data?.[0] || 'No data returned'}`);
  }
  
  // Parse the response (first row is headers, second row is data)
  const headers = data[0];
  const values = data[1];
  
  const parsed = {};
  headers.forEach((header, index) => {
    if (header.endsWith('E')) { // Estimate variables
      const value = values[index];
      parsed[header] = value === null || value === -666666666 ? null : parseFloat(value);
    }
  });
  
  return {
    geoid,
    year,
    geography,
    confidence: 'good',
    variables: parsed,
    source_url: url
  };
}

export async function fetchCensusTimeSeries(geoids, years = [2018, 2019, 2020, 2021, 2022]) {
  const timeSeries = {};
  
  for (const year of years) {
    const yearData = await fetchCensusACS(geoids, year);
    timeSeries[year] = yearData;
    
    // Delay between years to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return {
    retrieved_at: new Date().toISOString(),
    source: 'census_acs_timeseries',
    confidence: 'good',
    time_series: timeSeries
  };
}

export async function getGeographyHierarchy(lat, lng) {
  // Get tract, ZIP, place, county, and CBSA for coordinates
  if (!CENSUS_API_KEY) {
    return { 
      retrieved_at: new Date().toISOString(), 
      source: 'census_geography', 
      confidence: 'missing', 
      error: 'CENSUS_API_KEY not configured' 
    };
  }

  try {
    const year = 2022;
    const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.result?.geographies) {
      throw new Error('No geography data returned');
    }
    
    const geographies = data.result.geographies;
    
    return {
      retrieved_at: new Date().toISOString(),
      source: url,
      confidence: 'good',
      tract: geographies['Census Tracts']?.[0] || null,
      block_group: geographies['Census Block Groups']?.[0] || null,
      county: geographies['Counties']?.[0] || null,
      state: geographies['States']?.[0] || null,
      place: geographies['Incorporated Places']?.[0] || null,
      zcta: geographies['Zip Code Tabulation Areas']?.[0] || null
    };
  } catch (error) {
    return {
      retrieved_at: new Date().toISOString(),
      source: 'census_geography_lookup',
      confidence: 'missing',
      error: error.message
    };
  }
}

export function calculateHousingMetrics(censusData) {
  const metrics = {};
  
  if (censusData.variables) {
    const v = censusData.variables;
    
    // Vacancy rates
    if (v['B25001_001E'] && v['B25003_001E']) {
      metrics.vacancy_rate = ((v['B25001_001E'] - v['B25003_001E']) / v['B25001_001E']) * 100;
    }
    
    // Rental vs ownership rates
    if (v['B25003_001E']) {
      metrics.ownership_rate = (v['B25003_002E'] / v['B25003_001E']) * 100;
      metrics.rental_rate = (v['B25003_003E'] / v['B25003_001E']) * 100;
    }
    
    // Price to income ratio (basic approximation)
    if (v['B25077_001E'] && v['B19013_001E']) {
      metrics.price_to_income_ratio = v['B25077_001E'] / v['B19013_001E'];
    }
    
    // Rent to income ratio
    if (v['B25064_001E'] && v['B19013_001E']) {
      metrics.rent_to_income_ratio = (v['B25064_001E'] * 12) / v['B19013_001E'];
    }
  }
  
  return metrics;
}