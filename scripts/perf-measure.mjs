/**
 * 性能测量脚本（前后对比用）。
 *
 * 用法：
 *   node scripts/perf-measure.mjs <baseURL> <outputJSON> [--label <label>]
 *
 * 例：
 *   node scripts/perf-measure.mjs http://127.0.0.1:3000 docs/implementation/2026-08-15-p0-1/perf-baseline.json --label baseline
 *
 * 测量内容：
 *   1. 页面导航指标：TTFB / domContentLoaded / loadEvent / FCP
 *   2. 资源指标：请求数 / 传输字节 / JS 传输字节
 *   3. /posts 无限滚动交互场景：滚动触发的 /api/posts 请求数与 URL
 *   4. 纯 API 计时：/api/posts?limit=1
 *
 * 每个页面跑 RUNS 次取中位数，并记录 min/max 离散度（离散度大于前后对比差值时，
 * 结论只能视为“方向性一致”，不能宣称显著改善）；每次使用全新浏览器上下文（无缓存）。
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const labelIndex = args.indexOf("--label");
const label = labelIndex >= 0 ? args[labelIndex + 1] : "run";
const [baseURL, outputJSON] = positional;

if (!baseURL || !outputJSON) {
  console.error("Usage: node scripts/perf-measure.mjs <baseURL> <outputJSON> [--label <label>]");
  process.exit(1);
}

const RUNS = 5;
const WAIT_AFTER_LOAD_MS = 600;

function median(values) {
  const sorted = [...values].filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function medianOf(metricsList, key) {
  return median(metricsList.map((m) => m[key]));
}

function spreadOf(metricsList, key) {
  const values = metricsList.map((m) => m[key]).filter((v) => typeof v === "number" && Number.isFinite(v));
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values), range: Math.max(...values) - Math.min(...values) };
}

async function measurePage(browser, url, { collectApiUrls = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  const requests = [];
  page.on("request", (req) => {
    const u = req.url();
    if (!u.startsWith("data:")) requests.push(u);
    if (collectApiUrls && u.includes(collectApiUrls)) collectApiUrls.count.push(u);
  });

  const start = Date.now();
  let navError = null;
  try {
    await page.goto(url, { waitUntil: "load", timeout: 60000 });
  } catch (error) {
    navError = error instanceof Error ? error.message : String(error);
  }
  await page.waitForTimeout(WAIT_AFTER_LOAD_MS).catch(() => undefined);

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    const paint = performance.getEntriesByType("paint");
    const jsResources = resources.filter((r) => r.initiatorType === "script");
    return {
      ttfb: nav ? Math.round(nav.responseStart) : null,
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      loadEvent: nav ? Math.round(nav.loadEventEnd) : null,
      resourceCount: resources.length,
      transferSize: resources.reduce((s, r) => s + (r.transferSize || 0), 0),
      jsTransfer: jsResources.reduce((s, r) => s + (r.transferSize || 0), 0),
      firstContentfulPaint: paint.find((p) => p.name === "first-contentful-paint")?.startTime ?? null,
    };
  });
  const wallMs = Date.now() - start;
  await context.close();

  return {
    wallMs,
    navError,
    requestCount: requests.length,
    ...metrics,
  };
}

async function measureScrollScenario(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  const apiRequests = { count: [] };
  page.on("request", (req) => {
    if (req.url().includes("/api/posts")) apiRequests.count.push(req.url());
  });

  const start = Date.now();
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => undefined);
  await page.waitForTimeout(400);
  const beforeScroll = apiRequests.count.length;

  // 向下滚动 8 次，触发 IntersectionObserver 加载下一页
  await page.evaluate(async () => {
    for (let i = 0; i < 8; i += 1) {
      window.scrollBy(0, 1400);
      await new Promise((r) => setTimeout(r, 300));
    }
  });
  await page.waitForTimeout(2000);

  const distinct = [...new Set(apiRequests.count)];
  await context.close();
  return {
    wallMs: Date.now() - start,
    apiRequestsBeforeScroll: beforeScroll,
    apiRequestsTotal: apiRequests.count.length,
    distinctApiUrls: distinct,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  const report = {
    label,
    baseURL,
    createdAt: new Date().toISOString(),
    runs: RUNS,
    pages: {},
    scenarios: {},
    api: {},
  };

  const discoverPostSlug = async () => {
    try {
      const res = await fetch(`${baseURL}/api/posts?limit=1`);
      const payload = await res.json();
      const post = payload?.data?.[0];
      return post?.slug ?? null;
    } catch {
      return null;
    }
  };
  const postSlug = await discoverPostSlug();

  const pageTargets = [
    { name: "home", url: `${baseURL}/` },
    { name: "posts", url: `${baseURL}/posts` },
    { name: "about", url: `${baseURL}/about` },
    ...(postSlug ? [{ name: "postDetail", url: `${baseURL}/posts/${postSlug}` }] : []),
  ];

  for (const target of pageTargets) {
    const runs = [];
    for (let i = 0; i < RUNS; i += 1) {
      const m = await measurePage(browser, target.url);
      runs.push(m);
      process.stdout.write(`  [${target.name}] run ${i + 1}/${RUNS} load=${m.loadEvent}ms ttfb=${m.ttfb}ms req=${m.requestCount} transfer=${m.transferSize}B\n`);
    }
    report.pages[target.name] = {
      url: target.url,
      median: {
        wallMs: medianOf(runs, "wallMs"),
        ttfb: medianOf(runs, "ttfb"),
        domContentLoaded: medianOf(runs, "domContentLoaded"),
        loadEvent: medianOf(runs, "loadEvent"),
        firstContentfulPaint: medianOf(runs, "firstContentfulPaint"),
        requestCount: Math.round(medianOf(runs, "requestCount") ?? 0),
        transferSize: Math.round(medianOf(runs, "transferSize") ?? 0),
        jsTransfer: Math.round(medianOf(runs, "jsTransfer") ?? 0),
      },
      spread: {
        wallMs: spreadOf(runs, "wallMs"),
        ttfb: spreadOf(runs, "ttfb"),
        loadEvent: spreadOf(runs, "loadEvent"),
        firstContentfulPaint: spreadOf(runs, "firstContentfulPaint"),
      },
      runs,
    };
  }

  // /posts 无限滚动场景
  const scrollRuns = [];
  for (let i = 0; i < RUNS; i += 1) {
    const m = await measureScrollScenario(browser, `${baseURL}/posts`);
    scrollRuns.push(m);
    process.stdout.write(`  [posts-scroll] run ${i + 1}/${RUNS} requests=${m.apiRequestsTotal} (before scroll: ${m.apiRequestsBeforeScroll})\n`);
  }
  report.scenarios.postsScroll = {
    median: {
      wallMs: medianOf(scrollRuns, "wallMs"),
      apiRequestsBeforeScroll: medianOf(scrollRuns, "apiRequestsBeforeScroll"),
      apiRequestsTotal: medianOf(scrollRuns, "apiRequestsTotal"),
    },
    distinctApiUrls: scrollRuns[scrollRuns.length - 1]?.distinctApiUrls ?? [],
    runs: scrollRuns,
  };

  // 纯 API 计时
  const apiRuns = [];
  for (let i = 0; i < RUNS; i += 1) {
    const start = Date.now();
    let status = 0;
    try {
      const res = await fetch(`${baseURL}/api/posts?limit=1`);
      status = res.status;
      await res.json();
    } catch {
      status = 0;
    }
    apiRuns.push({ ms: Date.now() - start, status });
    process.stdout.write(`  [api/posts] run ${i + 1}/${RUNS} ${apiRuns.at(-1).ms}ms (HTTP ${status})\n`);
  }
  report.api.postsList = { medianMs: medianOf(apiRuns, "ms"), runs: apiRuns };

  await browser.close();

  const out = resolve(outputJSON);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`\nReport written: ${out}`);
  console.log(JSON.stringify({ pages: report.pages, scenarios: report.scenarios, api: report.api }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
