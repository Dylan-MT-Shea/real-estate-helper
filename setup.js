#!/usr/bin/env node
// setup.js - Complete setup script for Deko Real Estate API

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bright: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  log('\n🏠 DEKO REAL ESTATE API SETUP', 'bright');
  log('============================\n', 'bright');

  // Step 1: Create required directories
  log('1. Creating required directories...', 'blue');
  const directories = [
    'data/zillow',
    'outputs',
    'prompts'
  ];

  directories.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      log(`   ✓ Created: ${dir}`, 'green');
    } else {
      log(`   ✓ Exists: ${dir}`, 'yellow');
    }
  });

  // Step 2: Check package.json dependencies
  log('\n2. Checking dependencies...', 'blue');
  const packagePath = path.join(process.cwd(), 'package.json');
  
  if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const requiredDeps = {
      'node-fetch': '^2.7.0',
      'openai': '^5.20.1',
      'dotenv': '^17.2.2',
      'express': '^5.1.0',
      'mongoose': '^8.18.1',
      'cors': '^2.8.5',
      'body-parser': '^2.2.0'
    };

    const missing = [];
    Object.entries(requiredDeps).forEach(([dep, version]) => {
      if (!pkg.dependencies?.[dep]) {
        missing.push(`${dep}@${version}`);
      }
    });

    if (missing.length > 0) {
      log(`   ⚠ Missing dependencies: ${missing.join(', ')}`, 'yellow');
      log(`   Run: npm install ${missing.join(' ')}`, 'yellow');
    } else {
      log('   ✓ All dependencies present', 'green');
    }
  } else {
    log('   ⚠ No package.json found', 'yellow');
  }

  // Step 3: Environment setup
  log('\n3. Setting up environment variables...', 'blue');
  const envPath = path.join(process.cwd(), '.env');
  const envTemplatePath = path.join(process.cwd(), '.env.template');

  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envTemplatePath)) {
      fs.copyFileSync(envTemplatePath, envPath);
      log('   ✓ Created .env from template', 'green');
    } else {
      // Create basic .env
      const basicEnv = `# Deko Real Estate API Configuration
OPENAI_API_KEY=your-openai-key-here
MONGO_URI=mongodb://localhost:27017/deko
GOOGLE_API_KEY=your-google-key-here
CENSUS_API_KEY=your-census-key-here
BLS_API_KEY=your-bls-key-here
WEATHER_API_KEY=your-weather-key-here
PORT=4000
`;
      fs.writeFileSync(envPath, basicEnv);
      log('   ✓ Created basic .env file', 'green');
    }
  } else {
    log('   ✓ .env file exists', 'yellow');
  }

  // Step 4: Check core files
  log('\n4. Checking core files...', 'blue');
  const coreFiles = [
    { name: 'server.js', required: true },
    { name: 'fixed-orchestrator.js', required: true },
    { name: 'zillow-processor.js', required: true },
    { name: 'master_prompt.txt', required: false }
  ];

  coreFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file.name);
    if (fs.existsSync(filePath)) {
      log(`   ✓ Found: ${file.name}`, 'green');
    } else if (file.required) {
      log(`   ❌ Missing required file: ${file.name}`, 'red');
    } else {
      log(`   ⚠ Optional file missing: ${file.name}`, 'yellow');
    }
  });

  // Create master_prompt.txt if missing
  const masterPromptPath = path.join(process.cwd(), 'master_prompt.txt');
  if (!fs.existsSync(masterPromptPath)) {
    const defaultPrompt = `You are a Real Estate Investment Analysis Assistant.

Analyze the provided location data and generate a comprehensive investment report with:

**Plan** (1-2 bullets):
- Data sources used and geographic scope
- Analysis approach and outputs

**Executive Summary** (3-4 sentences):
Provide a clear investment recommendation based on the data.

**Key Market Drivers** (3-4 bullets):
- List primary positive factors with specific metrics
- Include data sources and confidence levels

**Primary Risk Factors** (3-4 bullets):  
- Identify main concerns with supporting data
- Note any data quality limitations

**Investment Recommendation**:
- Clear Buy/Hold/Avoid recommendation
- Rationale based on investment score and component analysis
- Specific next steps for investors

**Component Analysis**:
Break down the investment score components and key metrics.

Focus on data-driven insights from demographics, employment, housing, and amenity data.
Always cite specific numbers with confidence levels.
Provide actionable insights for real estate investors.`;

    fs.writeFileSync(masterPromptPath, defaultPrompt);
    log('   ✓ Created default master_prompt.txt', 'green');
  }

  // Step 5: Interactive API key setup
  log('\n5. API Key Configuration', 'blue');
  const setupAPIKeys = await question('Would you like to configure API keys now? (y/n): ');

  if (setupAPIKeys.toLowerCase() === 'y') {
    log('\n📋 API Key Setup Guide:', 'bright');
    
    const apiGuide = {
      'OpenAI': {
        url: 'https://platform.openai.com/api-keys',
        description: 'Required for AI analysis reports'
      },
      'Google APIs': {
        url: 'https://console.cloud.google.com/apis/credentials',
        description: 'Enable: Geocoding API, Places API, Custom Search API'
      },
      'Census Bureau': {
        url: 'https://api.census.gov/data/key_signup.html',
        description: 'Free - for demographics and housing data'
      },
      'Bureau of Labor Statistics': {
        url: 'https://www.bls.gov/developers/api_signature_v2.htm',
        description: 'Free - for employment data'
      },
      'OpenWeatherMap': {
        url: 'https://openweathermap.org/api',
        description: 'Free tier available - for weather data'
      }
    };

    Object.entries(apiGuide).forEach(([name, info]) => {
      log(`\n${name}:`, 'bright');
      log(`   URL: ${info.url}`, 'blue');
      log(`   Purpose: ${info.description}`, 'green');
    });

    log('\n💡 After getting your API keys:', 'bright');
    log('   1. Edit the .env file in your project root', 'yellow');
    log('   2. Replace "your-api-key-here" with actual keys', 'yellow');
    log('   3. Save the file and restart your server', 'yellow');
  }

  // Step 6: Zillow data setup
  log('\n6. Zillow Data Setup', 'blue');
  const zillowDir = path.join(process.cwd(), 'data', 'zillow');
  const zillowFiles = fs.readdirSync(zillowDir);
  const hasZillowData = zillowFiles.some(file => file.endsWith('.csv'));

  if (!hasZillowData) {
    log('   ⚠ No Zillow CSV files found', 'yellow');
    log('\n📁 To add Zillow data:', 'bright');
    log('   1. Visit: https://www.zillow.com/research/data/', 'blue');
    log('   2. Download these files:', 'blue');
    log('      - Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv', 'yellow');
    log('      - Metro_zori_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv', 'yellow');
    log('      - Metro_invt_fs_uc_sfrcondo_sm_month.csv', 'yellow');
    log('      - Metro_sales_count_now_uc_sfrcondo_month.csv', 'yellow');
    log(`   3. Place them in: ${zillowDir}`, 'blue');
  } else {
    log(`   ✓ Found ${zillowFiles.length} files in Zillow data directory`, 'green');
  }

  // Step 7: Database setup
  log('\n7. Database Setup', 'blue');
  const mongoCheck = await question('Do you have MongoDB running? (y/n): ');
  
  if (mongoCheck.toLowerCase() !== 'y') {
    log('\n📊 MongoDB Setup Options:', 'bright');
    log('   Option 1 - Local Installation:', 'blue');
    log('     • Download: https://www.mongodb.com/try/download/community', 'yellow');
    log('     • Start: mongod --dbpath /path/to/data', 'yellow');
    log('   Option 2 - MongoDB Atlas (Cloud):', 'blue');
    log('     • Sign up: https://www.mongodb.com/atlas', 'yellow');
    log('     • Get connection string and update MONGO_URI in .env', 'yellow');
  } else {
    log('   ✓ MongoDB ready', 'green');
  }

  // Step 8: Final recommendations
  log('\n8. Setup Complete! 🎉', 'bright');
  log('\n🚀 Next Steps:', 'bright');
  log('   1. Configure your API keys in .env', 'blue');
  log('   2. Ensure MongoDB is running', 'blue');
  log('   3. Install dependencies: npm install', 'blue');
  log('   4. Start server: npm start', 'blue');
  log('   5. Test: POST http://localhost:4000/api/test-location', 'blue');
  log('   6. Health check: GET http://localhost:4000/api/system/health', 'blue');

  log('\n🔍 Testing Commands:', 'bright');
  log('   curl -X POST http://localhost:4000/api/test-location \\', 'yellow');
  log('     -H "Content-Type: application/json" \\', 'yellow');
  log('     -d \'{"location":"Denver, CO"}\'', 'yellow');

  log('\n📊 Full Analysis:', 'bright');
  log('   curl -X POST http://localhost:4000/api/universal-analysis \\', 'yellow');
  log('     -H "Content-Type: application/json" \\', 'yellow');
  log('     -d \'{"location":"90210"}\'', 'yellow');

  log('\n💡 Tips:', 'bright');
  log('   • Start with free APIs: Census, BLS, OpenWeatherMap', 'green');
  log('   • Google APIs provide the best location coverage', 'green');
  log('   • OpenAI is required for AI-powered analysis reports', 'green');
  log('   • Check logs for API-specific error messages', 'green');

  rl.close();
}

// Run setup if called directly
if (require.main === module) {
  setup().catch(console.error);
}

module.exports = { setup };