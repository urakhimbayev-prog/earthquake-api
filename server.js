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

    const resData = response.data;
    // Определяем, где лежат данные: в resData.rows или в самом resData
    const items = Array.isArray(resData) ? resData : (resData.rows || []);

    if (items.length > 0) {
      cache = items.map(item => ({
        // Пытаемся найти время события (бывает datetime или epochtime)
        datetime: item.datetime || item.date_time || item.epochtime || "—",
        lat: item.lat || item.latitude,
        lon: item.lon || item.longitude,
        // Магнитуда: пробуем разные колонки (mb, mpv, ml, k)
        mag: item.mb || item.mpv || item.ml || item.mag || item.k || "0",
        region: item.region || item.location || "Центральная Азия",
        depth: item.depth || "-"
      }));
      
      lastUpdate = new Date();
      console.log(`✅ Данные обновлены! Найдено событий: ${cache.length}`);
    } else {
      console.log("⚠️ Сервер ответил, но список событий пуст.");
      // Для отладки выведем структуру ответа в консоль Railway
      console.log("Структура ответа:", JSON.stringify(resData).substring(0, 200));
    }
 else {
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
