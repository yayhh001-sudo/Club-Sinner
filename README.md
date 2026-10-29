# VELVET — 가상 호스트바 웹사이트

블랙·버건디·골드 디자인의 Cloudflare Pages + Pages Functions + D1 프로젝트입니다.

## 포함 기능
- 관리자 전용 호스트 등록
- 월간 활동 포인트 랭킹
- 오늘 출근부 상태 변경
- 공지사항 등록
- 공지별 댓글
- 공개 방명록
- 관리자 포인트 지급/차감
- 관리자 세션 쿠키(HTTP-only, Secure, SameSite=Strict, 8시간 만료)

## 배포 전 알아둘 점
- 공개 방문자는 댓글과 방명록을 작성할 수 있습니다. 현재 기본 버전에는 CAPTCHA, IP 기반 속도 제한, 댓글/방명록 삭제 도구가 없습니다. 공개 운영 전에는 스팸 방지와 관리자 삭제 기능을 추가하는 것을 권장합니다.
- 관리자 비밀번호는 코드에 쓰지 않습니다. Cloudflare Pages의 환경 변수에 `ADMIN_PASSWORD`와 `ADMIN_SESSION_SECRET`을 비밀값으로 등록해야 합니다.
- `ADMIN_SESSION_SECRET`은 길고 임의적인 문자열을 사용하세요.
- 이 프로젝트는 정적 파일 + Pages Functions를 사용합니다. 배포할 때 GitHub 연결 또는 Wrangler CLI 중 하나를 선택하면 됩니다.
- `wrangler.toml`의 `database_id`는 본인이 생성한 D1 데이터베이스 ID로 바꿔야 합니다.

## 방법 A: 브라우저에서 배포하기 (초보자 권장)

### 1. Cloudflare 계정과 GitHub 준비
1. Cloudflare 계정에 로그인합니다.
2. GitHub 계정이 없다면 GitHub에 가입합니다.
3. 이 프로젝트 파일을 새 GitHub 저장소에 업로드합니다.

### 2. D1 데이터베이스 생성
Cloudflare 대시보드에서 **Storage & databases → D1 SQL Database**로 이동해 `velvet-hostclub-db`를 만듭니다.
생성 후 데이터베이스 ID를 복사합니다.

### 3. 데이터베이스 테이블 만들기
D1 데이터베이스의 Console/Query 화면에서 `schema.sql` 전체 내용을 실행합니다.

### 4. Pages 프로젝트 만들기
1. Cloudflare 대시보드에서 **Workers & Pages → Create → Pages → Connect to Git**으로 이동합니다.
2. 방금 만든 GitHub 저장소를 선택합니다.
3. Build command는 비워두고, Build output directory에는 `.`을 입력합니다. (대시보드에서 빈 값이 허용되면 빈 값도 가능)
4. 배포합니다.

### 5. D1 바인딩 연결
Pages 프로젝트 → **Settings → Functions → D1 database bindings**에서 다음을 설정합니다.
- Variable name: `DB`
- D1 database: `velvet-hostclub-db`
저장한 뒤 새 배포를 합니다.

### 6. 관리자 비밀값 등록
Pages 프로젝트 → **Settings → Variables and Secrets**에서 Production 환경에 다음 변수를 추가합니다.
- `ADMIN_PASSWORD`: 관리자 로그인 비밀번호
- `ADMIN_SESSION_SECRET`: 충분히 긴 임의의 비밀 문자열 (예: 비밀번호 관리자에서 생성한 40자 이상 랜덤값)

두 값은 일반 텍스트 변수보다 **Secret**으로 등록하세요. 환경 변수 변경 후 새 배포가 필요할 수 있습니다.
Preview 환경에서도 시험하려면 Preview에도 별도로 설정하세요.

### 7. 접속 및 확인
배포 주소(예: `https://프로젝트이름.pages.dev`)를 엽니다.
- ADMIN 버튼 → `ADMIN_PASSWORD`로 로그인
- 호스트 등록 후 프로필과 랭킹을 확인
- 공지 작성, 출근부 변경, 포인트 지급을 시험
- 공개 화면에서 댓글과 방명록 작성 확인

## 방법 B: 터미널에서 배포하기

Wrangler CLI가 설치된 컴퓨터와 Node.js가 필요합니다.

1. `wrangler.toml`의 `database_id`를 실제 ID로 교체합니다.
2. D1 생성:
   ```bash
   npx wrangler d1 create velvet-hostclub-db
   ```
   출력된 ID를 `wrangler.toml`에 붙여넣습니다.
3. 스키마 적용:
   ```bash
   npx wrangler d1 execute velvet-hostclub-db --remote --file=./schema.sql
   ```
4. GitHub 연결 Pages 배포를 사용하거나 Wrangler CLI를 설정해 Pages 프로젝트를 배포합니다. 환경 변수는 Cloudflare 대시보드의 Variables and Secrets에 등록합니다.

## 구조
- `index.html` — 화면 구성
- `styles.css` — 디자인
- `app.js` — 화면과 API 연결
- `functions/api/[[path]].js` — 서버 API
- `schema.sql` — D1 테이블
- `wrangler.toml` — Cloudflare 설정

## 현재 범위와 다음 개선 권장
1. 게시글/댓글/방명록 삭제 및 수정 기능
2. 공개 글쓰기 CAPTCHA와 요청 속도 제한
3. 호스트 이미지 업로드(R2) — 현재는 이미지 URL 입력 방식
4. 관리자 비밀번호 변경/재설정 절차
5. 댓글·방명록 신고/숨김 처리
6. 포인트 내역 상세 화면 및 기간별 랭킹
7. 관리자 작업 감사 로그
