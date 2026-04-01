const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());

let cache = [];

async function fetchKNDC() {
  try {
    console.log("🔄 Запрос данных...");
    
    // Используем максимально стабильный URL
    const url = "https://kndc.kz";
    
    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest', // КРИТИЧНО: говорит серверу, что это AJAX-запрос
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://kndc.kz'
      },
      timeout: 10000
    });

    // KNDC может прислать массив или объект {rows: []}
    const items = response.data.rows || (Array.isArray(response.data) ? response.data : []);

    if (items.length > 0) {
      cache = items.map(item => ({
        datetime: item.datetime || `${item.evdate} ${item.evtime}`,
        lat: item.lat,
        lon: item.lon,
        mag: item.mb || item.mpv || "0",
        region: item.region || "Центральная Азия"
      }));
      lastUpdate = new Date();
      console.log(`✅ ПОБЕДА! Найдено событий: ${cache.length}`);
    } else {
      console.log("⚠️ Список пуст. Проверьте URL в браузере.");
    }
  } catch (e) {
    console.error("❌ Ошибка:", e.message);
  }
}


// Запуск
setInterval(fetchKNDC, 600000);
setTimeout(fetchKNDC, 2000);

app.get("/earthquakes", (req, res) => res.json({ data: cache }));
app.get("/", (req, res) => res.send("API IS RUNNING"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => console.log(`Server on port ${PORT}`));
