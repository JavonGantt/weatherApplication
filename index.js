import dotenv from 'dotenv';
dotenv.config({ path: '../ApiKeys/apiKeys.env' });

import express from "express"
import axios from "axios"
import bodyParser from "body-parser"
import NodeGeocoder from "node-geocoder";

const app = express();
const port = 3000;




app.use(express.static('public'));

app.use(bodyParser.urlencoded({ extended: true }));

const API_KEY = process.env.OPENWEATHER_API_KEY



const tileCache = {};


//Loads The Homepage
app.get("/", async (req, res) => {
  try {
    // Pass the JSON data as null
    res.render("homepage.ejs", { cityAsJSON: null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error rendering the homepage' });
  }
});



// Provides the weather details if user allows location
app.get("/getWeather", async (req, res) => {
  try {
    const { latitude, longitude } = req.query;
    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=imperial`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching weather data' });
  }
});



// Potentially let user switch what map view they get in future update
app.get('/weather-tile/:z/:x/:y', async (req, res) => {
  const { x, y, z } = req.params;
  const cacheKey = `${z}/${x}/${y}`;

  if (tileCache[cacheKey] && tileCache[cacheKey].expires > Date.now()) {
    return res.send(tileCache[cacheKey].data);
  }

  const tileUrl = `https://tile.openweathermap.org/map/temp_new/${z}/${x}/${y}.png?appid=${API_KEY}`;

  try {
    const response = await axios.get(tileUrl, { responseType: 'arraybuffer' });
    // Cache the tile with an expiration time (e.g., 1 hour)
    tileCache[cacheKey] = {
      data: response.data,
      expires: Date.now() + 3600000 // 1 hour in milliseconds
    };
    res.send(response.data);
  } catch (error) {
    console.error('Error fetching weather tile:', error);
    res.status(500).send("Error fetching weather tile");
  }
});






app.post("/find-city", async (req, res) => {
  const lat = roundToDecimalPlaces(req.body.lat, 2); 
  const lon = roundToDecimalPlaces(req.body.lon, 2);
  
  try {
      // Forecast data API (OpenWeather)
      const result = await axios.get(`http://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=imperial`);

      // current weather data API (OpenWeather)
      const result2 = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=imperial`);

      // Forecast variables
      const data = result.data
      const cod = data.cod;
      const message = data.message;
      const cnt = data.cnt;
      const city = data.city;
      const groupedData = groupByDate(data.list);

      // Current Weather Variables: 
      const currentWeatherData = result2.data
      const currentTemp = currentWeatherData.main
      const currentWind = currentWeatherData.wind
      const currentRain =  currentWeatherData.rain
      const currentClouds = currentWeatherData.clouds
      const currentSunrise = currentWeatherData.sys
      const weather = currentWeatherData.weather[0]
      const cardDirections = getCardinalDirection(currentWind.deg)
      const visibility = currentWeatherData.visibility

      res.render('index.ejs', {
        cod: cod,
        message: message,
        cnt: cnt,
        groupedData : groupedData,
        city: city,
        cityAsJSON : JSON.stringify(city),
        currentClouds: currentClouds,
        currentRain: currentRain,
        currentSunrise: currentSunrise,
        currentTemp: currentTemp,
        currentWind: currentWind,
        mainDescription: weather,
        cardDirections: cardDirections,
        visibility: visibility
       
    });

  } catch (error) {
      console.error(error);
      res.render("index.ejs", { content: "An error occurred while fetching the weather data." });
  }

});

app.get('/autocomplete-location', async (req, res) => {
  const query = req.query.query;
  const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY; // Replace with your API key

  try {
    const response = await axios.get(`https://us1.locationiq.com/v1/search.php?key=${LOCATIONIQ_API_KEY}&q=${query}&format=json&countrycodes=US&limit=3`);
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

function roundToDecimalPlaces(value, decimalPlaces) {
  const multiplier = Math.pow(10, decimalPlaces);
  return Math.round(value * multiplier) / multiplier;
}



function groupByDate(list) {

  function formatDateString(dateString) {
      const options = { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' };
      const date = new Date(dateString + 'T00:00:00Z'); // Append time and timezone to ensure UTC
      return date.toLocaleDateString('en-US', options);
  }

  return list.reduce((acc, item) => {
      const date = item.dt_txt.split(' ')[0]; // Extracting the date part from 'dt_txt'
      const tempMax = item.main.temp_max; // Get temp_max
      const tempMin = item.main.temp_min; // Get temp_min
      if (!acc[date]) {
          acc[date] = {
              formattedDate: formatDateString(date), // Adding formatted date
              tempHigh: tempMax,
              tempLow: tempMin,
              items: [] // Initialize items array
          };
      } else {
          acc[date].tempHigh = Math.max(acc[date].tempHigh, tempMax);
          acc[date].tempLow = Math.min(acc[date].tempLow, tempMin);
      }

      // Round tempHigh and tempLow to nearest integer
      acc[date].tempHigh = Math.round(acc[date].tempHigh);
      acc[date].tempLow = Math.round(acc[date].tempLow);

      acc[date].items.push(item); // Add item to the items array for the date
      
      return acc;
  }, {});
}


// could repurpose to seperate the direction and angle for cleaner ui?
function getCardinalDirection(angle) {
  const directions = ['↑N', '↗NE', '→E', '↘SE', '↓S', '↙SW', '←W', '↖NW'];
  return directions[Math.round(angle / 45) % 8];
}


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });