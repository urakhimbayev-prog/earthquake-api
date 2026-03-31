const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors"); // 1. Сначала импортируем cors

const app = express(); // 2. СОЗДАЕМ app (эта строка должна быть ВЫШЕ всех app.use)

app.use(cors());

let cache = [];
let lastUpdate = null;

async function fetchKNDC() {
  let browser;
  try {
    console.log("🔄 Перехват данных через сетевой запрос...");
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();

    // 🎯 Слушаем все ответы сервера
    page.on('response', async (response) => {
      const url = response.url();
      // Ищем запрос, который подгружает данные бюллетеня
      if (url.includes("get_bulletin") || url.includes("contentLoader") || url.includes("get_data")) {
        try {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            // Форматируем под наш стандарт
            cache = data.map(item => ({
              datetime: item.datetime || item.date || "—",
              lat: item.lat || item.latitude,
              lon: item.lon || item.longitude,
              mag: item.mag || item.mb || item.mpv || "0",
              region: item.region || item.location || "Центральная Азия"
            }));
            lastUpdate = new Date();
            console.log(`✅ ДАННЫЕ ПЕРЕХВАЧЕНЫ! Найдено событий: ${cache.length}`);
          }
        } catch (e) { /* не JSON - игнорируем */ }
      }
    });

    await page.goto("https://kndc.kz", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // Ждем 15 секунд, пока карта и скрипты обменяются данными
    await new Promise(r => setTimeout(r, 15000));

    if (cache.length === 0) {
       console.log("⚠️ Перехват не удался. Пробуем обновить страницу...");
       await page.reload({ waitUntil: "networkidle2" });
       await new Promise(r => setTimeout(r, 10000));
    }

  } catch (e) {
    console.log("❌ Ошибка перехвата:", e.message);
  } finally {
    if (browser) await browser.close();
  }
}



// Запуск раз в 30 минут (для оперативных данных)
setInterval(fetchKNDC, 1800000);
setTimeout(fetchKNDC, 1000);

app.get("/earthquakes", (req, res) => {
  res.json({
    period: "last 24 hours",
    updated: lastUpdate,
    count: cache.length,
    data: cache
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API Server: http://localhost:${PORT}/earthquakes`));
