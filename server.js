const express = require("express");
const cors = require("cors");
const axios = require("axios"); // Установите: npm install axios

const app = express();
app.use(cors());

let cache = [];
let lastUpdate = null;

async function fetchKNDC() {
  try {
    console.log("🔄 Запрос данных напрямую через API KNDC...");
    
    // Прямой URL к базе данных (без привязки к старой странице)
    const url = "https://kndc.kz";
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win 64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Referer': 'https://kndc.kz'
      }
    });

    if (response.data && Array.isArray(response.data.rows)) {
      // Форматируем данные из формата KNDC в наш стандарт
      cache = response.data.rows.map(item => ({
        datetime: item.datetime || item.epochtime,
        lat: item.lat,
        lon: item.lon,
        mag: item.mb || item.mpv || item.ml || "0",
        region: item.region || "Центральная Азия",
        depth: item.depth || "-"
      }));
      
      lastUpdate = new Date();
      console.log(`✅ Данные обновлены! Найдено событий: ${cache.length}`);
    } else {
      console.log("⚠️ API ответило, но данных в поле 'rows' нет.");
    }
  } catch (e) {
    console.error("❌ Ошибка прямого запроса:", e.message);
  }
}

// Запуск каждые 15 минут
setInterval(fetchKNDC, 900000);
setTimeout(fetchKNDC, 2000);

app.get("/earthquakes", (req, res) => {
  res.json({
    updated: lastUpdate,
    count: cache.length,
    data: cache
  });
});

app.get("/", (req, res) => res.send("KNDC Fast API is running."));

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
