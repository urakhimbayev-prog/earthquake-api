const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");
const app = express();
app.use(cors());
let cache = [];
let lastUpdate = null;

// Обработка ошибок
process.on("uncaughtException", err => console.error("GLOBAL ERROR:", err));

async function fetchKNDC() {
    let browser;
    try {
        console.log("🔄 Обновление данных за последние 24 часа...");
        browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });

        const page = await browser.newPage();

        // 🎯 ШАГ 1: Перехват сетевых ответов
        page.on('response', async (response) => {
            const url = response.url();
            // Ищем запрос, который содержит данные бюллетеня (обычно json или php с параметрами)
            if (url.includes("get_bulletin") || url.includes("contentLoader") || url.includes(".json")) {
                try {
                    const data = await response.json();
                    if (Array.isArray(data) && data.length > 0) {
                        cache = data;
                        lastUpdate = new Date();
                        console.log(`✅ Данные получены через перехват API: ${data.length} событий`);
                    }
                } catch (e) {
                    // Не каждый ответ — JSON, это нормально
                }
            }
        });

        // 🎯 ШАГ 2: Переход на страницу
        await page.goto("https://kndc.kz/index.php/sejsmicheskie-byulleteni/interactive-bulletin", {
            waitUntil: "networkidle2",
            timeout: 60000
        });

        // 🎯 ШАГ 3: Если перехват не сработал, пробуем вытащить данные из таблицы (DOM)
        // На kndc данные часто рендерятся в таблицу под картой
        await page.waitForTimeout(5000); // Даем время на отрисовку

        const tableData = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('table tr')); // Селектор может меняться
            return rows.slice(1).map(row => {
                const cols = row.querySelectorAll('td');
                if (cols.length < 5) return null;
                return {
                    date: cols[0]?.innerText.trim(),
                    lat: cols[1]?.innerText.trim(),
                    lon: cols[2]?.innerText.trim(),
                    mag: cols[3]?.innerText.trim(),
                    region: cols[5]?.innerText.trim()
                };
            }).filter(i => i !== null);
        });

        if (tableData.length > 0 && cache.length === 0) {
            cache = tableData;
            lastUpdate = new Date();
            console.log(`✅ Данные извлечены из таблицы DOM: ${tableData.length} событий`);
        }

    } catch (e) {
        console.error("❌ Ошибка при парсинге:", e.message);
    } finally {
        if (browser) await browser.close();
    }
}

// Интервалы
setTimeout(fetchKNDC, 2000);
setInterval(fetchKNDC, 10 * 60 * 1000); // Раз в 10 минут

app.get("/earthquakes", (req, res) => {
    res.json({
        success: cache.length > 0,
        updated: lastUpdate,
        count: cache.length,
        data: cache
    });
});

app.get("/", (req, res) => res.send("KNDC Parser is Online"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
