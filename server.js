const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();

let cache = [];
let lastUpdate = null;

// защита
process.on("uncaughtException", err => console.error(err));
process.on("unhandledRejection", err => console.error(err));

// тест
app.get("/", (req, res) => {
  res.send("Parser API is running");
});

// 🔍 парсинг KNDC
async function fetchKNDC() {
  try {
    const url = "https://kndc.kz/index.php/sejsmicheskie-byulleteni/interactive-bulletin";

    const { data } = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const $ = cheerio.load(data);
    const earthquakes = [];

    // 🔥 ищем данные внутри script
    $("script").each((i, el) => {
      const text = $(el).html();

      if (text && text.includes("lat") && text.includes("lon")) {
        const matches = text.match(/lat:\s*([\d.]+).*?lon:\s*([\d.]+).*?mag:\s*([\d.]+)/gs);

        if (matches) {
          matches.forEach(m => {
            const lat = m.match(/lat:\s*([\d.]+)/)[1];
            const lon = m.match(/lon:\s*([\d.]+)/)[1];
            const mag = m.match(/mag:\s*([\d.]+)/)[1];

            earthquakes.push({
              lat: parseFloat(lat),
              lon: parseFloat(lon),
              mag: parseFloat(mag),
              date: new Date().toLocaleString(),
              depth: "-"
            });
          });
        }
      }
    });

    // fallback если не нашли
    if (earthquakes.length === 0) {
      console.log("No data parsed, using fallback");
    } else {
      cache = earthquakes;
      lastUpdate = new Date();
    }

    console.log("Parsed:", earthquakes.length);

  } catch (e) {
    console.log("Parse error:", e.message);
  }
}

// запуск
setTimeout(fetchKNDC, 2000);
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
  console.log("Parser started");
});
