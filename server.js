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
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    await page.goto(
      "https://kndc.kz/index.php/sejsmicheskie-byulleteni/interactive-bulletin",
      { waitUntil: "networkidle2", timeout: 60000 }
    );

    // ⏳ ждём пока карта загрузит данные
    await new Promise(resolve => setTimeout(resolve, 7000));

    const earthquakes = await page.evaluate(() => {
      const results = [];

      // 🔥 перебираем глобальные переменные
      for (let key in window) {
        try {
          const val = window[key];

          // ищем массив с координатами
          if (Array.isArray(val)) {
            val.forEach(item => {
              if (
                item &&
                typeof item === "object" &&
                ("lat" in item || "latitude" in item) &&
                ("lng" in item || "lon" in item || "longitude" in item)
              ) {
                results.push({
                  lat: item.lat || item.latitude,
                  lon: item.lng || item.lon || item.longitude,
                  mag: item.mag || item.magnitude || 0,
                  depth: item.depth || "-",
                  date: item.date || new Date().toLocaleString()
                });
              }
            });
          }
        } catch (e) {}
      }

      return results;
    });

    if (earthquakes.length > 0) {
      cache = earthquakes;
      lastUpdate = new Date();
      console.log("Parsed real data:", earthquakes.length);
    } else {
      console.log("Still no data found");
    }

  } catch (e) {
    console.log("Error:", e.message);
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
page.on("response", async (response) => {
  console.log("URL:", response.url());
});
