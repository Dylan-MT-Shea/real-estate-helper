// --- Global error logging ---
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

require('dotenv').config();

if (!process.env.OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in environment. Add it to your .env and restart.');
  process.exit(1);
}

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const ZillowProcessor = require('./zillow-processor');

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// --- MongoDB Connection ---
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/deko';
mongoose
  .connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// --- Schemas and Models ---
const propertySchema = new mongoose.Schema({
  address: String,
  price: Number,
  bedrooms: Number,
  bathrooms: Number,
  sqft: Number
});
const Property = mongoose.model('Property', propertySchema);

const userSchema = new mongoose.Schema({
  name: String,
  plan: String,
  mode: { type: String, default: 'flip' }
});
const User = mongoose.model('User', userSchema);

// --- OpenAI Client ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// --- Updated Prompt Files Mapping ---
const PROMPT_FILES = {
  flip: 'property-evaluation.txt',
  homeowner: 'real-estate-analysis.txt',
  rental: 'rental-investment-analysis.txt',
  investment: 'investment-analysis.js'
};

// --- Sophisticated Analysis Orchestrator (inline version) ---
// Note: In production, this would be in a separate orchestrator.js file
class DataOrchestrator {
  constructor() {
    this.hasGoogleKey = !!process.env.GOOGLE_API_KEY;
    this.hasCensusKey = !!process.env.CENSUS_API_KEY;
    this.hasWeatherKey = !!process.env.WEATHER_API_KEY;
    this.hasBLSKey = !!process.env.BLS_API_KEY;
  }

  async buildRawData(location, mode = 'point', topN = 5) {
    const startTime = Date.now();
    console.log(`\n=== ORCHESTRATOR: Building raw data for "${location}" (${mode} mode) ===`);
    
    // Create slug for file naming
    const slug = location.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60);
      
    // Create output directory
    const outputDir = path.join(process.cwd(), 'outputs', slug);
    await fs.promises.mkdir(outputDir, { recursive: true });
    
    const rawData = {
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
          bls: this.hasBLSKey
        }
      },
      geography: {},
      sources: [],
      data_summary: {}
    };

    try {
      // Step 1: Basic geocoding (simplified)
      if (this.hasGoogleKey) {
        rawData.geography = await this.geocodeLocation(location);
      } else {
        rawData.geography = {
          query: location,
          confidence: 'missing',
          error: 'Google API key not configured'
        };
      }

      // Step 2: Determine scope
      if (mode === 'region') {
        rawData.analysis_scope = {
          mode: 'region',
          candidates: await this.generateRegionCandidates(location, topN)
        };
      } else {
        rawData.analysis_scope = {
          mode: 'point',
          location: location
        };
      }

      // Step 3: Gather available data
      rawData.market_data = await this.gatherMarketData(location);
      rawData.demographic_data = await this.gatherDemographicData(location);
      rawData.economic_data = await this.gatherEconomicData(location);
      rawData.amenities_data = await this.gatherAmenitiesData(location);

      // Step 4: Save raw data
      const processingTime = Date.now() - startTime;
      rawData.meta.processing_time_ms = processingTime;
      
      const rawDataPath = path.join(outputDir, `${slug}_raw_data.json`);
      await fs.promises.writeFile(rawDataPath, JSON.stringify(rawData, null, 2));
      
      console.log(`✓ Raw data saved: ${rawDataPath}`);
      console.log(`✓ Processing completed in ${processingTime}ms`);
      
      return {
        raw_data: rawData,
        output_dir: outputDir,
        slug,
        processing_time: processingTime
      };

    } catch (error) {
      console.error('Orchestrator error:', error);
      
      // Save error state
      const errorData = {
        error: error.message,
        location,
        mode,
        timestamp: new Date().toISOString()
      };
      
      const errorPath = path.join(outputDir, `${slug}_error.json`);
      await fs.promises.writeFile(errorPath, JSON.stringify(errorData, null, 2));
      
      throw error;
    }
  }

  async geocodeLocation(location) {
    if (!this.hasGoogleKey) {
      return {
        confidence: 'missing',
        error: 'Google API key not configured'
      };
    }

    try {
      const fetch = require('node-fetch');
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${process.env.GOOGLE_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      return {
        retrieved_at: new Date().toISOString(),
        source: 'google_geocoding',
        confidence: data.status === 'OK' ? 'good' : 'partial',
        results: data.results || [],
        coordinates: data.results?.[0]?.geometry?.location || null
      };
    } catch (error) {
      return {
        confidence: 'missing',
        error: error.message
      };
    }
  }

  async generateRegionCandidates(location, topN) {
    // Simplified region candidate generation
    const candidates = [];
    for (let i = 1; i <= topN; i++) {
      candidates.push({
        name: `${location} Area ${i}`,
        confidence: 'synthetic',
        note: 'Simplified placeholder - production would use Census Place data'
      });
    }
    return candidates;
  }

async gatherMarketData(location) {
    const data = {
      retrieved_at: new Date().toISOString(),
      sources: []
    };

    const zillowProcessor = new ZillowProcessor();

    try {
      console.log(`Processing Zillow data for any location: ${location}`);
      
      // Use the universal processor for any location
      const locationMetrics = await zillowProcessor.processLocationData(location);
      
      if (locationMetrics && !locationMetrics.error) {
        data.zillow_metrics = locationMetrics;
        data.zillow_metrics.confidence = 'good';
        data.zillow_metrics.source = 'local_zillow_csv_files';
        
        console.log(`✓ Successfully loaded metrics for ${locationMetrics.metro_name}:`, {
          zhvi_1y_growth: locationMetrics.zhvi_1y_growth,
          current_zhvi: locationMetrics.current_zhvi,
          market_temperature: locationMetrics.market_temperature,
          days_on_market: locationMetrics.days_on_market
        });
      } else if (locationMetrics && locationMetrics.error) {
        data.zillow_metrics = {
          confidence: 'missing',
          error: locationMetrics.error,
          available_metros_sample: locationMetrics.available_metros?.slice(0, 10) // Show first 10 as examples
        };
        console.log(`✗ No Zillow data found for: ${location}`);
      } else {
        data.zillow_metrics = {
          confidence: 'missing',
          error: 'Could not process Zillow data for this location'
        };
      }
    } catch (error) {
      console.error('Error processing Zillow data:', error);
      data.zillow_metrics = {
        confidence: 'missing',
        error: error.message
      };
    }

    return data;
  }
  async gatherDemographicData(location) {
    const data = {
      retrieved_at: new Date().toISOString()
    };

    if (this.hasCensusKey) {
      try {
        // Simplified Census data gathering
        data.census = {
          confidence: 'good',
          note: 'Census API key available - would fetch ACS data',
          api_key_configured: true
        };
      } catch (error) {
        data.census = {
          confidence: 'missing',
          error: error.message
        };
      }
    } else {
      data.census = {
        confidence: 'missing',
        error: 'Census API key not configured'
      };
    }

    return data;
  }

  async gatherEconomicData(location) {
    const data = {
      retrieved_at: new Date().toISOString()
    };

    if (this.hasBLSKey) {
      data.bls = {
        confidence: 'good',
        note: 'BLS API key available - would fetch employment data'
      };
    } else {
      data.bls = {
        confidence: 'missing',
        error: 'BLS API key not configured'
      };
    }

    return data;
  }

  async gatherAmenitiesData(location) {
    const data = {
      retrieved_at: new Date().toISOString()
    };

    if (this.hasGoogleKey) {
      data.google_places = {
        confidence: 'good',
        note: 'Google API key available - would fetch Places data'
      };
    } else {
      data.google_places = {
        confidence: 'missing',
        error: 'Google API key not configured'
      };
    }

    return data;
  }
}

// Initialize orchestrator
const orchestrator = new DataOrchestrator();

// Load prompt from file
function loadPromptTemplate(mode) {
  const filename = PROMPT_FILES[mode];
  if (!filename) {
    throw new Error(`No prompt template configured for mode: ${mode}`);
  }

  // Try multiple locations
  const locations = [
    path.join(__dirname, 'prompts', mode, filename),
    path.join(__dirname, 'prompts', filename),
    path.join(__dirname, filename)
  ];

  console.log(`\n=== LOADING PROMPT FOR MODE: ${mode} ===`);
  console.log(`Looking for file: ${filename}`);
  console.log(`Checking locations:`);
  
  for (const location of locations) {
    console.log(`  - ${location} ${fs.existsSync(location) ? '✓ EXISTS' : '✗ NOT FOUND'}`);
    if (fs.existsSync(location)) {
      console.log(`Loading prompt from: ${location}`);
      const content = fs.readFileSync(location, 'utf8');
      console.log(`Loaded ${content.length} characters`);
      console.log(`First 200 chars: ${content.substring(0, 200)}...`);
      return content;
    }
  }

  throw new Error(`Prompt template not found for mode "${mode}". Tried: ${locations.join(', ')}`);
}

// Build property context string
function buildPropertyContext(property) {
  return `
Property Details:
- Address: ${property.address || 'Not provided'}
- Price: $${property.price?.toLocaleString() || 'Not provided'}
- Bedrooms: ${property.bedrooms || 'Not provided'}
- Bathrooms: ${property.bathrooms || 'Not provided'}
- Square Feet: ${property.sqft?.toLocaleString() || 'Not provided'}
- Price per Sq Ft: $${property.price && property.sqft ? Math.round(property.price / property.sqft) : 'N/A'}
`;
}

// Build messages for OpenAI (property-based modes)
function buildMessages(promptTemplate, property, mode) {
  const propertyContext = buildPropertyContext(property);

  return [
    {
      role: 'system',
      content: promptTemplate
    },
    {
      role: 'user',
      content: propertyContext
    }
  ];
}

// Clean and validate JSON response
function cleanJsonResponse(text) {
  // Remove any markdown code blocks
  text = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '');

  // Try to find JSON object in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    text = jsonMatch[0];
  }

  try {
    // Validate it's proper JSON
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    console.error('Failed to parse JSON response:', e);
    // Return a formatted error response
    return JSON.stringify(
      {
        error: 'Analysis failed to generate valid JSON',
        rawResponse: text.substring(0, 500)
      },
      null,
      2
    );
  }
}

// Helper function to determine analysis mode
function determineAnalysisMode(input, topN) {
  const lowerInput = input.toLowerCase();
  
  // Check for explicit region indicators
  const regionKeywords = [
    'top', 'best', 'compare', 'region', 'area', 'coast', 'valley', 
    'lake', 'river', 'county', 'counties', 'around', 'near',
    'along', 'corridor', 'metro', 'metropolitan'
  ];
  
  const hasRegionKeyword = regionKeywords.some(keyword => lowerInput.includes(keyword));
  const hasTopN = topN && topN > 1;
  
  // Check if it's a specific address/ZIP (point mode)
  const zipCodePattern = /^\d{5}(-\d{4})?$/;
  const isZipCode = zipCodePattern.test(input.trim());
  
  if (isZipCode && !hasRegionKeyword && !hasTopN) {
    return 'point';
  }
  
  if (hasRegionKeyword || hasTopN) {
    return 'region';
  }
  
  // Default to point mode for specific city names
  return 'point';
}

// Helper function to summarize raw_data if payload is too large
function summarizeRawData(rawData) {
  const summary = {
    meta: rawData.meta,
    geography: rawData.geography,
    sources: rawData.sources?.slice(0, 10) || [], // Limit sources
    summary: {
      data_availability: {
        market_data: rawData.market_data ? 'available' : 'missing',
        demographic_data: rawData.demographic_data ? 'available' : 'missing',
        economic_data: rawData.economic_data ? 'available' : 'missing',
        amenities_data: rawData.amenities_data ? 'available' : 'missing'
      },
      api_keys_configured: rawData.meta?.api_keys_available || {}
    }
  };
  
  return summary;
}

// Main analysis endpoint (flip | homeowner | rental)
app.post('/api/analyze', async (req, res) => {
  const { propertyId, mode: modeFromClient } = req.body || {};

  try {
    // Get property from database
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        error: 'Property not found',
        analysis: 'Property not found in database.'
      });
    }

    // Determine mode
    const user = await User.findOne();
    const effectiveMode = (modeFromClient || user?.mode || 'flip').toLowerCase();

    console.log(`Running analysis for property ${propertyId} in ${effectiveMode} mode`);

    // Load prompt template
    let template;
    try {
      template = loadPromptTemplate(effectiveMode);
    } catch (err) {
      console.error('Prompt loading error:', err);
      return res.json({
        error: 'Prompt template not found',
        analysis: `Could not load prompt for ${effectiveMode} mode. Please ensure prompt files are properly configured.`
      });
    }

    // Build messages
    const messages = buildMessages(template, property.toObject(), effectiveMode);

    // Call OpenAI
    console.log('Calling OpenAI API...');
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    });

    // Extract and clean response
    const rawContent = completion.choices[0]?.message?.content || '';
    const cleanedJson = cleanJsonResponse(rawContent);

    console.log(`Analysis complete for property ${propertyId}`);

    return res.json({
      success: true,
      analysis: cleanedJson,
      mode: effectiveMode
    });
  } catch (err) {
    console.error('Analysis error:', err);

    // Provide detailed error information
    if (err.response?.data) {
      console.error('OpenAI API error:', err.response.data);
    }

    return res.status(500).json({
      error: 'Analysis failed',
      analysis: 'Error running analysis. Please check the server logs.',
      details: err.message
    });
  }
});

// SOPHISTICATED: Investment Analysis endpoint (ZIP/city/region → market/investment report)
app.post('/api/investment-analysis', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { input, topN = 5, links = [], context = null } = req.body || {};
    const userInput = (input || '').toString().trim();

    console.log(`\n=== SOPHISTICATED INVESTMENT ANALYSIS REQUEST ===`);
    console.log(`Input: ${userInput}`);
    console.log(`TopN: ${topN}`);
    console.log(`Links: ${JSON.stringify(links)}`);
    console.log(`Context: ${context}`);

    if (!userInput) {
      return res.status(400).json({ 
        error: 'Missing input. Provide a ZIP, city/town, or region description.' 
      });
    }

    // Step 1: Determine analysis mode
    const mode = determineAnalysisMode(userInput, topN);
    console.log(`Analysis mode: ${mode}`);

    // Step 2: Build comprehensive raw data using orchestrator
    console.log('Building comprehensive raw data...');
    const orchestratorResult = await orchestrator.buildRawData(userInput, mode, topN);
    
    const { raw_data, output_dir, slug } = orchestratorResult;

    // Step 3: Load the master prompt
    let masterPrompt;
    try {
      const promptPath = path.join(__dirname, 'prompts', 'master_prompt.txt');
      masterPrompt = fs.readFileSync(promptPath, 'utf8');
      console.log(`Master prompt loaded: ${masterPrompt.length} characters`);
    } catch (e) {
      console.error('Master prompt loading error:', e);
      return res.status(500).json({
        error: 'Master prompt template not found. Ensure master_prompt.txt is in prompts/ directory.',
        details: e.message
      });
    }

    // Step 4: Prepare payload for OpenAI
    const userPayload = {
      location: userInput,
      mode,
      top_n: topN,
      raw_data
    };

    // Log payload size for debugging
    const payloadSize = JSON.stringify(userPayload).length;
    console.log(`OpenAI payload size: ${payloadSize} characters`);

    // If payload is too large, summarize raw_data
    if (payloadSize > 100000) { // 100KB limit
      console.log('Payload too large, summarizing raw_data...');
      userPayload.raw_data = summarizeRawData(raw_data);
    }

    // Step 5: Call OpenAI with sophisticated prompt
    console.log('Calling OpenAI with master prompt...');
    const messages = [
      { role: 'system', content: masterPrompt },
      { role: 'user', content: JSON.stringify(userPayload, null, 2) }
    ];

    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.1, // Lower temperature for more consistent analysis
      max_tokens: 8000,  // Increased for comprehensive reports
      // Note: NOT using JSON format for investment analysis - we want narrative
    });

    const reportText = completion.choices?.[0]?.message?.content || '';
    
    if (!reportText) {
      return res.status(502).json({ 
        error: 'No content returned from OpenAI.' 
      });
    }

    // Step 6: Save the final report
    const reportPath = path.join(output_dir, `${slug}_report.txt`);
    await fs.promises.writeFile(reportPath, reportText, 'utf8');

    // Step 7: Log completion and return response
    const totalTime = Date.now() - startTime;
    console.log(`✓ Investment analysis completed in ${totalTime}ms`);
    console.log(`✓ Report saved: ${reportPath}`);
    console.log(`✓ Raw data processing time: ${orchestratorResult.processing_time}ms`);

    return res.json({
      success: true,
      mode,
      input: userInput,
      topN,
      report: reportText,
      metadata: {
        slug,
        output_directory: output_dir,
        processing_time_ms: totalTime,
        data_gathering_time_ms: orchestratorResult.processing_time,
        report_path: reportPath,
        data_sources_count: raw_data.sources?.length || 0,
        analysis_scope: raw_data.analysis_scope,
        api_keys_available: raw_data.meta?.api_keys_available
      }
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('Investment analysis error:', error);
    
    return res.status(500).json({
      error: 'Error generating investment analysis.',
      details: error.message,
      processing_time_ms: totalTime,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Prompt health check endpoint - ENHANCED for debugging
app.get('/api/prompts/health', (_req, res) => {
  const report = {};

  for (const [mode, filename] of Object.entries(PROMPT_FILES)) {
    const locations = [
      path.join(__dirname, 'prompts', mode, filename),
      path.join(__dirname, 'prompts', filename),
      path.join(__dirname, filename)
    ];

    const found = locations.find((loc) => fs.existsSync(loc));
    let contentPreview = null;
    let contentLength = null;

    if (found) {
      try {
        const content = fs.readFileSync(found, 'utf8');
        contentLength = content.length;
        contentPreview = content.substring(0, 200);
      } catch (e) {
        contentPreview = `Error reading file: ${e.message}`;
      }
    }

    report[mode] = {
      filename,
      found: !!found,
      location: found || null,
      checked: locations,
      contentLength,
      contentPreview
    };
  }

  res.json({
    status: Object.values(report).every((r) => r.found) ? 'healthy' : 'missing_prompts',
    prompts: report,
    openai_configured: !!process.env.OPENAI_API_KEY,
    current_directory: __dirname,
    environment_keys: {
      GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
      CENSUS_API_KEY: !!process.env.CENSUS_API_KEY,
      WEATHER_API_KEY: !!process.env.WEATHER_API_KEY,
      BLS_API_KEY: !!process.env.BLS_API_KEY
    }
  });
});

// Enhanced system health check endpoint
app.get('/api/system/health', async (_req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    components: {}
  };
  
  // Check database
  try {
    await mongoose.connection.db.admin().ping();
    health.components.database = 'healthy';
  } catch (e) {
    health.components.database = 'unhealthy';
    health.status = 'degraded';
  }
  
  // Check API keys
  health.components.api_keys = {
    openai: !!process.env.OPENAI_API_KEY,
    google: !!process.env.GOOGLE_API_KEY,
    census: !!process.env.CENSUS_API_KEY,
    weather: !!process.env.WEATHER_API_KEY,
    bls: !!process.env.BLS_API_KEY
  };
  
  // Check data directories
  const dataChecks = {};
  const zillowDataDir = path.join(process.cwd(), 'data', 'zillow');
  try {
    await fs.promises.access(zillowDataDir);
    dataChecks.zillow_data_dir = 'exists';
  } catch (e) {
    dataChecks.zillow_data_dir = 'missing';
  }
  
  const outputsDir = path.join(process.cwd(), 'outputs');
  try {
    await fs.promises.access(outputsDir);
    dataChecks.outputs_dir = 'exists';
  } catch (e) {
    dataChecks.outputs_dir = 'missing';
  }
  
  health.components.data_directories = dataChecks;
  
  // Check prompts
  try {
    const masterPromptPath = path.join(__dirname, 'prompts', 'master_prompt.txt');
    await fs.promises.access(masterPromptPath);
    health.components.master_prompt = 'found';
  } catch (e) {
    health.components.master_prompt = 'missing';
    health.status = 'degraded';
  }
  
  res.json(health);
});

// Setup data directories endpoint
app.post('/api/setup/directories', async (_req, res) => {
  try {
    const directories = [
      path.join(process.cwd(), 'data', 'zillow'),
      path.join(process.cwd(), 'outputs'),
      path.join(__dirname, 'prompts')
    ];
    
    for (const dir of directories) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
    
    // Create master prompt if it doesn't exist
    const masterPromptPath = path.join(__dirname, 'prompts', 'master_prompt.txt');
    try {
      await fs.promises.access(masterPromptPath);
    } catch (e) {
      // Create placeholder master prompt
      const placeholderPrompt = `You are a Real Estate Investment Analysis Assistant. This is a placeholder prompt file.

To enable sophisticated analysis, replace this content with the master prompt template from the implementation guide.

For now, provide basic analysis of the location provided in the user message.`;
      await fs.promises.writeFile(masterPromptPath, placeholderPrompt);
    }
    
    res.json({
      success: true,
      directories_created: directories,
      message: 'Setup completed. Copy master_prompt.txt content to prompts/master_prompt.txt'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Setup failed',
      details: error.message
    });
  }
});

// Test analysis endpoint (for debugging)
app.post('/api/test-analysis', async (req, res) => {
  const { mode = 'flip' } = req.body;

  // Create a test property
  const testProperty = {
    address: '123 Test Street, Test City, ST 12345',
    price: 350000,
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1800
  };

  try {
    const template = loadPromptTemplate(mode);
    const messages = buildMessages(template, testProperty, mode);

    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    });

    const rawContent = completion.choices[0]?.message?.content || '';
    const cleanedJson = cleanJsonResponse(rawContent);

    res.json({
      success: true,
      mode,
      testProperty,
      analysis: cleanedJson
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      mode,
      testProperty
    });
  }
});

// Test investment analysis endpoint
app.post('/api/test-investment', async (req, res) => {
  try {
    console.log('\n=== TESTING INVESTMENT ANALYSIS ===');
    
    const testInput = "Newport, RI";
    const testResult = await orchestrator.buildRawData(testInput, 'point', 5);
    
    res.json({
      success: true,
      testInput,
      orchestratorResult: {
        slug: testResult.slug,
        processing_time: testResult.processing_time,
        output_dir: testResult.output_dir,
        data_summary: testResult.raw_data.data_summary
      },
      api_keys_available: {
        google: !!process.env.GOOGLE_API_KEY,
        census: !!process.env.CENSUS_API_KEY,
        weather: !!process.env.WEATHER_API_KEY,
        bls: !!process.env.BLS_API_KEY
      }
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      details: err.stack
    });
  }
});

// --- CRUD Endpoints for Property ---
app.get('/api/properties', async (_req, res) => {
  try {
    const properties = await Property.find();
    res.json(properties);
  } catch (err) {
    console.error('Property fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch properties.' });
  }
});

app.post('/api/properties', async (req, res) => {
  try {
    const prop = await Property.create(req.body);
    res.json(prop);
  } catch (err) {
    console.error('Property create error:', err);
    res.status(400).json({ error: 'Failed to create property.' });
  }
});

app.delete('/api/properties/:id', async (req, res) => {
  try {
    await Property.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Property delete error:', err);
    res.status(400).json({ error: 'Failed to delete property.' });
  }
});

// --- User Endpoints ---
app.get('/api/user/me', async (_req, res) => {
  try {
    let user = await User.findOne();
    if (!user) {
      user = await User.create({
        name: 'Alex Rodriguez',
        plan: 'Pro Plan',
        mode: 'flip'
      });
    }
    res.json(user);
  } catch (err) {
    console.error('User fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

app.post('/api/user/mode', async (req, res) => {
  try {
    let user = await User.findOne();
    if (!user) {
      user = await User.create({
        name: 'Alex Rodriguez',
        plan: 'Pro Plan',
        mode: req.body.mode
      });
    } else {
      user.mode = req.body.mode;
    }
    await user.save();
    res.json(user);
  } catch (err) {
    console.error('User mode update error:', err);
    res.status(400).json({ error: 'Failed to update mode.' });
  }
});

// --- Root Route and Server Startup ---
app.get('/', (_req, res) => {
  res.send(`
    <h1>Deko API Server</h1>
    <p>API is running!</p>
    <h2>Available Endpoints:</h2>
    <ul>
      <li>GET /api/system/health - Check system health</li>
      <li>GET /api/prompts/health - Check prompt configuration</li>
      <li>POST /api/setup/directories - Setup required directories</li>
      <li>POST /api/test-analysis - Test property analysis</li>
      <li>POST /api/test-investment - Test investment analysis</li>
      <li>GET /api/properties - List all properties</li>
      <li>POST /api/analyze - Run property analysis</li>
      <li>POST /api/investment-analysis - Run sophisticated location investment analysis</li>
    </ul>
    <h2>System Status:</h2>
    <p>OpenAI: ${process.env.OPENAI_API_KEY ? '✓ Configured' : '✗ Missing'}</p>
    <p>Google API: ${process.env.GOOGLE_API_KEY ? '✓ Configured' : '✗ Missing'}</p>
    <p>Census API: ${process.env.CENSUS_API_KEY ? '✓ Configured' : '✗ Missing'}</p>
  `);
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Check system health at: http://localhost:${port}/api/system/health`);
  console.log(`Setup directories at: http://localhost:${port}/api/setup/directories`);
  console.log(`Test investment analysis at: http://localhost:${port}/api/test-investment`);
});