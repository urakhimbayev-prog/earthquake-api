const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");
app.use(cors());
const app = express();
let cache = [];
let lastUpdate = null;

async function fetchKNDC() {
  let browser;
  try {
    console.log("🔄 Обновление данных за последние 24 часа...");
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    
    // Переходим сразу в раздел срочных донесений
    await page.goto("https://kndc.kz/index.php/sejsmicheskie-byulleteni/alarm-bulletin", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // 1. Ждем появления легенды/фильтров и кликаем "За сутки"
    // На сайте это обычно ссылка или кнопка с текстом "За сутки"
    try {
      const dayFilterSelector = "xpath/.//*[contains(text(), 'За сутки')]";
      await page.waitForSelector(dayFilterSelector, { timeout: 5000 });
      await page.click(dayFilterSelector);
      
      // Ждем обновления таблицы после клика
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      console.log("⚠️ Фильтр 'За сутки' не найден или уже активен");
    }

    // 2. Извлекаем данные из таблицы событий
    const earthquakes = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tr"));
      // Пропускаем заголовок (обычно первая строка)
      return rows.slice(1).map(row => {
        const cols = Array.from(row.querySelectorAll("td")).map(td => td.innerText.trim());
        
        // Структура таблицы на kndc (примерная): Дата, Время, Широта, Долгота, Mag, Глубина, Регион
        if (cols.length >= 5) {
          return {
            datetime: cols[0] + " " + (cols[1] || ""),
            lat: cols[2],
            lon: cols[3],
            mag: cols[4],
            depth: cols[5] || "-",
            region: cols[cols.length - 1] // Последняя колонка обычно регион
          };
        }
        return null;
      }).filter(item => item !== null);
    });

    if (earthquakes.length >= 0) {
      cache = earthquakes;
      lastUpdate = new Date();
      console.log(`✅ Найдено событий за 24ч: ${earthquakes.length}`);
    }

  } catch (err) {
    console.error("❌ Ошибка парсинга:", err.message);
  } finally {
    if (browser) await browser.close();
  }
}

// Запуск раз в 30 минут (для оперативных данных)
setInterval(fetchKNDC, 1800000);
setTimeout(fetchKNDC, 1000);

app.get("/earthquakes/today", (req, res) => {
  res.json({
    period: "last 24 hours",
    updated: lastUpdate,
    count: cache.length,
    data: cache
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API Server: http://localhost:${PORT}/earthquakes/today`));
