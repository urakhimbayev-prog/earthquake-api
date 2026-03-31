const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());

let cache = [];
let lastUpdate = null;

async function fetchKNDC() {
  try {
    console.log("🔄 Запрос данных напрямую через API KNDC...");
    
    const url = "https://kndc.kz";
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win 64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Referer': 'https://kndc.kz'
      }
    });

    const items = response.data; // Теперь берем данные напрямую из ответа

    if (Array.isArray(items) && items.length > 0) {
      cache = items.map(item => ({
        // Собираем дату и время из evdate и evtime
        datetime: `${item.evdate} ${item.evtime}`,
        lat: item.lat,
        lon: item.lon,
        // Берем магнитуду mb или mpv
        mag: item.mb || item.mpv || "0",
        region: item.region || "Центральная Азия",
        depth: item.depth || "-"
      }));
      
      lastUpdate = new Date();
      console.log(`✅ Данные обновлены! Найдено событий: ${cache.length}`);
    } else {
      console.log("⚠️ Сервер ответил, но список пуст или это не массив.");
    }
  } catch (e) {
    console.error("❌ Ошибка запроса:", e.message);
  }
}

// Запуск парсинга сразу и потом каждые 15 минут
setTimeout(fetchKNDC, 2000);
setInterval(fetchKNDC, 900000);

app.get("/earthquakes", (req, res) => {
  res.json({
    updated: lastUpdate,
    count: cache.length,
    data: cache
  });
});

app.get("/", (req, res) => res.send("KNDC Fast API is running. Go to /earthquakes"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
