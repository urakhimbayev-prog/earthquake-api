const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());

let cache = [];
let lastUpdate = null;

async function fetchKNDC() {
  try {
    console.log("🔄 Запрос данных с использованием расширенных заголовков...");
    
    // Используем эндпоинт из твоего curl, но убираем привязку к 293 странице
    const url = "https://kndc.kz";
    
    const response = await axios.get(url, {
      headers: {
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'referer': 'https://kndc.kz/index.php/sejsmicheskie-byulleteni/alarm-bulletin',
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
        'x-requested-with': 'XMLHttpRequest',
        'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin'
      }
    });

    const items = response.data.rows || (Array.isArray(response.data) ? response.data : []);

    if (items.length > 0) {
      cache = items.map(item => ({
        datetime: (item.evdate && item.evtime) ? `${item.evdate} ${item.evtime}` : (item.datetime || "—"),
        lat: item.lat,
        lon: item.lon,
        mag: item.mb || item.mpv || item.mag || "0",
        region: item.region || item.location || "Центральная Азия"
      }));
      lastUpdate = new Date();
      console.log(`✅ ПОБЕДА! Найдено событий: ${cache.length}`);
    } else {
      console.log("⚠️ Сервер ответил, но данных нет. Возможно, куки протухли.");
    }
  } catch (e) {
    console.error("❌ Ошибка:", e.message);
  }
}

setInterval(fetchKNDC, 900000);
setTimeout(fetchKNDC, 2000);

app.get("/earthquakes", (req, res) => res.json({ updated: lastUpdate, count: cache.length, data: cache }));
app.get("/", (req, res) => res.send("API IS RUNNING"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => console.log(`Server on port ${PORT}`));
