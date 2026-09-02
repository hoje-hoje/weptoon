/* ══════════════════════════════════════════════════════════
   설정 파일 — 여기 세 군데만 채우면 된다.
   ══════════════════════════════════════════════════════════ */

window.CONFIG = {

  /* ① 리포지토리 정보 — 관리자 페이지가 여기에 커밋한다 */
  repo: {
    owner:  "여기에-깃허브아이디",     // 예: "hyoje"
    name:   "webtoon-stars",          // 리포지토리 이름
    branch: "main",
  },

  /* ② 관리자 — 이름과 색깔 */
  admins: [
    { id: "HJ", name: "HJ", color: "#f5b93a" },
    { id: "ys", name: "ys", color: "#6ee7b7" },
    { id: "sj", name: "sj", color: "#93c5fd" },
  ],

  /* ③ Supabase — 댓글과 즐겨찾기용.
        비워두면 즐겨찾기는 이 기기에만 저장되고 댓글은 읽기 전용이 된다.
        나중에 채워 넣어도 된다. */
  supabase: {
    url:     "",   // 예: "https://abcdefgh.supabase.co"
    anonKey: "",   // 예: "eyJhbGciOi..."
  },

  /* 분류 — 나중에 늘리고 싶으면 여기만 고친다 */
  genres:    ["판타지", "스릴러", "로맨스", "일상", "등등"],
  platforms: {
    "네이버": { color: "#00c73c", host: "comic.naver.com" },
    "카카오": { color: "#f0b90b", host: "webtoon.kakao.com" },
    "레진":   { color: "#8b7cf6", host: "lezhin.com" },
    "탑툰":   { color: "#ff5c7a", host: "toptoon.com" },
    "기타":   { color: "#9a94a8", host: "" },
  },

  /* 신작 기준 — 며칠 이내에 시작한 작품을 신작으로 볼지 */
  newDays: 183,
};
