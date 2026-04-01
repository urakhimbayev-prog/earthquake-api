const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());

let cache = [];
let lastUpdate = null;

async function fetchKNDC() {
  let browser;
  try {
    console.log("🔄 Запуск браузера для обхода блокировки IP...");
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    // Имитируем реальный экран iPhone
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');

    // Перехватываем ответы сервера KNDC
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes("getOriginList.php") || url.includes("get_data.php")) {
        try {
          const data = await response.json();
          const items = data.rows || (Array.isArray(data) ? data : []);
          if (items.length > 0) {
            cache = items.map(item => ({
              datetime: item.datetime || `${item.evdate} ${item.evtime}` || item.date_time,
              lat: item.lat || item.latitude,
              lon: item.lon || item.longitude,
              mag: item.mb || item.mpv || item.mag || "0",
              region: item.region || item.location || "Центральная Азия"
            }));
            lastUpdate = new Date();
            console.log(`✅ ДАННЫЕ ПОЛУЧЕНЫ! Найдено событий: ${cache.length}`);
          }
        } catch (e) {}
      }
    });

    // Идем на страницу, где данные подгружаются официально
    await page.goto("https://kndc.kz", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // Ждем 15 секунд, пока скрипты сайта KNDC «прогрузят» данные
    await new Promise(r => setTimeout(r, 15000));

  } catch (e) {
    console.error("❌ Ошибка браузера:", e.message);
  } finally {
    if (browser) await browser.close();
  }
}

setInterval(fetchKNDC, 900000); // 15 мин
setTimeout(fetchKNDC, 5000);

app.get("/earthquakes", (req, res) => res.json({ updated: lastUpdate, count: cache.length, data: cache }));
app.get("/", (req, res) => res.send("KNDC Browser API Online"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Сервер на порту ${PORT}`));
