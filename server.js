const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

const app = express();
app.use(cors());

// Настройка хранилища куки
const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

let cache = [];
let lastUpdate = null;

async function fetchKNDC() {
  try {
    console.log("🔄 Шаг 1: Получение новой сессии (Cookies)...");
    // Сначала заходим на главную страницу, чтобы сервер выдал нам сессию
    await client.get("https://kndc.kz", {
      headers: {
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15'
      }
    });

    console.log("🔄 Шаг 2: Запрос данных с активной сессией...");
    const url = "https://kndc.kz";
    
    const response = await client.get(url, {
      headers: {
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'referer': 'https://kndc.kz',
        'x-requested-with': 'XMLHttpRequest',
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15'
      }
    });

    const items = response.data.rows || (Array.isArray(response.data) ? response.data : []);

    if (items.length > 0) {
      cache = items.map(item => ({
        datetime: (item.evdate && item.evtime) ? `${item.evdate} ${item.evtime}` : (item.datetime || "—"),
        lat: item.lat,
        lon: item.lon,
        mag: item.mb || item.mpv || item.ml || "0",
        region: item.region || item.location || "Центральная Азия"
      }));
      lastUpdate = new Date();
      console.log(`✅ ПОБЕДА! Сессия активна, найдено событий: ${cache.length}`);
    } else {
      console.log("⚠️ Сессия получена, но данных нет. Проверьте структуру ответа.");
    }
  } catch (e) {
    console.error("❌ Ошибка:", e.message);
  }
}

// Запуск
setInterval(fetchKNDC, 900000);
setTimeout(fetchKNDC, 2000);

app.get("/earthquakes", (req, res) => res.json({ updated: lastUpdate, count: cache.length, data: cache }));
app.get("/", (req, res) => res.send("KNDC Session API Online"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server started on port ${PORT}`));
