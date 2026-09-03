/* 매주 돌면서 화수를 확인한다.
 *
 * 네이버 : JSON 주소로 바로 읽는다 (빠름, 브라우저 안 띄움)
 * 그 외  : Playwright로 진짜 브라우저를 띄워서 읽는다
 *
 * 안전장치
 *  - 숫자가 줄어들면 반영하지 않는다 (읽기 실패일 가능성이 높다)
 *  - 한 주에 30화 넘게 뛰면 반영하지 않는다 (광고 문구를 잘못 읽은 것)
 *  - 실패하면 needsCheck 만 켜두고 숫자는 손대지 않는다
 *  - 휴재는 저절로 처리된다. 새 화가 없으니 숫자가 안 늘 뿐이다
 */

import { readFile, writeFile } from "node:fs/promises";

const FILE = "data/webtoons.json";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAX_JUMP = 30;
const today = new Date().toISOString().slice(0, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 본문에서 "숫자 + 화" 중 가장 큰 값을 뽑는다 */
function biggestEpisode(text) {
  const nums = [...text.matchAll(/(\d{1,4})\s*화/g)]
    .map(m => +m[1])
    .filter(n => n > 0 && n < 5000);
  return nums.length ? Math.max(...nums) : null;
}

/* 네이버: 내부 JSON 주소 (비공식이라 바뀔 수 있다) */
async function naver(url) {
  const id = new URL(url).searchParams.get("titleId");
  if (!id) throw new Error("titleId 없음");
  const r = await fetch(
    `https://comic.naver.com/api/article/list?titleId=${id}&page=1&sort=DESC`,
    { headers: { "User-Agent": UA, Referer: "https://comic.naver.com/" } }
  );
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  const no = j?.articleList?.[0]?.no;
  if (!no) throw new Error("화수를 못 찾음");
  return { episodes: Number(no), finished: !!j?.finished };
}

/* 나머지: 브라우저로 열어서 읽는다 */
let browser = null;
async function viaBrowser(url, hint = {}) {
  if (!browser) {
    const { chromium } = await import("playwright");
    browser = await chromium.launch();
  }
  const ctx = await browser.newContext({ userAgent: UA, locale: "ko-KR" });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    /* 목록을 여는 버튼이 있는 사이트용. 없으면 그냥 넘어간다 */
    for (const sel of hint.click ?? []) {
      try {
        await page.click(sel, { timeout: 2000 });
        await page.waitForTimeout(1500);
      } catch (e) { /* 없으면 그만 */ }
    }

    const text = await page.evaluate(() => document.body.innerText);
    const episodes = biggestEpisode(text);
    if (!episodes) throw new Error("화수를 못 찾음");
    return { episodes, finished: /완결/.test(text) };
  } finally {
    await ctx.close();
  }
}

/* 플랫폼 목록. 새 사이트는 여기에 한 줄 추가하면 된다 */
const SITES = [
  { host: "comic.naver.com",     read: naver },
  { host: "webtoon.kakao.com",   read: u => viaBrowser(u, { click: ["text=회차"] }) },
  { host: "page.kakao.com",      read: u => viaBrowser(u, { click: ["text=회차"] }) },
  { host: "lezhin.com",          read: u => viaBrowser(u) },
  { host: "toptoon.com",         read: u => viaBrowser(u) },
  { host: "bufftoon.plaync.com", read: u => viaBrowser(u) },
  { host: "ridibooks.com",       read: u => viaBrowser(u) },
];

const store = JSON.parse(await readFile(FILE, "utf8"));
let changed = 0, failed = 0, skipped = 0;

for (const w of store.items) {
  if (!w.autoUpdate || !w.url) { skipped++; continue; }

  if (w.status === "완결" || w.status === "휴재") {
    console.log(`  ${w.title}: ${w.status}이라 건너뜀`);
    skipped++;
    continue;
  }

  let site = null;
  try {
    const h = new URL(w.url).hostname;
    site = SITES.find(s => h.includes(s.host));
  } catch (e) { /* 주소가 이상함 */ }

  if (!site) {
    console.log(`  ${w.title}: 모르는 사이트라 건너뜀`);
    skipped++;
    continue;
  }

  try {
    const r = await site.read(w.url);
    w.lastChecked = today;

    if (r.episodes === w.episodes) {
      w.needsCheck = false;
      console.log(`  ${w.title}: 그대로 (${w.episodes}화) — 휴재 중일 수 있다`);
    } else if (r.episodes < w.episodes) {
      w.needsCheck = true;
      changed++; failed++;
      console.log(`  ${w.title}: [주의] ${w.episodes} -> ${r.episodes} 로 줄어서 무시함`);
    } else if (r.episodes - w.episodes > MAX_JUMP) {
      w.needsCheck = true;
      changed++; failed++;
      console.log(`  ${w.title}: [주의] ${w.episodes} -> ${r.episodes} 는 너무 많이 뛰어서 무시함`);
    } else {
      console.log(`  ${w.title}: ${w.episodes} -> ${r.episodes}`);
      w.prevEpisodes = w.episodes;
      w.episodes = r.episodes;
      w.needsCheck = false;
      changed++;
    }

    if (r.finished && w.status !== "완결") {
      w.status = "완결";
      changed++;
      console.log(`  ${w.title}: 완결로 바뀜`);
    }
  } catch (e) {
    w.needsCheck = true;
    w.lastChecked = today;
    failed++; changed++;
    console.log(`  ${w.title}: 실패 (${e.message})`);
  }

  await sleep(1500);
}

if (browser) await browser.close();

console.log(`\n바뀜 ${changed} · 문제 ${failed} · 건너뜀 ${skipped}`);

if (changed) {
  store.updated = today;
  await writeFile(FILE, JSON.stringify(store, null, 2) + "\n");
  console.log("파일을 고쳤다");
} else {
  console.log("고칠 게 없다");
}
