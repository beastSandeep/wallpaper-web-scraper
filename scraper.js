// scraper.js
const { workerData, parentPort } = require("worker_threads");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

puppeteer.use(StealthPlugin());

async function downloadImage(url, filename) {
  const filePath = path.join(__dirname, "downloads", filename);
  const writer = fs.createWriteStream(filePath);

  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/118.0.5993.89 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      Referer: "https://wallpapershome.com/",
    },
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => {
      parentPort.postMessage({ type: "download", filename });
      resolve();
    });
    writer.on("error", reject);
  });
}

(async () => {
  const { URL, startPage, endPage, workerId } = workerData;

  const browser = await puppeteer.launch({ headless: true });
  try {
    for (let i = startPage; i <= endPage; i++) {
      parentPort.postMessage({
        type: "status",
        message: `Worker ${workerId}: Opening page ${i}`,
      });
      const page = await browser.newPage();

      await page.goto(`${URL}${i}`, {
        waitUntil: "networkidle2",
      });

      const links = await page.evaluate(() =>
        Array.from(document.querySelectorAll("div.pics:not(#pics-list) a")).map(
          (a) => a.href
        )
      );

      for (const link of links) {
        await page.goto(link, { waitUntil: "networkidle2" });

        const imgUrl = await page.evaluate(() => {
          const blocks = document.querySelectorAll(
            ".block-download__resolutions--6 p"
          );
          for (const block of blocks) {
            const label = block.querySelector("span")?.innerText.trim();
            const link = block.querySelector("a")?.getAttribute("href");
            if (label === "4K UHD" && link) {
              return "https://wallpapershome.com" + link;
            }
          }
          return null;
        });

        if (imgUrl) {
          const filename = path.basename(imgUrl);
          await downloadImage(imgUrl, filename);
        } else {
          parentPort.postMessage({
            type: "status",
            message: `Worker ${workerId}: No 4K UHD image found on ${link}`,
          });
        }
      }
      await page.close();
      parentPort.postMessage({
        type: "status",
        message: `Worker ${workerId}: Closed page ${i}`,
      });
    }
  } catch (err) {
    parentPort.postMessage({ type: "error", error: err.message });
  } finally {
    await browser.close();
    parentPort.postMessage({ type: "done" });
  }
})();
