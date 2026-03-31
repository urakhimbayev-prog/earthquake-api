const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

// ✅ РАЗРЕШАЕМ CORS (ВАЖНО ДЛЯ ТИЛЬДЫ)
app.use(cors());

let cache = [];
let lastUpdate = null;

// Функция для получения данных
async function fetchKNDC() {
  try {
    console.log("🔄 Запрос данных с имитацией браузера...");
    
    const url = "https://kndc.kz";
    
    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Pragma': 'no-cache',
        'Referer': 'https://kndc.kz',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest' // 👈 Это критически важный заголовок для этого API
      },
      timeout: 15000
    });

    const resData = response.data;
    
    // Если сервер все равно прислал строку (HTML), значит JSON не получен
    if (typeof resData === 'string' && resData.includes('<!DOCTYPE')) {
       console.log("⚠️ Защита сайта отклонила запрос. Сервер выдал HTML вместо данных.");
       return;
    }

    let items = Array.isArray(resData) ? resData : (resData.rows || []);

    if (items.length > 0) {
      cache = items.map(item => ({
        datetime: (item.evdate && item.evtime) ? `${item.evdate} ${item.evtime}` : (item.datetime || "—"),
        lat: item.lat || "0",
        lon: item.lon || "0",
        mag: item.mb || item.mpv || item.mag || "0",
        region: item.region || "Центральная Азия"
      }));
      lastUpdate = new Date();
      console.log(`✅ ПОБЕДА! Найдено событий: ${cache.length}`);
    } else {
      console.log("⚠️ Список пуст. Возможно, параметры URL не приняты.");
    }
  } catch (e) {
    console.error("❌ Ошибка соединения:", e.message);
  }
}

// Запуск парсинга сразу после старта и далее каждые 15 минут
setTimeout(fetchKNDC, 2000);
setInterval(fetchKNDC, 900000);

// API Эндпоинт для Тильды
app.get("/earthquakes", (req, res) => {
  res.json({
    updated: lastUpdate,
    count: cache.length,
    data: cache
  });
});

// Главная страница
app.get("/", (req, res) => {
  res.send("KNDC Seismic API is running. Check /earthquakes for data.");
});

// Порт для Railway
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
