// server/fetchers/zillow.js
import fs from 'fs/promises';
import Papa from 'papaparse';
import path from 'path';

// Zillow doesn't have a public API, so we work with their CSV downloads
// These should be downloaded and placed in a data directory
const DATA_DIR = path.join(process.cwd(), 'data', 'zillow');

export async function loadZillowZHVI(zipCodes = null) {
  try {
    // Check for ZHVI (Zillow Home Value Index) file
    const zhviPath = path.join(DATA_DIR, 'Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv');
    
    const fileExists = await fs.access(zhviPath).then(() => true).catch(() => false);
    if (!fileExists) {
      return {
        retrieved_at: new Date().toISOString(),
        source: zhviPath,
        confidence: 'missing',
        error: 'ZHVI CSV file not found. Download from Zillow Research.',
        instruction: 'Download Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv from https://www.zillow.com/research/data/'
      };
    }

    const csvContent = await fs.readFile(zhviPath, 'utf8');
    const parsed = Papa.parse(csvContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true
    });

    if (parsed.errors.length > 0) {
      return {
        retrieved_at: new Date().toISOString(),
        source: zhviPath,
        confidence: 'missing',
        error: 'CSV parsing error',
        details: parsed.errors
      };
    }

    // Filter for specific ZIP codes if provided
    let data = parsed.data;
    if (zipCodes) {
      const zipArray = Array.isArray(zipCodes) ? zipCodes : [zipCodes];
      data = data.filter(row => zipArray.includes(row.RegionName?.toString()));
    }

    // Transform to time series format
    const timeSeriesData = {};
    
    data.forEach(row => {
      const zip = row.RegionName?.toString();
      if (!zip) return;
      
      const timeSeries = {};
      Object.keys(row).forEach(key => {
        // Date columns are in YYYY-MM-DD format
        if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
          if (row[key] !== null && row[key] !== undefined) {
            timeSeries[key] = row[key];
          }
        }
      });
      
      timeSeriesData[zip] = {
        region_name: row.RegionName,
        region_type: row.RegionType,
        state_name: row.StateName,
        metro: row.Metro,
        county_name: row.CountyName,
        time_series: timeSeries
      };
    });

    return {
      retrieved_at: new Date().toISOString(),
      source: zhviPath,
      confidence: 'good',
      data: timeSeriesData,
      record_count: Object.keys(timeSeriesData).length
    };

  } catch (error) {
    return {
      retrieved_at: new Date().toISOString(),
      source: 'zillow_zhvi',
      confidence: 'missing',
      error: error.message
    };
  }
}

export async function loadZillowZORI(zipCodes = null) {
  try {
    // ZORI (Zillow Observed Rent Index)
    const zoriPath = path.join(DATA_DIR, 'Zip_zori_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv');
    
    const fileExists = await fs.access(zoriPath).then(() => true).catch(() => false);
    if (!fileExists) {
      return {
        retrieved_at: new Date().toISOString(),
        source: zoriPath,
        confidence: 'missing',
        error: 'ZORI CSV file not found'
      };
    }

    const csvContent = await fs.readFile(zoriPath, 'utf8');
    const parsed = Papa.parse(csvContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true
    });

    // Filter and transform similar to ZHVI
    let data = parsed.data;
    if (zipCodes) {
      const zipArray = Array.isArray(zipCodes) ? zipCodes : [zipCodes];
      data = data.filter(row => zipArray.includes(row.RegionName?.toString()));
    }

    const timeSeriesData = {};
    
    data.forEach(row => {
      const zip = row.RegionName?.toString();
      if (!zip) return;
      
      const timeSeries = {};
      Object.keys(row).forEach(key => {
        if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
          if (row[key] !== null && row[key] !== undefined) {
            timeSeries[key] = row[key];
          }
        }
      });
      
      timeSeriesData[zip] = {
        region_name: row.RegionName,
        region_type: row.RegionType,
        state_name: row.StateName,
        metro: row.Metro,
        county_name: row.CountyName,
        time_series: timeSeries
      };
    });

    return {
      retrieved_at: new Date().toISOString(),
      source: zoriPath,
      confidence: 'good',
      data: timeSeriesData,
      record_count: Object.keys(timeSeriesData).length
    };

  } catch (error) {
    return {
      retrieved_at: new Date().toISOString(),
      source: 'zillow_zori',
      confidence: 'missing',
      error: error.message
    };
  }
}

export async function loadZillowInventory(metros = null) {
  try {
    // Metro-level inventory data
    const inventoryPath = path.join(DATA_DIR, 'Metro_invt_fs_uc_sfrcondo_sm_month.csv');
    
    const fileExists = await fs.access(inventoryPath).then(() => true).catch(() => false);
    if (!fileExists) {
      return {
        retrieved_at: new Date().toISOString(),
        source: inventoryPath,
        confidence: 'missing',
        error: 'Inventory CSV file not found'
      };
    }

    const csvContent = await fs.readFile(inventoryPath, 'utf8');
    const parsed = Papa.parse(csvContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true
    });

    let data = parsed.data;
    if (metros) {
      const metroArray = Array.isArray(metros) ? metros : [metros];
      data = data.filter(row => metroArray.includes(row.RegionName));
    }

    const timeSeriesData = {};
    
    data.forEach(row => {
      const metro = row.RegionName;
      if (!metro) return;
      
      const timeSeries = {};
      Object.keys(row).forEach(key => {
        if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
          if (row[key] !== null && row[key] !== undefined) {
            timeSeries[key] = row[key];
          }
        }
      });
      
      timeSeriesData[metro] = {
        region_name: row.RegionName,
        region_type: row.RegionType,
        state_name: row.StateName,
        time_series: timeSeries
      };
    });

    return {
      retrieved_at: new Date().toISOString(),
      source: inventoryPath,
      confidence: 'good',
      data: timeSeriesData,
      record_count: Object.keys(timeSeriesData).length
    };

  } catch (error) {
    return {
      retrieved_at: new Date().toISOString(),
      source: 'zillow_inventory',
      confidence: 'missing',
      error: error.message
    };
  }
}

export async function loadZillowSales(metros = null) {
  try {
    // Metro-level sales count data
    const salesPath = path.join(DATA_DIR, 'Metro_sales_count_now_uc_sfrcondo_month.csv');
    
    const fileExists = await fs.access(salesPath).then(() => true).catch(() => false);
    if (!fileExists) {
      return {
        retrieved_at: new Date().toISOString(),
        source: salesPath,
        confidence: 'missing',
        error: 'Sales CSV file not found'
      };
    }

    const csvContent = await fs.readFile(salesPath, 'utf8');
    const parsed = Papa.parse(csvContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true
    });

    let data = parsed.data;
    if (metros) {
      const metroArray = Array.isArray(metros) ? metros : [metros];
      data = data.filter(row => metroArray.includes(row.RegionName));
    }

    const timeSeriesData = {};
    
    data.forEach(row => {
      const metro = row.RegionName;
      if (!metro) return;
      
      const timeSeries = {};
      Object.keys(row).forEach(key => {
        if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
          if (row[key] !== null && row[key] !== undefined) {
            timeSeries[key] = row[key];
          }
        }
      });
      
      timeSeriesData[metro] = {
        region_name: row.RegionName,
        region_type: row.RegionType,
        state_name: row.StateName,
        time_series: timeSeries
      };
    });

    return {
      retrieved_at: new Date().toISOString(),
      source: salesPath,
      confidence: 'good',
      data: timeSeriesData,
      record_count: Object.keys(timeSeriesData).length
    };

  } catch (error) {
    return {
      retrieved_at: new Date().toISOString(),
      source: 'zillow_sales',
      confidence: 'missing',
      error: error.message
    };
  }
}

export function calculateZillowMetrics(zhviData, zoriData) {
  const metrics = {};
  
  if (zhviData?.time_series && zoriData?.time_series) {
    const zhviDates = Object.keys(zhviData.time_series).sort();
    const zoriDates = Object.keys(zoriData.time_series).sort();
    
    // Get most recent values
    const latestZhvi = zhviData.time_series[zhviDates[zhviDates.length - 1]];
    const latestZori = zoriData.time_series[zoriDates[zoriDates.length - 1]];
    
    if (latestZhvi && latestZori) {
      // Calculate rent-to-price ratio (annualized)
      metrics.rent_to_price_ratio = (latestZori * 12) / latestZhvi;
      
      // Calculate 1-year price appreciation
      const oneYearAgo = zhviDates[zhviDates.length - 13]; // Approximately 1 year ago
      if (oneYearAgo && zhviData.time_series[oneYearAgo]) {
        metrics.zhvi_1y_appreciation = ((latestZhvi - zhviData.time_series[oneYearAgo]) / zhviData.time_series[oneYearAgo]) * 100;
      }
      
      // Calculate 1-year rent appreciation
      const oneYearAgoRent = zoriDates[zoriDates.length - 13];
      if (oneYearAgoRent && zoriData.time_series[oneYearAgoRent]) {
        metrics.zori_1y_appreciation = ((latestZori - zoriData.time_series[oneYearAgoRent]) / zoriData.time_series[oneYearAgoRent]) * 100;
      }
    }
  }
  
  return metrics;
}

export async function setupZillowDataDirectory() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    const instructions = `
Zillow Data Setup Instructions:

1. Create the directory: ${DATA_DIR}

2. Download these files from https://www.zillow.com/research/data/:
   - Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv (Home Values)
   - Zip_zori_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv (Rent Index)
   - Metro_invt_fs_uc_sfrcondo_sm_month.csv (Inventory)
   - Metro_sales_count_now_uc_sfrcondo_month.csv (Sales Count)

3. Place all CSV files in: ${DATA_DIR}

4. Restart your server after adding the files.
`;
    
    const readmePath = path.join(DATA_DIR, 'README.txt');
    await fs.writeFile(readmePath, instructions);
    
    return {
      success: true,
      directory: DATA_DIR,
      instructions
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}