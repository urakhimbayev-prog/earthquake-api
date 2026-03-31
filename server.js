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
    
    // Переходим на страницу срочных донесений
    await page.goto("https://kndc.kz", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // Ждем появления таблицы (селектор по классу или тегу)
    await page.waitForSelector('table', { timeout: 15000 });
    // Небольшая пауза, чтобы данные внутри таблицы отрисовались
    await new Promise(r => setTimeout(r, 5000));

    const earthquakes = await page.evaluate(() => {
      // Ищем все строки во всех таблицах на странице
      const rows = Array.from(document.querySelectorAll("table tr"));
      
      return rows.map(row => {
        const cols = Array.from(row.querySelectorAll("td")).map(td => td.innerText.trim());
        
        // Отладка индексов:
        // Широта (Lat) обычно 2-я колонка (индекс 1)
        // Магнитуда mb (индекс 6), mpv (индекс 7), K (индекс 8)
        const lat = parseFloat(cols[1]);
        const lon = parseFloat(cols[2]);

        if (!isNaN(lat) && !isNaN(lon) && cols.length >= 7) {
          return {
            datetime: cols[0].split('\n')[0], // Дата без "N минут назад"
            lat: cols[1],
            lon: cols[2],
            mag: cols[6] || cols[7] || cols[8] || "0", // Пробуем mb, mpv или K
            region: cols[10] || cols[cols.length - 1] || "Центральная Азия"
          };
        }
        return null;
      }).filter(item => item !== null);
    });

    cache = earthquakes;
    lastUpdate = new Date();
    console.log(`✅ Успешно! Найдено событий: ${earthquakes.length}`);

  } catch (e) {
    console.log("❌ Ошибка парсинга:", e.message);
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
