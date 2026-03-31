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
    console.log("🔄 Запрос данных напрямую через API KNDC...");
    
    // Полный URL к API, который вы нашли
    const url = "https://kndc.kz";
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://kndc.kz'
      },
      timeout: 10000
    });

    const resData = response.data;
    
    // 🎯 УМНЫЙ ПОИСК МАССИВА ДАННЫХ
    let items = [];
    if (Array.isArray(resData)) {
      items = resData;
    } else if (resData && resData.rows && Array.isArray(resData.rows)) {
      items = resData.rows;
    } else if (resData && resData.data && Array.isArray(resData.data)) {
      items = resData.data;
    }

    if (items.length > 0) {
      // 🎯 МАППИНГ ДАННЫХ (используем точные поля из логов)
      cache = items.map(item => ({
        // Склеиваем дату и время из evdate и evtime
        datetime: (item.evdate && item.evtime) ? `${item.evdate} ${item.evtime}` : (item.datetime || "—"),
        lat: item.lat || item.latitude || "0",
        lon: item.lon || item.longitude || "0",
        // Магнитуда: пробуем mb, mpv или ml
        mag: item.mb || item.mpv || item.ml || item.mag || "0",
        region: item.region || item.location || "Центральная Азия",
        depth: item.depth || "-"
      }));
      
      lastUpdate = new Date();
      console.log(`✅ УСПЕХ! Данные обновлены. Найдено событий: ${cache.length}`);
    } else {
      console.log("⚠️ Сервер ответил, но список событий пуст.");
      console.log("DEBUG (начало ответа):", JSON.stringify(resData).substring(0, 200));
    }
  } catch (e) {
    console.error("❌ Ошибка прямого запроса к KNDC:", e.message);
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
