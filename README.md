# 웹툰 별점표

HJ · ys · sj 가 웹툰을 보고 매긴 별점과 품평을 올리는 사이트.
서버 없이 GitHub Pages 위에서만 돈다.

```
index.html                     보는 사람용
admin.html                     관리자용
config.js                      ← 여기 세 군데만 채우면 된다
data/webtoons.json             데이터 (DB 대신)
covers/                        표지 이미지
scripts/update-episodes.mjs    주간 화수 확인
.github/workflows/weekly.yml   매주 일요일 새벽에 위 스크립트 실행
```

---

## 1. 리포지토리 만들기

GitHub에서 새 리포지토리를 만든다. 이름은 `webtoon-stars` 정도.
**Public**으로 만든다 (Pages를 무료로 쓰려면 공개여야 한다).

`Add file → Upload files`로 이 폴더의 파일을 전부 올린다.

> `.github` 폴더는 점으로 시작해서 파일 탐색기에서 숨겨져 있을 수 있다.
> 안 올라가면 GitHub에서 `Add file → Create new file`을 누르고
> 파일 이름에 `.github/workflows/weekly.yml` 을 그대로 치면 폴더가 같이 만들어진다.
> 내용은 zip 안의 같은 파일에서 복사해 붙여넣는다.

## 2. config.js 채우기

GitHub에서 `config.js`를 열고 연필 아이콘을 눌러 고친다.

```js
repo: {
  owner:  "내-깃허브-아이디",
  name:   "webtoon-stars",
  branch: "main",
},
```

`admins`는 이미 HJ · ys · sj로 들어가 있다. 색깔은 마음에 안 들면 바꾸면 된다.
`supabase`는 5번에서 채운다. 지금은 비워둬도 사이트는 돈다.

## 3. Pages 켜기

`Settings → Pages → Source`를 **Deploy from a branch**로,
브랜치는 `main`, 폴더는 `/ (root)`로 두고 저장.

1~2분 뒤 `https://내-아이디.github.io/webtoon-stars/` 로 들어가면 사이트가 뜬다.
지금은 표지가 없어서 색깔 판으로 나오는데 정상이다.

## 4. 관리자 토큰 만들기

`Settings → Developer settings → Personal access tokens → Fine-grained tokens`
→ **Generate new token**

- Repository access: **Only select repositories** → 이 리포지토리
- Permissions → Repository permissions → **Contents: Read and write**
- 만료일은 길게 (1년)

만든 토큰을 복사해서 `.../admin.html`에 들어가 이름을 고르고 붙여넣으면 끝난다.
토큰은 그 브라우저에만 저장된다.

**ys와 sj도 각자 자기 토큰이 필요하다.**
`Settings → Collaborators`에서 두 사람을 초대하면, 각자 위와 같은 방법으로
자기 토큰을 만들어 자기 이름으로 로그인하면 된다. 커밋도 각자 이름으로 남는다.

## 5. Supabase 붙이기 — 댓글과 즐겨찾기

이걸 안 해도 사이트는 돈다. 다만 댓글이 안 되고 즐겨찾기가 기기별로만 저장된다.

1. [supabase.com](https://supabase.com)에서 무료로 프로젝트를 만든다.
2. 왼쪽 **SQL Editor**에 아래를 붙여넣고 Run.

```sql
create table comments (
  id         bigint generated always as identity primary key,
  webtoon_id text        not null,
  user_id    uuid        not null,
  user_name  text        not null,
  body       text        not null,
  created_at timestamptz default now()
);

create table favorites (
  user_id    uuid not null,
  webtoon_id text not null,
  primary key (user_id, webtoon_id)
);

alter table comments  enable row level security;
alter table favorites enable row level security;

-- 댓글: 누구나 읽고, 로그인한 사람은 자기 이름으로 쓰고, 자기 것만 지운다
create policy "댓글 읽기"  on comments for select using (true);
create policy "댓글 쓰기"  on comments for insert
  to authenticated with check (auth.uid() = user_id);
create policy "댓글 지우기" on comments for delete
  to authenticated using (auth.uid() = user_id);

-- 즐겨찾기: 자기 것만 보고 자기 것만 고친다
create policy "즐겨찾기" on favorites for all
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

3. **Authentication → Sign In / Providers → Google**을 켠다.
   Google Cloud Console에서 OAuth 클라이언트를 만들고,
   승인된 리디렉션 URI에 Supabase가 알려주는 콜백 주소를 넣는다.
4. **Authentication → URL Configuration**의 Site URL에
   `https://내-아이디.github.io/webtoon-stars/` 를 넣는다.
5. **Project Settings → API**에서 `Project URL`과 `anon public` 키를 복사해
   `config.js`의 `supabase`에 넣는다.

anon 키는 공개돼도 되는 키다. 위의 정책이 실제 권한을 막아준다.

## 6. 주간 화수 갱신 켜기

`Actions` 탭에 들어가 초록 버튼을 눌러 워크플로를 활성화한다.
매주 일요일 새벽 4시(한국시간)에 돌면서, 관리자 화면에서 **자동 갱신**을 켜고
주소를 넣어둔 작품의 화수를 확인한다.

바로 시험해보려면 `Actions → 주간 화수 갱신 → Run workflow`를 누른다.

**지금은 네이버웹툰만 읽는다.** 카카오·레진·탑툰은 자바스크립트로 그려서
이 방식으로는 안 읽힌다. 필요하면 `scripts/update-episodes.mjs`의
`PARSERS`에 함수를 하나 더 붙이면 된다.

휴재하면 화수가 그냥 안 늘어난다. 읽기에 실패하면 `needsCheck`가 켜지고,
관리자 화면 아래에 "확인 실패"로 뜬다.

네이버 쪽 주소는 공식 API가 아니라 언젠가 바뀔 수 있다.
바뀌면 화수가 안 늘고 확인 실패로만 표시되니, 데이터가 깨지지는 않는다.

---

## 쓰는 법

**품평 쓰기** — `admin.html`에서 왼쪽 목록에서 작품을 고르거나 `＋ 새 웹툰 추가`.
링크를 넣고 불러오기를 누르면 제목과 표지를 채워준다. 안 되면 위 세그먼트를
`직접 입력`으로 바꾸고 다 손으로 넣으면 된다.

**스포일러** — 가릴 부분을 드래그하면 위 버튼이 켜진다. 누르거나 `Ctrl+H`.
`||이렇게||` 감싸지고, 아래 미리보기에 뷰어가 볼 모습이 바로 나온다.

**한 작품에 여러 명** — 같은 작품을 ys도 열어서 자기 별점을 쓰면
품평이 두 개 붙고, 홈에는 평균이 뜬다.

**저장** — `저장하고 커밋`을 누르면 리포지토리에 커밋이 올라가고
1분쯤 뒤 사이트에 반영된다. 잘못 올렸으면 GitHub의 커밋 기록에서 되돌리면 된다.
