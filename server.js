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
    console.log("🔄 Попытка парсинга Интерактивного бюллетеня...");
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    
    // Переходим на страницу, где таблица всегда есть в DOM
    await page.goto("https://kndc.kz", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // Ждем появления хотя бы одной ячейки таблицы
    await page.waitForSelector('table td', { timeout: 20000 });
    await new Promise(r => setTimeout(r, 5000)); // Даем время на отрисовку JS-скриптов карты

    const earthquakes = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tr"));
      
      return rows.map(row => {
        const cols = Array.from(row.querySelectorAll("td")).map(td => td.innerText.trim());
        
        // В интерактивном бюллетене порядок часто такой:
        // 0: Время, 1: Lat, 2: Lon, 3: mb/mag, 4: K, 5: Глубина, 6: Регион
        const lat = parseFloat(cols[1]);
        const lon = parseFloat(cols[2]);

        if (!isNaN(lat) && !isNaN(lon) && cols.length >= 5) {
          return {
            datetime: cols[0].split('\n')[0], // Берем только дату
            lat: lat.toString(),
            lon: lon.toString(),
            mag: cols[3] || cols[4] || "0", // Пробуем mb или K
            region: cols[6] || "Центральная Азия"
          };
        }
        return null;
      }).filter(item => item !== null);
    });

    if (earthquakes.length > 0) {
      cache = earthquakes;
      lastUpdate = new Date();
      console.log(`✅ Найдено событий: ${earthquakes.length}`);
    } else {
      console.log("⚠️ Таблица найдена, но данных внутри нет.");
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
app.listen(PORT, () => console.log(`API Server: http://localhost:${PORT}/earthquakes`));
