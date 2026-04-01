const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());

let cache = [];

async function fetchKNDC() {
  try {
    // 🎯 ВОТ ГЛАВНОЕ ОТЛИЧИЕ: мы идем не на главную, 
    // а на PHP-скрипт, который обслуживает контент-лоадер
    const url = "https://kndc.kz";
    
    const response = await axios.get(url, {
      headers: {
        // Эти заголовки заставляют сервер думать, что запрос пришел от contentLoader.js
        'X-Requested-With': 'XMLHttpRequest', 
        'Referer': 'https://kndc.kz',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Обработка данных (KNDC может прислать массив или объект с полем rows)
    const items = response.data.rows || (Array.isArray(response.data) ? response.data : []);

    if (items.length > 0) {
      cache = items.map(item => ({
        datetime: item.datetime || `${item.evdate} ${item.evtime}`,
        lat: item.lat,
        lon: item.lon,
        mag: item.mb || item.mpv || "0",
        region: item.region || "Центральная Азия"
      }));
      console.log(`✅ ПОБЕДА! Данные получены напрямую: ${cache.length} событий`);
    }
  } catch (e) {
    console.error("❌ Ошибка прямого запроса:", e.message);
  }
}

// Запуск
setInterval(fetchKNDC, 600000);
setTimeout(fetchKNDC, 2000);

app.get("/earthquakes", (req, res) => res.json({ data: cache }));
app.get("/", (req, res) => res.send("API IS RUNNING"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => console.log(`Server on port ${PORT}`));
