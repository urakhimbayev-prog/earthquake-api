const express = require("express");
const axios = require("axios");

const app = express();

let cache = [];

// 🇰🇿 границы Казахстана
function isKazakhstan(lat, lon) {
  return lat >= 40 && lat <= 56 && lon >= 46 && lon <= 88;
}

// 🔄 загрузка данных USGS
async function fetchEarthquakes() {
  try {
    const url = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=200";

    const response = await axios.get(url);

    const features = response.data.features;

    const data = features.map(f => {
      const [lon, lat, depth] = f.geometry.coordinates;

      return {
        date: new Date(f.properties.time).toLocaleString(),
        lat,
        lon,
        mag: f.properties.mag,
        depth
      };
    });

    cache = data.filter(eq => isKazakhstan(eq.lat, eq.lon));

    console.log("Updated:", new Date(), "Events:", cache.length);

  } catch (e) {
    console.log("Error fetching USGS:", e.message);
  }
}

// первый запуск + каждые 10 минут
fetchEarthquakes();
setInterval(fetchEarthquakes, 600000);

// API endpoint
app.get("/earthquakes", (req, res) => {
  res.json(cache);
});

// ⚠️ важно для Railway
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("API started on port", PORT);
});
