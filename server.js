const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();

// ✅ РАЗРЕШАЕМ CORS (чтобы Tilda могла забирать данные)
app.use(cors());

let cache = [];
let lastUpdate = null;

// Защита от падений
process.on("uncaughtException", err => console.error(err));
process.on("unhandledRejection", err => console.error(err));

async function fetchKNDC() {
  let browser;
  try {
    console.log("🔄 Запуск парсинга данных за 24ч...");
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    // Идем в раздел срочных донесений (там данные за сутки)
    await page.goto("https://kndc.kz", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // Ждем прогрузки таблицы
    await new Promise(r => setTimeout(r, 5000));

    const earthquakes = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tr"));
      return rows.slice(1).map(row => {
        const cols = Array.from(row.querySelectorAll("td")).map(td => td.innerText.trim());
        if (cols.length >= 5) {
          return {
            datetime: cols[0] + " " + (cols[1] || ""),
            lat: cols[2],
            lon: cols[3],
            mag: cols[4],
            depth: cols[5] || "-",
            region: cols[cols.length - 1]
          };
        }
        return null;
      }).filter(item => item !== null);
    });

    if (earthquakes.length >= 0) {
      cache = earthquakes;
      lastUpdate = new Date();
      console.log(`✅ Обновлено: ${earthquakes.length} событий`);
    }
  } catch (e) {
    console.log("❌ Ошибка:", e.message);
  } finally {
    if (browser) await browser.close();
  }
}

// Интервалы
setTimeout(fetchKNDC, 2000);
setInterval(fetchKNDC, 1800000); // каждые 30 минут

app.get("/earthquakes", (req, res) => {
  res.json({
    updated: lastUpdate,
    count: cache.length,
    data: cache
  });
});

app.get("/", (req, res) => res.send("KNDC API is running. Go to /earthquakes"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server started on port", PORT);
});
