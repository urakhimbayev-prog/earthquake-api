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

    let earthquakes = [];

    // 🔥 ПЕРЕХВАТ API
    page.on("response", async (response) => {
      const url = response.url();

      if (url.includes("json") || url.includes("event") || url.includes("quake")) {
        try {
          const data = await response.json();

          // адаптация под структуру (универсально)
          if (data.features) {
            earthquakes = data.features.map(f => {
              const [lon, lat, depth] = f.geometry.coordinates;

              return {
                lat,
                lon,
                depth,
                mag: f.properties.mag,
                date: new Date(f.properties.time).toLocaleString()
              };
            });
          }
        } catch (e) {}
      }
    });

    await page.goto(
      "https://kndc.kz/index.php/sejsmicheskie-byulleteni/interactive-bulletin",
      { waitUntil: "networkidle2", timeout: 60000 }
    );

    // даём время загрузке данных
    await new Promise(resolve => setTimeout(resolve, 5000));

    if (earthquakes.length > 0) {
      cache = earthquakes;
      lastUpdate = new Date();
      console.log("Parsed from API:", earthquakes.length);
    } else {
      console.log("No API data found");
    }

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
