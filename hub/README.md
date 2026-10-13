# HYOJE HUB

`index.html` 하나에 모든 앱이 들어 있는 개인 허브.
`sw.js`, `manifest.webmanifest`, `icon.svg`는 **링크(https)로 열 때** 오프라인 실행과 "앱으로 설치"를 위한 파일이라 같은 폴더에 같이 올려야 한다.

## 링크로 쓰기 (주소에 github 안 들어가게)

GitHub 저장소는 그대로 두고, 무료 호스팅이 이 `hub` 폴더를 가져가게 연결한다.

### Cloudflare Pages → `https://이름.pages.dev`
1. dash.cloudflare.com 가입 → Workers & Pages → Create → Pages → Connect to Git
2. 이 저장소 선택, 브랜치 `main`
3. Build command: 비워 둠 / Build output directory: `hub`
4. 프로젝트 이름을 `hyoje` 처럼 정하면 주소가 `https://hyoje.pages.dev`

### Netlify → `https://이름.netlify.app`
1. app.netlify.com → Add new site → Import from Git → 이 저장소
2. Base directory: `hub`, Publish directory: `hub`, Build command 비워 둠
3. Site settings → Change site name → `hyoje` → `https://hyoje.netlify.app`

### 내 도메인 (예: `hyoje.kr`)
도메인을 사서(1년 1~2만 원) 위 서비스의 Custom domain에 연결하면 된다.

이후로는 `main`에 올리기만 하면 링크도 자동으로 새 버전이 된다.

## 데이터
웹툰·음악·배경·링크 앱 같은 내용은 서버가 아니라 **그 브라우저 안**(IndexedDB/localStorage)에 저장된다.
- 같은 주소·같은 브라우저면 껐다 켜도, 와이파이가 끊겨도 그대로 남는다.
- 주소가 바뀌면(파일 → 링크, a.pages.dev → b.netlify.app) 브라우저는 다른 사이트로 보기 때문에 새로 넣어야 한다.
