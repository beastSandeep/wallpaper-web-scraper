const { Worker } = require("worker_threads");
const path = require("path");

const START_PAGE = 1; // start from here
const MAX_PAGE = 78;
const NUM_WORKERS = 5;

const URL = "https://wallpapershome.com/nature/?page=";

function splitPageRanges(start, end, workers) {
  const totalPages = end - start + 1;
  const ranges = [];
  const chunkSize = Math.ceil(totalPages / workers);

  for (let i = 0; i < workers; i++) {
    const rangeStart = start + i * chunkSize;
    const rangeEnd = Math.min(rangeStart + chunkSize - 1, end);
    if (rangeStart > end) break; // no more pages
    ranges.push({ startPage: rangeStart, endPage: rangeEnd });
  }
  console.log(ranges);
  return ranges;
}

const ranges = splitPageRanges(START_PAGE, MAX_PAGE, NUM_WORKERS);

ranges.forEach(({ startPage, endPage }, i) => {
  const worker = new Worker(path.resolve(__dirname, "scraper.js"), {
    workerData: { URL, startPage, endPage, workerId: i + 1 },
  });

  worker.on("message", (msg) => {
    if (msg.type === "status") {
      console.log(`[Worker ${i + 1} Status]: ${msg.message}`);
    } else if (msg.type === "download") {
      console.warn(`[Worker ${i + 1} Downloaded]: ${msg.filename}`);
    } else if (msg.type === "error") {
      console.error(`[Worker ${i + 1} Error]: ${msg.error}`);
    } else if (msg.type === "done") {
      console.log(`[Worker ${i + 1}] Finished scraping.`);
    }
  });

  worker.on("error", (err) => {
    console.error(`[Worker ${i + 1} Thread Error]:`, err);
  });

  worker.on("exit", (code) => {
    console.log(`[Worker ${i + 1}] exited with code ${code}`);
  });
});
