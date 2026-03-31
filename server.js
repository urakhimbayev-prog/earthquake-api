const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());

let cache = [];
let lastUpdate = null;

async function fetchKNDC() {
  try {
    console.log("🔄 Запрос данных напрямую через API KNDC...");
    
    // ✅ Полный рабочий URL с параметрами сортировки и лимита
    const url = "https://kndc.kz/kndc/pagecontent/alarm-bulletin/getOriginList.php?orderby=epochtime&desc=no&activepage=293&start=5839&limit=20";
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win 64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Referer': 'https://kndc.kz'
      }
    });

    const resData = response.data;
    
    // Данные в этом API лежат в поле .rows
    const items = resData.rows || [];

    if (items.length > 0) {
      cache = items.map(item => ({
        datetime: item.datetime || item.date_time || item.epochtime || "—",
        lat: item.lat || item.latitude,
        lon: item.lon || item.longitude,
        mag: item.mb || item.mpv || item.ml || item.mag || item.k || "0",
        region: item.region || item.location || "Центральная Азия",
        depth: item.depth || "-"
      }));
      
      lastUpdate = new Date();
      console.log(`✅ Данные обновлены! Найдено событий: ${cache.length}`);
    } else {
      console.log("⚠️ Сервер ответил, но список событий пуст.");
      // Выводим в лог первые 100 символов ответа для проверки структуры
      console.log("Ответ от сервера:", JSON.stringify(resData).substring(0, 100));
    }
  } catch (e) {
    console.error("❌ Ошибка запроса:", e.message);
  }
}

// Запуск парсинга сразу и потом каждые 15 минут
setTimeout(fetchKNDC, 2000);
setInterval(fetchKNDC, 900000);

app.get("/earthquakes", (req, res) => {
  res.json({
    updated: lastUpdate,
    count: cache.length,
    data: cache
  });
});

app.get("/", (req, res) => res.send("KNDC Fast API is running. Go to /earthquakes"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
