/* 매주 돌면서 화수를 확인한다.
   autoUpdate 가 켜져 있고 url 이 있는 작품만 본다.
   못 읽으면 needsCheck 를 세워두고 숫자는 건드리지 않는다.
   → 휴재하면 숫자가 그대로 남는다. 그게 맞는 동작이다. */

import { readFile, writeFile } from "node:fs/promises";

const FILE = "data/webtoons.json";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36";
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, json = false){
  const r = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://comic.naver.com/" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return json ? r.json() : r.text();
}

/* ── 네이버웹툰 ──
   비공식 내부 주소다. 언젠가 바뀔 수 있고, 바뀌면 needsCheck 가 켜진다. */
async function naver(url){
  const id = new URL(url).searchParams.get("titleId");
  if (!id) throw new Error("titleId 없음");

  try {
    const j = await get(`https://comic.naver.com/api/article/list?titleId=${id}&page=1&sort=DESC`, true);
    const no = j?.articleList?.[0]?.no;
    if (no) return { episodes: Number(no), finished: !!j?.finished };
  } catch (e) { /* 아래로 */ }

  // 예비: 목록 페이지에서 no= 숫자 중 가장 큰 값
  const html = await get(url);
  const nums = [...html.matchAll(/[?&]no=(\d+)/g)].map(m => +m[1]);
  if (!nums.length) throw new Error("화수를 못 찾음");
  return { episodes: Math.max(...nums), finished: /완결/.test(html) };
}

/* 다른 플랫폼은 아직 붙이지 않았다.
   카카오·레진·탑툰은 자바스크립트로 그려서 이 방식으로는 안 읽힌다.
   필요해지면 여기에 함수를 하나 더 만들고 PARSERS 에 등록하면 된다. */
const PARSERS = { "comic.naver.com": naver };

const store = JSON.parse(await readFile(FILE, "utf8"));
let changed = 0, failed = 0, skipped = 0;

for (const w of store.items){
  if (!w.autoUpdate || !w.url || w.status === "완결" || w.status === "휴재"){ skipped++; continue; }

  let parser = null;
  try { const h = new URL(w.url).hostname;
        parser = Object.entries(PARSERS).find(([k]) => h.includes(k))?.[1]; } catch(e){}
  if (!parser){ skipped++; continue; }

  try {
    const r = await parser(w.url);
    w.lastChecked = new Date().toISOString().slice(0,10);
    w.needsCheck = false;
    if (r.episodes && r.episodes !== w.episodes){
      console.log(`  ${w.title}: ${w.episodes} → ${r.episodes}`);
      w.episodes = r.episodes; changed++;
    } else {
      console.log(`  ${w.title}: 그대로 (${w.episodes}화)`);
    }
    if (r.finished && w.status !== "완결"){
      w.status = "완결"; changed++;
      console.log(`  ${w.title}: 완결로 바뀜`);
    }
  } catch(e){
    w.needsCheck = true;
    w.lastChecked = new Date().toISOString().slice(0,10);
    failed++; changed++;
    console.log(`  ${w.title}: 실패 (${e.message})`);
  }
  await sleep(1200);   // 너무 빠르게 두드리지 않는다
}

console.log(`\n바뀜 ${changed} · 실패 ${failed} · 건너뜀 ${skipped}`);

if (changed){
  store.updated = new Date().toISOString().slice(0,10);
  await writeFile(FILE, JSON.stringify(store, null, 2) + "\n");
  console.log("파일을 고쳤다");
} else {
  console.log("고칠 게 없다");
}
