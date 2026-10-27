/* ══════════════════════════════════════════════════════════
   설정 파일 — README 순서대로 따라가면서 여기 세 칸만 채운다.
   비워두면 사이트는 data/site.json 만 읽는 "미리보기 모드"로 돈다.
   ══════════════════════════════════════════════════════════ */

window.CONFIG = {

  /* ① Apps Script 웹 앱 주소 — 드라이브 읽기/올리기/별표/관리자 저장을 전부 여기서 한다.
        예: "https://script.google.com/macros/s/AKfy..../exec" */
  scriptUrl: "",

  /* ② 구글 로그인용 OAuth 클라이언트 ID
        예: "1234567890-abcdefg.apps.googleusercontent.com" */
  googleClientId: "",

  /* ③ 구글 API 키 (Drive API 사용 설정)
        드라이브 mp4 를 <video> 로 직접 틀어서 "끝나면 다음 곡" 이 되게 하는 데 쓴다.
        비워두면 드라이브 영상은 구글 미리보기 창으로만 나오고 자동으로 안 넘어간다. */
  driveApiKey: "",

  /* 한 번에 올릴 수 있는 파일 크기 (MB) — Apps Script 한계 때문에 35 정도가 최대 */
  maxUploadMB: 35,
};
