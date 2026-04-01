const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

const app = express();
app.use(cors());

// Настройка хранилища Cookies для обхода защиты KNDC
const jar = new CookieJar();
const client = wrapper(axios.create({ jar, withCredentials: true }));

let cache = [];
let lastUpdate = null;

// Общие заголовки как в твоем curl (имитация iPhone)
const commonHeaders = {
  'accept': 'application/json, text/javascript, */*; q=0.01',
  'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  'x-requested-with': 'XMLHttpRequest'
};

async function fetchKNDC() {
  try {
    console.log("🔄 Шаг 1: Обновление сессии (Cookies)...");
    await client.get("https://kndc.kz", {
      headers: { 'user-agent': commonHeaders['user-agent'] }
    });

    console.log("🔄 Шаг 2: Запрос данных (Метод А)...");
    const urlA = "https://kndc.kz";
    let response = await client.get(urlA, { 
      headers: { ...commonHeaders, 'referer': 'https://kndc.kz' } 
    });

    let items = response.data.rows || (Array.isArray(response.data) ? response.data : []);

    // Если Метод А пустой, пробуем Метод Б (Интерактивный бюллетень)
    if (items.length === 0) {
      console.log("⚠️ Метод А пуст, пробуем Метод Б (Interactive)...");
      const urlB = "https://kndc.kz";
      response = await client.get(urlB, { 
        headers: { ...commonHeaders, 'referer': 'https://kndc.kz' } 
      });
      items = Array.isArray(response.data) ? response.data : (response.data.rows || []);
    }

    if (items.length > 0) {
      cache = items.map(item => ({
        datetime: (item.evdate && item.evtime) ? `${item.evdate} ${item.evtime}` : (item.datetime || item.date_time || "—"),
        lat: item.lat || item.latitude || "0",
        lon: item.lon || item.longitude || "0",
        mag: item.mb || item.mpv || item.mag || item.k || "0",
        region: item.region || item.location || "Центральная Азия",
        depth: item.depth || "-"
      }));
      lastUpdate = new Date();
      console.log(`✅ ПОБЕДА! Данные получены. Найдено событий: ${cache.length}`);
    } else {
      console.log("❌ Данные не найдены ни одним методом. Ответ сервера:", JSON.stringify(response.data).substring(0, 100));
    }
  } catch (e) {
    console.error("❌ Критическая ошибка:", e.message);
  }
}

// Интервалы
setInterval(fetchKNDC, 900000); // 15 мин
setTimeout(fetchKNDC, 2000); // Старт через 2 сек

app.get("/earthquakes", (req, res) => {
  res.json({ updated: lastUpdate, count: cache.length, data: cache });
});

app.get("/", (req, res) => res.send("KNDC Session API v3 Online"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Сервер на порту ${PORT}`));
