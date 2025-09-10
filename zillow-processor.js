const fs = require('fs');
const path = require('path');

class ZillowProcessor {
  constructor() {
    this.dataDir = path.join(process.cwd(), 'data', 'zillow');
    this.locationCache = new Map(); // Cache for found locations
  }

  // Main entry point - works for any location
  async processLocationData(userLocation) {
    try {
      console.log(`Processing Zillow data for: ${userLocation}`);
      
      // Find the best matching metro area in our data
      const metroName = await this.findBestMetroMatch(userLocation);
      
      if (!metroName) {
        console.log(`No matching metro area found for: ${userLocation}`);
        return {
          error: `No Zillow data found for ${userLocation}`,
          available_metros: await this.getAvailableMetros(),
          confidence: 'missing'
        };
      }

      console.log(`Found metro match: ${metroName}`);

      const results = {
        zhvi: await this.getZHVIData(metroName),
        zori: await this.getZORIData(metroName),
        inventory: await this.getInventoryData(metroName),
        sales_count: await this.getSalesCountData(metroName),
        days_on_market: await this.getDaysOnMarketData(metroName),
        market_temp: await this.getMarketTempData(metroName)
      };

      const metrics = this.calculateMetrics(results);
      metrics.metro_name = metroName;
      metrics.user_input = userLocation;
      
      return metrics;
    } catch (error) {
      console.error('Error processing location data:', error);
      return {
        error: error.message,
        confidence: 'missing'
      };
    }
  }

  // Find the best matching metro area for any user input
  async findBestMetroMatch(userLocation) {
    // Check cache first
    if (this.locationCache.has(userLocation.toLowerCase())) {
      return this.locationCache.get(userLocation.toLowerCase());
    }

    const availableMetros = await this.getAvailableMetros();
    const searchTerms = this.extractSearchTerms(userLocation);
    
    console.log(`Searching for: ${searchTerms.join(', ')} in ${availableMetros.length} metros`);

    // Try exact matches first
    for (const metro of availableMetros) {
      for (const term of searchTerms) {
        if (metro.toLowerCase().includes(term.toLowerCase())) {
          this.locationCache.set(userLocation.toLowerCase(), metro);
          return metro;
        }
      }
    }

    // Try fuzzy matching for common abbreviations/variations
    const match = this.fuzzyMatchMetro(searchTerms, availableMetros);
    if (match) {
      this.locationCache.set(userLocation.toLowerCase(), match);
      return match;
    }

    return null;
  }

  // Extract search terms from user input
  extractSearchTerms(location) {
    const terms = [];
    
    // Clean and split the input
    const cleaned = location.replace(/[,\-\.]/g, ' ').trim();
    const parts = cleaned.split(/\s+/);
    
    // Add individual parts
    terms.push(...parts);
    
    // Add combinations for cities like "New York", "Los Angeles"
    if (parts.length >= 2) {
      for (let i = 0; i < parts.length - 1; i++) {
        terms.push(parts[i] + ' ' + parts[i + 1]);
      }
    }

    // Remove common words
    const stopWords = ['the', 'of', 'in', 'at', 'to', 'for', 'on', 'with'];
    return terms.filter(term => 
      term.length > 1 && 
      !stopWords.includes(term.toLowerCase())
    );
  }

  // Fuzzy matching for common metro area variations
  fuzzyMatchMetro(searchTerms, availableMetros) {
    const aliases = {
      'nyc': 'New York',
      'ny': 'New York',
      'la': 'Los Angeles',
      'sf': 'San Francisco',
      'dc': 'Washington',
      'philly': 'Philadelphia',
      'boston': 'Boston',
      'chicago': 'Chicago',
      'miami': 'Miami',
      'atlanta': 'Atlanta',
      'dallas': 'Dallas',
      'houston': 'Houston',
      'phoenix': 'Phoenix',
      'denver': 'Denver',
      'seattle': 'Seattle',
      'nashville': 'Nashville'
    };

    for (const term of searchTerms) {
      const alias = aliases[term.toLowerCase()];
      if (alias) {
        const match = availableMetros.find(metro => 
          metro.toLowerCase().includes(alias.toLowerCase())
        );
        if (match) return match;
      }
    }

    return null;
  }

  // Get list of all available metro areas from ZHVI file
  async getAvailableMetros() {
    try {
      const filePath = path.join(this.dataDir, 'Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv');
      
      if (!fs.existsSync(filePath)) {
        return [];
      }

      const csvContent = fs.readFileSync(filePath, 'utf8');
      const lines = csvContent.split('\n');
      const metros = [];

      // Extract metro names from RegionName column (index 2)
      for (let i = 1; i < lines.length && i < 50; i++) { // Limit to first 50 for sample
        const row = lines[i].split(',');
        if (row[2] && row[2].trim() && row[2] !== 'RegionName') {
          metros.push(row[2].trim().replace(/"/g, ''));
        }
      }

      return metros;
    } catch (error) {
      console.error('Error getting available metros:', error);
      return [];
    }
  }

  // Data extraction methods (now take metroName parameter)
  async getZHVIData(metroName) {
    const filePath = path.join(this.dataDir, 'Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv');
    return this.extractRegionData(filePath, metroName);
  }

  async getZORIData(metroName) {
    const filePath = path.join(this.dataDir, 'Metro_zori_uc_sfrcondomfr_sm_month.csv');
    return this.extractRegionData(filePath, metroName);
  }

  async getInventoryData(metroName) {
    const filePath = path.join(this.dataDir, 'Metro_invt_fs_uc_sfrcondo_sm_month.csv');
    return this.extractRegionData(filePath, metroName);
  }

  async getSalesCountData(metroName) {
    const filePath = path.join(this.dataDir, 'Metro_sales_count_now_uc_sfrcondo_month.csv');
    return this.extractRegionData(filePath, metroName);
  }

  async getDaysOnMarketData(metroName) {
    const filePath = path.join(this.dataDir, 'Metro_mean_doz_pending_uc_sfrcondo_sm_month.csv');
    return this.extractRegionData(filePath, metroName);
  }

  async getMarketTempData(metroName) {
    const filePath = path.join(this.dataDir, 'Metro_market_temp_index_uc_sfrcondo_month.csv');
    return this.extractRegionData(filePath, metroName);
  }

  // Generic region data extraction
  async extractRegionData(filePath, targetMetroName) {
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return null;
      }

      const csvContent = fs.readFileSync(filePath, 'utf8');
      const lines = csvContent.split('\n');
      const headers = lines[0].split(',');
      
      // Find matching metro row
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        const regionName = row[2] && row[2].trim().replace(/"/g, '');
        
        if (regionName === targetMetroName) {
          const data = {};
          headers.forEach((header, index) => {
            const value = row[index];
            if (header.match(/\d{4}-\d{2}-\d{2}/)) {
              data[header] = value && value !== '' ? parseFloat(value) : null;
            } else {
              data[header] = value;
            }
          });
          return data;
        }
      }
      
      console.log(`Metro "${targetMetroName}" not found in ${path.basename(filePath)}`);
      return null;
    } catch (error) {
      console.error(`Error reading ${filePath}:`, error);
      return null;
    }
  }

  // Calculate investment metrics (unchanged)
  calculateMetrics(data) {
    const metrics = {
      retrieved_at: new Date().toISOString(),
      source: 'local_zillow_data',
      confidence: 'good'
    };

    // ZHVI (Home Value Index) calculations
    if (data.zhvi) {
      const zhviDates = Object.keys(data.zhvi).filter(k => k.match(/\d{4}-\d{2}-\d{2}/)).sort();
      if (zhviDates.length > 0) {
        const latestZhvi = data.zhvi[zhviDates[zhviDates.length - 1]];
        
        if (zhviDates.length >= 13) {
          const zhvi1YearAgo = data.zhvi[zhviDates[zhviDates.length - 13]];
          if (latestZhvi && zhvi1YearAgo) {
            metrics.zhvi_1y_growth = ((latestZhvi - zhvi1YearAgo) / zhvi1YearAgo * 100).toFixed(2);
          }
        }
        
        if (zhviDates.length >= 37) {
          const zhvi3YearAgo = data.zhvi[zhviDates[zhviDates.length - 37]];
          if (latestZhvi && zhvi3YearAgo) {
            const cagr = (Math.pow(latestZhvi / zhvi3YearAgo, 1/3) - 1) * 100;
            metrics.zhvi_3y_cagr = cagr.toFixed(2);
          }
        }

        metrics.current_zhvi = latestZhvi;
      }
    }

    // ZORI (Rental Index) calculations
    if (data.zori) {
      const zoriDates = Object.keys(data.zori).filter(k => k.match(/\d{4}-\d{2}-\d{2}/)).sort();
      if (zoriDates.length > 0) {
        const latestZori = data.zori[zoriDates[zoriDates.length - 1]];
        
        if (zoriDates.length >= 13) {
          const zori1YearAgo = data.zori[zoriDates[zoriDates.length - 13]];
          if (latestZori && zori1YearAgo) {
            metrics.zori_1y_growth = ((latestZori - zori1YearAgo) / zori1YearAgo * 100).toFixed(2);
          }
        }

        metrics.current_zori = latestZori;
        
        // Calculate rent-to-price ratio
        if (metrics.current_zhvi && latestZori) {
          metrics.rent_to_price_ratio = ((latestZori * 12) / metrics.current_zhvi * 100).toFixed(2);
        }
      }
    }

    // Inventory (months supply)
    if (data.inventory) {
      const invDates = Object.keys(data.inventory).filter(k => k.match(/\d{4}-\d{2}-\d{2}/)).sort();
      if (invDates.length > 0) {
        metrics.months_supply = data.inventory[invDates[invDates.length - 1]];
      }
    }

    // Days on Market
    if (data.days_on_market) {
      const domDates = Object.keys(data.days_on_market).filter(k => k.match(/\d{4}-\d{2}-\d{2}/)).sort();
      if (domDates.length > 0) {
        metrics.days_on_market = data.days_on_market[domDates[domDates.length - 1]];
      }
    }

    // Market Temperature
    if (data.market_temp) {
      const tempDates = Object.keys(data.market_temp).filter(k => k.match(/\d{4}-\d{2}-\d{2}/)).sort();
      if (tempDates.length > 0) {
        metrics.market_temperature = data.market_temp[tempDates[tempDates.length - 1]];
        
        // Calculate 6-month trend
        if (tempDates.length >= 7) {
          const temp6MonthsAgo = data.market_temp[tempDates[tempDates.length - 7]];
          if (temp6MonthsAgo) {
            metrics.market_temp_6m_trend = (metrics.market_temperature - temp6MonthsAgo).toFixed(2);
          }
        }
      }
    }

    // Sales Count and Velocity
    if (data.sales_count) {
      const salesDates = Object.keys(data.sales_count).filter(k => k.match(/\d{4}-\d{2}-\d{2}/)).sort();
      if (salesDates.length > 0) {
        metrics.current_sales_count = data.sales_count[salesDates[salesDates.length - 1]];
        
        if (salesDates.length >= 13) {
          const sales1YearAgo = data.sales_count[salesDates[salesDates.length - 13]];
          if (sales1YearAgo && metrics.current_sales_count) {
            metrics.sales_velocity_trend = ((metrics.current_sales_count - sales1YearAgo) / sales1YearAgo * 100).toFixed(2);
          }
        }
      }
    }

    return metrics;
  }
}

module.exports = ZillowProcessor;