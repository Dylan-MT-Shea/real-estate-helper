// scoring-engine.js - Save this file in your project root
class ScoringEngine {
  constructor() {
    this.componentWeights = {
      // Primary Components (70% total)
      market_momentum: 0.25,
      supply_demand: 0.20,
      rental_strength: 0.15,
      affordability: 0.10,
      
      // Transformation Components (30% total)
      transformation_stage: 0.15,
      historical_pattern: 0.10,
      investment_timing: 0.05
    };

    this.confidenceMultipliers = {
      'good': 1.0,
      'partial': 0.8,
      'interpolated': 0.6,
      'missing': 0.0
    };

    this.recencyMultipliers = {
      'current': 1.0,    // <6 months
      'recent': 0.9,     // 6-12 months
      'stale': 0.7       // >12 months
    };
  }

  async computeInvestmentScore(rawData, peerUniverse) {
    console.log('\n=== SCORING ENGINE: Computing Investment Score ===');
    
    const scoreData = {
      meta: {
        computed_at: new Date().toISOString(),
        peer_universe: peerUniverse,
        canonical_geoid: rawData.canonical_geoid,
        canonical_type: rawData.canonical_type
      },
      data_quality: rawData.data_quality,
      component_scores: {},
      percentile_ranks: {},
      adjusted_metrics: {},
      transformation_analysis: {},
      final_score: 0,
      band: '',
      rationale: []
    };

    try {
      // Step 1: Extract and adjust metrics
      const adjustedMetrics = this.extractAndAdjustMetrics(rawData);
      scoreData.adjusted_metrics = adjustedMetrics;

      // Step 2: Load peer data (in production, this would query the database)
      const peerData = await this.loadPeerData(peerUniverse);
      
      // Step 3: Compute percentile ranks
      const percentileRanks = this.computePercentileRanks(adjustedMetrics, peerData);
      scoreData.percentile_ranks = percentileRanks;

      // Step 4: Calculate primary component scores
      const primaryScores = this.calculatePrimaryComponents(percentileRanks);
      scoreData.component_scores.primary = primaryScores;

      // Step 5: Analyze transformation patterns
      const transformationAnalysis = this.analyzeTransformationPatterns(rawData, adjustedMetrics);
      scoreData.transformation_analysis = transformationAnalysis;

      // Step 6: Calculate transformation component scores
      const transformationScores = this.calculateTransformationComponents(transformationAnalysis);
      scoreData.component_scores.transformation = transformationScores;

      // Step 7: Combine final score
      const finalScore = this.combineFinalScore(primaryScores, transformationScores);
      scoreData.final_score = finalScore;
      scoreData.band = this.determineBand(finalScore);

      // Step 8: Generate rationale
      scoreData.rationale = this.generateRationale(scoreData);

      console.log(`✓ Final Investment Score: ${finalScore}/100 (${scoreData.band})`);
      console.log(`✓ Data Quality: ${rawData.data_quality.overall_score}/100`);

      return scoreData;

    } catch (error) {
      console.error('Scoring error:', error);
      
      return {
        ...scoreData,
        error: error.message,
        final_score: 0,
        band: 'Error',
        rationale: ['Scoring failed due to insufficient data or processing error']
      };
    }
  }

  extractAndAdjustMetrics(rawData) {
    const metrics = {};
    const features = rawData.features || {};

    // Extract housing metrics
    if (features.housing?.computed) {
      metrics.zhvi_1y_growth = this.adjustMetric(
        features.housing.computed.zhvi_1y_growth,
        features.housing.confidence,
        features.housing.retrieved_at
      );
      
      metrics.zhvi_3y_cagr = this.adjustMetric(
        features.housing.computed.zhvi_3y_cagr,
        features.housing.confidence,
        features.housing.retrieved_at
      );
      
      metrics.current_zhvi = this.adjustMetric(
        features.housing.computed.current_zhvi,
        features.housing.confidence,
        features.housing.retrieved_at
      );

      metrics.days_on_market = this.adjustMetric(
        features.housing.computed.days_on_market,
        features.housing.confidence,
        features.housing.retrieved_at
      );
    }

    // Extract demographic metrics
    if (features.demographics?.computed) {
      metrics.population = this.adjustMetric(
        features.demographics.computed.population,
        features.demographics.confidence,
        features.demographics.retrieved_at
      );

      metrics.median_household_income = this.adjustMetric(
        features.demographics.computed.median_household_income,
        features.demographics.confidence,
        features.demographics.retrieved_at
      );

      metrics.pct_bachelor_plus = this.adjustMetric(
        features.demographics.computed.pct_bachelor_plus,
        features.demographics.confidence,
        features.demographics.retrieved_at
      );

      metrics.pct_25_34 = this.adjustMetric(
        features.demographics.computed.pct_25_34,
        features.demographics.confidence,
        features.demographics.retrieved_at
      );
    }

    // Extract computed metrics
    if (features.computed) {
      metrics.price_to_income_ratio = this.adjustMetric(
        features.computed.price_to_income_ratio,
        'computed',
        features.computed.retrieved_at
      );

      metrics.amenity_density_score = this.adjustMetric(
        features.computed.amenity_density_score,
        'computed',
        features.computed.retrieved_at
      );
    }

    return metrics;
  }

  adjustMetric(value, confidence, retrievedAt) {
    if (value === null || value === undefined) {
      return {
        raw_value: null,
        adjusted_value: null,
        confidence,
        confidence_multiplier: 0.0,
        recency_multiplier: 1.0,
        retrievedAt
      };
    }

    const confidenceMultiplier = this.confidenceMultipliers[confidence] || 0.0;
    const recencyMultiplier = this.calculateRecencyMultiplier(retrievedAt);
    const adjustedValue = value * confidenceMultiplier * recencyMultiplier;

    return {
      raw_value: value,
      adjusted_value: adjustedValue,
      confidence,
      confidence_multiplier: confidenceMultiplier,
      recency_multiplier: recencyMultiplier,
      retrievedAt
    };
  }

  calculateRecencyMultiplier(retrievedAt) {
    if (!retrievedAt) return 1.0;
    
    const now = new Date();
    const retrieved = new Date(retrievedAt);
    const monthsAgo = (now - retrieved) / (1000 * 60 * 60 * 24 * 30);

    if (monthsAgo < 6) return this.recencyMultipliers.current;
    if (monthsAgo < 12) return this.recencyMultipliers.recent;
    return this.recencyMultipliers.stale;
  }

  async loadPeerData(peerUniverse) {
    // In production, this would query the database for peer universe data
    // For now, return synthetic peer data for demonstration
    
    console.log('Loading peer data (synthetic for demo)...');
    
    return {
      peer_count: 50,
      peer_type: peerUniverse.type,
      metrics: {
        zhvi_1y_growth: this.generateSyntheticPeerDistribution(0.05, 0.15, 50), // 5% mean, 15% std dev
        zhvi_3y_cagr: this.generateSyntheticPeerDistribution(0.08, 0.12, 50),
        days_on_market: this.generateSyntheticPeerDistribution(45, 20, 50),
        median_household_income: this.generateSyntheticPeerDistribution(65000, 25000, 50),
        pct_bachelor_plus: this.generateSyntheticPeerDistribution(35, 15, 50),
        pct_25_34: this.generateSyntheticPeerDistribution(12, 5, 50),
        price_to_income_ratio: this.generateSyntheticPeerDistribution(4.5, 1.5, 50),
        amenity_density_score: this.generateSyntheticPeerDistribution(25, 15, 50)
      }
    };
  }

  generateSyntheticPeerDistribution(mean, stdDev, count) {
    // Generate normal distribution for peer comparison
    const values = [];
    for (let i = 0; i < count; i++) {
      // Box-Muller transform for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      values.push(mean + stdDev * z0);
    }
    return values.sort((a, b) => a - b);
  }

  computePercentileRanks(adjustedMetrics, peerData) {
    const percentiles = {};

    Object.keys(adjustedMetrics).forEach(metric => {
      const adjustedMetric = adjustedMetrics[metric];
      
      if (adjustedMetric.adjusted_value === null || !peerData.metrics[metric]) {
        percentiles[metric] = {
          percentile: null,
          peer_count: 0,
          note: 'Insufficient data for percentile calculation'
        };
        return;
      }

      const peerValues = peerData.metrics[metric];
      const value = adjustedMetric.adjusted_value;
      
      // Handle inverted metrics (lower is better)
      const invertedMetrics = ['days_on_market', 'price_to_income_ratio'];
      const isInverted = invertedMetrics.includes(metric);
      
      let rank;
      if (isInverted) {
        rank = peerValues.filter(p => p > value).length;
      } else {
        rank = peerValues.filter(p => p < value).length;
      }
      
      const percentile = (rank / (peerValues.length - 1)) * 100;
      
      percentiles[metric] = {
        percentile: Math.round(percentile * 10) / 10,
        peer_count: peerValues.length,
        rank: rank + 1,
        value: value,
        peer_mean: peerValues.reduce((a, b) => a + b, 0) / peerValues.length
      };
    });

    return percentiles;
  }

  calculatePrimaryComponents(percentileRanks) {
    const components = {};

    // Market Momentum (25%)
    const momentumMetrics = ['zhvi_1y_growth', 'zhvi_3y_cagr'];
    components.market_momentum = this.calculateComponentScore(
      momentumMetrics,
      percentileRanks,
      { zhvi_1y_growth: 0.6, zhvi_3y_cagr: 0.4 }
    );

    // Supply-Demand Balance (20%)
    const supplyDemandMetrics = ['days_on_market'];
    components.supply_demand = this.calculateComponentScore(
      supplyDemandMetrics,
      percentileRanks,
      { days_on_market: 1.0 }
    );

    // Rental Strength (15%) - placeholder until we have rental data
    components.rental_strength = {
      score: 50,
      confidence: 'missing',
      note: 'Rental metrics not available'
    };

    // Affordability Position (10%)
    const affordabilityMetrics = ['price_to_income_ratio'];
    components.affordability = this.calculateComponentScore(
      affordabilityMetrics,
      percentileRanks,
      { price_to_income_ratio: 1.0 }
    );

    return components;
  }

  calculateComponentScore(metricNames, percentileRanks, weights) {
    let weightedScore = 0;
    let totalWeight = 0;
    let availableMetrics = 0;
    const details = {};

    metricNames.forEach(metricName => {
      const percentileData = percentileRanks[metricName];
      const weight = weights[metricName] || 0;

      if (percentileData && percentileData.percentile !== null) {
        weightedScore += percentileData.percentile * weight;
        totalWeight += weight;
        availableMetrics++;
        details[metricName] = {
          percentile: percentileData.percentile,
          weight: weight,
          contribution: percentileData.percentile * weight
        };
      } else {
        details[metricName] = {
          percentile: null,
          weight: weight,
          contribution: 0,
          note: 'Missing data'
        };
      }
    });

    const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const confidence = availableMetrics === metricNames.length ? 'good' : 
                      availableMetrics > 0 ? 'partial' : 'missing';

    return {
      score: Math.round(finalScore * 10) / 10,
      confidence,
      available_metrics: availableMetrics,
      total_metrics: metricNames.length,
      details
    };
  }

  analyzeTransformationPatterns(rawData, adjustedMetrics) {
    const analysis = {
      stage: 'unknown',
      confidence: 'low',
      signals: [],
      risks: [],
      historical_indicators: {},
      timing_assessment: {}
    };

    // Analyze current transformation stage
    const currentStage = this.assessTransformationStage(adjustedMetrics);
    analysis.stage = currentStage.stage;
    analysis.signals = currentStage.signals;
    analysis.risks = currentStage.risks;

    // Historical pattern matching (simplified)
    analysis.historical_indicators = this.identifyHistoricalIndicators(rawData);

    // Investment timing assessment
    analysis.timing_assessment = this.assessInvestmentTiming(currentStage, adjustedMetrics);

    return analysis;
  }

  assessTransformationStage(adjustedMetrics) {
    const signals = [];
    const risks = [];
    let stage = 'pre-transformation';

    // Check for active transformation signals
    if (adjustedMetrics.zhvi_1y_growth?.adjusted_value > 0.15) {
      signals.push('Strong price appreciation (>15% annually)');
      stage = 'active-transformation';
    } else if (adjustedMetrics.zhvi_1y_growth?.adjusted_value > 0.10) {
      signals.push('Moderate price appreciation (10-15% annually)');
      stage = 'early-transformation';
    }

    // Check for demographic transformation
    if (adjustedMetrics.pct_25_34?.adjusted_value > 15) {
      signals.push('High young professional population (>15%)');
    }

    if (adjustedMetrics.pct_bachelor_plus?.adjusted_value > 40) {
      signals.push('High education levels (>40% BA+)');
    }

    // Check for speculation risk
    if (adjustedMetrics.zhvi_1y_growth?.adjusted_value > 0.25) {
      risks.push('Potential speculation risk (>25% price growth)');
      stage = 'late-stage';
    }

    if (adjustedMetrics.price_to_income_ratio?.adjusted_value > 6) {
      risks.push('High price-to-income ratio indicates affordability stress');
    }

    return { stage, signals, risks };
  }

  identifyHistoricalIndicators(rawData) {
    // Simplified historical analysis - in production would analyze time series
    return {
      employment_catalyst: 'unknown',
      infrastructure_signals: 'unknown',
      policy_catalysts: 'unknown',
      note: 'Historical analysis requires time-series data'
    };
  }

  assessInvestmentTiming(currentStage, adjustedMetrics) {
    let timing_score = 0;
    const rationale = [];

    switch (currentStage.stage) {
      case 'pre-transformation':
        timing_score = 3;
        rationale.push('Good opportunity with moderate timing risk');
        break;
      case 'early-transformation':
        timing_score = 5;
        rationale.push('Optimal investment window currently open');
        break;
      case 'active-transformation':
        timing_score = 3;
        rationale.push('Late-stage opportunity with higher risk');
        break;
      case 'late-stage':
        timing_score = 1;
        rationale.push('Poor timing - high speculation risk');
        break;
      default:
        timing_score = 0;
        rationale.push('Cannot assess timing due to insufficient data');
    }

    return {
      timing_score,
      timing_band: this.getTimingBand(timing_score),
      rationale
    };
  }

  getTimingBand(score) {
    if (score >= 5) return 'Optimal';
    if (score >= 3) return 'Good';
    if (score >= 1) return 'Poor';
    return 'Avoid';
  }

  calculateTransformationComponents(transformationAnalysis) {
    const components = {};

    // Transformation Stage Assessment (15%)
    components.transformation_stage = this.stageToScore(transformationAnalysis.stage);

    // Historical Pattern Match (10%) - simplified for demo
    components.historical_pattern = {
      score: 50,
      confidence: 'partial',
      note: 'Pattern matching requires historical time-series analysis'
    };

    // Investment Timing Score (5%)
    components.investment_timing = {
      score: (transformationAnalysis.timing_assessment.timing_score / 5) * 100,
      confidence: 'partial',
      timing_band: transformationAnalysis.timing_assessment.timing_band,
      rationale: transformationAnalysis.timing_assessment.rationale
    };

    return components;
  }

  stageToScore(stage) {
    const stageScores = {
      'pre-transformation': 60,      // +10 in original scale, normalized to 0-100
      'early-transformation': 80,    // +15 in original scale
      'active-transformation': 90,   // +15 in original scale
      'late-stage': 40,             // +0 in original scale
      'declining': 20               // -5 in original scale
    };

    return {
      score: stageScores[stage] || 50,
      confidence: 'partial',
      stage: stage
    };
  }

  combineFinalScore(primaryScores, transformationScores) {
    let primaryTotal = 0;
    let primaryWeight = 0;

    // Weight primary components
    Object.keys(primaryScores).forEach(component => {
      const weight = this.componentWeights[component] || 0;
      const score = primaryScores[component].score || 0;
      
      primaryTotal += score * weight;
      primaryWeight += weight;
    });

    let transformationTotal = 0;
    let transformationWeight = 0;

    // Weight transformation components
    Object.keys(transformationScores).forEach(component => {
      const weight = this.componentWeights[component] || 0;
      const score = transformationScores[component].score || 0;
      
      transformationTotal += score * weight;
      transformationWeight += weight;
    });

    // Normalize to account for missing components
    const primaryNormalized = primaryWeight > 0 ? (primaryTotal / primaryWeight) * 0.7 : 0;
    const transformationNormalized = transformationWeight > 0 ? (transformationTotal / transformationWeight) * 0.3 : 0;

    const finalScore = primaryNormalized + transformationNormalized;

    return Math.round(Math.max(0, Math.min(100, finalScore)));
  }

  determineBand(score) {
    if (score >= 90) return 'Exceptional';
    if (score >= 75) return 'Strong buy';
    if (score >= 60) return 'Moderate opportunity';
    if (score >= 40) return 'Market rate';
    if (score >= 25) return 'Below average';
    return 'Avoid';
  }

  generateRationale(scoreData) {
    const rationale = [];
    const score = scoreData.final_score;
    const dataQuality = scoreData.data_quality.overall_score;

    // Overall assessment
    rationale.push(`Investment Score: ${score}/100 (${scoreData.band})`);
    rationale.push(`Data Quality: ${dataQuality}/100 - ${dataQuality >= 70 ? 'Sufficient for analysis' : 'Limited data affects reliability'}`);

    // Key strengths
    const strongComponents = Object.entries(scoreData.component_scores.primary || {})
      .filter(([_, data]) => data.score >= 70)
      .map(([component, data]) => `${component}: ${Math.round(data.score)}`);

    if (strongComponents.length > 0) {
      rationale.push(`Strong performance in: ${strongComponents.join(', ')}`);
    }

    // Key risks
    const weakComponents = Object.entries(scoreData.component_scores.primary || {})
      .filter(([_, data]) => data.score <= 30)
      .map(([component, data]) => `${component}: ${Math.round(data.score)}`);

    if (weakComponents.length > 0) {
      rationale.push(`Areas of concern: ${weakComponents.join(', ')}`);
    }

    // Transformation stage insight
    if (scoreData.transformation_analysis?.stage) {
      rationale.push(`Transformation stage: ${scoreData.transformation_analysis.stage}`);
    }

    // Data recommendations
    if (dataQuality < 70) {
      rationale.push('Consider gathering additional data before making investment decisions');
    }

    return rationale;
  }
}

module.exports = ScoringEngine;