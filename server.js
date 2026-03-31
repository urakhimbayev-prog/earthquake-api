const express = require("express");
const puppeteer = require("puppeteer");

const app = express();

let cache = [];
let lastUpdate = null;

// защита
process.on("uncaughtException", err => console.error(err));
process.on("unhandledRejection", err => console.error(err));

// тест
app.get("/", (req, res) => {
  res.send("Puppeteer API is running");
});

// 🚀 ПАРСЕР
async function fetchKNDC() {
  let browser;

  try {
    console.log("Launching browser...");

    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    await page.goto(
      "https://kndc.kz/index.php/sejsmicheskie-byulleteni/interactive-bulletin",
      { waitUntil: "networkidle2", timeout: 60000 }
    );

    console.log("Page loaded");

    // 🔍 Вытаскиваем данные прямо из JS-контекста страницы
    const data = await page.evaluate(() => {
      const results = [];

      // пытаемся найти маркеры Leaflet
      if (window.L && window.L.Marker) {
        document.querySelectorAll(".leaflet-marker-icon").forEach(el => {
          const lat = el._leaflet_pos?.y;
          const lon = el._leaflet_pos?.x;

          if (lat && lon) {
            results.push({
              lat,
              lon,
              mag: Math.random() * 5 // временно
            });
          }
        });
      }

      return results;
    });

    // fallback если ничего не нашли
    if (!data || data.length === 0) {
      console.log("No markers found, using fallback parsing");

      const text = await page.content();

      const matches = text.match(/lat:\s*([\d.]+).*?lon:\s*([\d.]+)/gs);

      if (matches) {
        cache = matches.map(m => {
          const lat = m.match(/lat:\s*([\d.]+)/)[1];
          const lon = m.match(/lon:\s*([\d.]+)/)[1];

          return {
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            mag: 0,
            depth: "-",
            date: new Date().toLocaleString()
          };
        });
      }
    } else {
      cache = data.map(d => ({
        ...d,
        depth: "-",
        date: new Date().toLocaleString()
      }));
    }

    lastUpdate = new Date();

    console.log("Parsed:", cache.length);

  } catch (e) {
    console.log("Puppeteer error:", e.message);
  } finally {
    if (browser) await browser.close();
  }
}

// запуск
setTimeout(fetchKNDC, 3000);
setInterval(fetchKNDC, 600000);

// API
app.get("/earthquakes", (req, res) => {
  res.json({
    updated: lastUpdate,
    count: cache.length,
    data: cache
  });
});

// порт
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server started on", PORT);
});
