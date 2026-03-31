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
    console.log("🔄 Запуск парсинга...");
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    await page.goto("https://kndc.kz", {
      waitUntil: "networkidle2",
      timeout: 60000
    });
    await new Promise(r => setTimeout(r, 5000));

        const earthquakes = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tr"));
      return rows.map(row => {
        const cols = Array.from(row.querySelectorAll("td")).map(td => td.innerText.trim());
        
        // Фильтр: колонок должно быть много, и вторая колонка (Lat) должна быть числом
        if (cols.length >= 7 && !isNaN(parseFloat(cols[1]))) {
          return {
            datetime: cols[0].split('\n')[0], // Убираем текст "N минут назад"
            lat: cols[1],
            lon: cols[2],
            mag: cols[4],     // В Alarm Bulletin магнитуда обычно в 5-й колонке
            depth: cols[5],
            region: cols[cols.length - 1] || "Регион не указан"
          };
        }
        return null;
      }).filter(item => item !== null);
    });

    if (earthquakes.length >= 0) {
      cache = earthquakes;
      lastUpdate = new Date();
      console.log(`✅ Найдено чистых событий: ${earthquakes.length}`);
    }
  } catch (e) {
    console.log("❌ Ошибка:", e.message);
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
app.listen(PORT, () => console.log(`API Server: http://localhost:${PORT}/earthquakes/today`));
