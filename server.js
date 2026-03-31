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
    console.log("🔄 Запуск парсинга с ожиданием данных...");
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    
    // 1. Идем на страницу
    await page.goto("https://kndc.kz", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // 2. Ждем, пока в таблице появится хотя бы одна строка с данными (кроме заголовка)
    // Мы ищем строку, где есть класс или где во второй колонке есть цифры
    try {
        await page.waitForFunction(() => {
            const rows = document.querySelectorAll("table tr");
            return rows.length > 2; // Ждем, пока строк станет больше, чем просто заголовок
        }, { timeout: 20000 });
    } catch (e) {
        console.log("⚠️ Таблица не догрузилась вовремя, пробуем парсить что есть...");
    }

    // 3. Пауза для окончательной отрисовки
    await new Promise(r => setTimeout(r, 3000));

    const earthquakes = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tr"));
      
      return rows.map(row => {
        const cols = Array.from(row.querySelectorAll("td")).map(td => td.innerText.trim());
        
        // Индексы для Alarm Bulletin (Срочные донесения):
        // 0: Дата/Время, 1: Lat, 2: Lon, 6: mb, 7: mpv, 10: Region
        const lat = parseFloat(cols);
        
        if (cols.length >= 7 && !isNaN(lat)) {
          return {
            datetime: cols.split('\n'), // Чистое время
            lat: cols,
            lon: cols,
            mag: cols || cols || cols || "0", // Пробуем mb, mpv или K
            region: cols || cols[cols.length - 1] || "Центральная Азия"
          };
        }
        return null;
      }).filter(item => item !== null);
    });

    cache = earthquakes;
    lastUpdate = new Date();
    console.log(`✅ Успешно! Найдено событий: ${earthquakes.length}`);

  } catch (e) {
    console.log("❌ Критическая ошибка парсинга:", e.message);
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
