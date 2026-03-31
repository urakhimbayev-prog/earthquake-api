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
    console.log("🔄 Запуск Puppeteer для обхода защиты...");
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    
    // Перехватываем ответы сервера
    page.on('response', async (response) => {
      const url = response.url();
      // Ищем именно тот файл, который вы нашли (getOriginList.php)
      if (url.includes("getOriginList.php")) {
        try {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            cache = data.map(item => ({
              datetime: `${item.evdate} ${item.evtime}`,
              lat: item.lat,
              lon: item.lon,
              mag: item.mb || item.mpv || "0",
              region: item.region || "Центральная Азия"
            }));
            lastUpdate = new Date();
            console.log(`✅ ДАННЫЕ ПЕРЕХВАЧЕНЫ! Событий: ${cache.length}`);
          }
        } catch (e) { /* не JSON */ }
      }
    });

    // Идем на страницу, где этот запрос происходит официально
    await page.goto("https://kndc.kz", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // Ждем 15 секунд, чтобы все скрипты на сайте KNDC успели сработать
    await new Promise(r => setTimeout(r, 15000));

  } catch (e) {
    console.error("❌ Ошибка Puppeteer:", e.message);
  } finally {
    if (browser) await browser.close();
  }
}

// Интервал 15 минут
setInterval(fetchKNDC, 900000);
setTimeout(fetchKNDC, 2000);

app.get("/earthquakes", (req, res) => {
  res.json({ updated: lastUpdate, count: cache.length, data: cache });
});

app.get("/", (req, res) => res.send("KNDC Hybrid API Online"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Port: ${PORT}`));
