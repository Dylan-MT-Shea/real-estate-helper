// server/fetchers/weather.js
import fetch from 'node-fetch';

export async function fetchWeatherData(lat, lng) {
  const API_KEY = process.env.WEATHER_API_KEY;
  
  if (!API_KEY) {
    return {
      retrieved_at: new Date().toISOString(),
      source: 'weather_api',
      confidence: 'missing',
      error: 'WEATHER_API_KEY not configured'
    };
  }

  try {
    // Using OpenWeatherMap API as example
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${API_KEY}&units=imperial`;
    
    const response = await fetch(currentUrl);
    const currentWeather = await response.json();
    
    if (!response.ok) {
      throw new Error(`Weather API error: ${currentWeather.message}`);
    }

    return {
      retrieved_at: new Date().toISOString(),
      source: currentUrl,
      confidence: 'good',
      current: currentWeather,
      temperature: currentWeather.main?.temp,
      conditions: currentWeather.weather?.[0]?.description,
      humidity: currentWeather.main?.humidity
    };
  } catch (error) {
    return {
      retrieved_at: new Date().toISOString(),
      source: 'weather_api',
      confidence: 'missing',
      error: error.message
    };
  }
}
