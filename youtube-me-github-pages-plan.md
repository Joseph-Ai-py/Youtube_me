# YouTube Me — YouTube Recap 구현계획서

> Google Takeout 파일을 브라우저에서 직접 분석하는 순수 통계 기반 YouTube Recap 계획서다. GitHub Pages 정적 호스팅을 전제로 하며, 서버·Streamlit·AI·YouTube Data API·외부 전송을 사용하지 않는다.
> 실제 `data/takeout-20260903T105000Z-1-001.zip`과 압축 해제된 `data/Takeout`을 확인해 작성한 순수 통계 기반 YouTube Recap 계획서다. GitHub Pages 정적 호스팅을 전제로 하며, 서버·Streamlit·AI·YouTube Data API·외부 전송을 사용하지 않는다.

---

## 0. 제품 방향

이 프로젝트는 사용자의 시청 기록에서 통계를 계산해 개인별 YouTube Recap을 보여주는 브라우저 앱이다.

### 확정 원칙

- GitHub Pages에 정적 파일로 배포한다.
- JSON 파싱과 모든 통계 계산은 사용자의 브라우저에서 수행한다.
- AI, YouTube Data API, 외부 API, API 키를 사용하지 않는다.
- 원본 JSON과 검색어·시청 기록을 서버로 전송하거나 저장하지 않는다.
- 관심사나 성격을 AI로 분류하지 않고, 확인 가능한 수치와 통계 기반 문구만 사용한다.
- 1차 MVP는 시청 기록 JSON을 중심으로 만들고 검색 기록과 구독 정보는 선택 입력으로 확장한다.

## 1. 실제 데이터 확인 결과

현재 `data` 폴더에는 원본 ZIP과 압축 해제본이 함께 있다. 앱은 사용자가 ZIP을 업로드하면 브라우저에서 필요한 파일을 찾아 읽고, 압축 해제된 파일을 저장소에 포함하지 않는 배포 형태를 기준으로 설계한다.

### MVP에서 읽을 파일

| 파일 | 확인된 규모 | 처리 목적 |
|---|---:|---|
| `시청 기록/시청 기록.json` | 27,200건 | 영상 시청, 커뮤니티 게시물, 시간대·요일·채널 통계 |
| `시청 기록/검색 기록.json` | 8,413건 | 선택 입력, 검색량·검색 기간 통계 |
| `구독정보/구독정보.csv` | 453행, 3열 | 선택 입력, 구독 채널 수 통계 |

### 이번 버전에서 읽지 않을 파일

ZIP 안의 `채널/` CSV 4종과 `music (library and uploads)/music library/songs.csv`는 Recap 핵심 통계에 필요한 데이터가 아니므로 무시한다. 나중에 기능 목적이 명확해질 때 별도 파서로 추가한다.

### 시청 JSON 실측 기준

- 기간: `2026-02-17T00:48:17.814Z` ~ `2026-09-03T10:48:33.172Z`
- 서비스: YouTube 23,765건, YouTube Music 3,435건
- URL 유형: 영상 26,114건, 커뮤니티 게시물 1,075건, URL 미분류 11건
- 제목의 `#shorts` 표식: 872건
- `subtitles` 없음: 2,462건. 오류가 아니라 채널 정보를 알 수 없는 정상 데이터로 처리한다.
- `titleUrl` 없음: 11건. 영상 통계에서 제외하되 전체 기록 수와 별도 누락 수에는 반영한다.

검색 기록은 8,413건이며 기간은 `2020-07-05T13:17:00.254Z` ~ `2026-09-03T08:44:19.026Z`다. 구독 CSV의 헤더는 `채널 ID`, `채널 URL`, `채널 제목`이고 실제 데이터는 453행이다.

## 2. 먼저 짚어야 할 것 — GitHub Pages는 정적 호스팅이다

GitHub Pages는 HTML/CSS/JS **파일만** 서빙한다. Python, Node 서버, DB 서버 어떤 것도 그 위에서 실행되지 않는다. 따라서:

- 파싱·특징계산·리캡 문구 생성을 **전부 브라우저(클라이언트) JS/TS**로 구현해야 한다.
- Python/Streamlit 코드는 실행 경로에서 제외하고, 필요한 데이터 변환 규칙만 참고한다.
- 부수 효과: 사용자의 검색어·시청기록이 **서버로 아예 전송되지 않는다** — 구체화안 6장의 프라이버시 원칙이 아키텍처만으로 상당 부분 저절로 지켜진다.
- 참고할 검증된 모델이 이미 있다: `google-timeline-visualizer`의 `web/` 폴더 (Vite + TypeScript, 파일을 업로드하지 않고 `<input type="file">` → `file.text()` → `JSON.parse()`로 브라우저에서 바로 처리). 우리 구조도 이 패턴을 그대로 따른다.

---

## 3. 기존 설계 검토 — 반영한 것 / 제외한 것

| 기존 제안 | 판단 | 반영 여부 |
|---|---|---|
| `header`가 `products`보다 정확한 서비스 구분 신호 | 우리가 이미 파서에서 `header` 기준으로 구현했던 것과 동일. 이름만 `service`로 명확히 정리 | ✅ 반영 (명칭 정리) |
| 데이터 완전성/신뢰도 점수 (`completeness_score`) | 검색 기간과 시청 기간의 불균형을 사용자에게 투명하게 보여주는 장치 | ✅ 반영 (8장) |
| 장기 탐색(검색) / 최근 소비(시청) 분리 해석 | 같은 이유로 결과 문구를 더 정직하게 만듦 | ✅ 반영 (7장) |
| FastAPI/Celery/SQLite/orjson 스택 | GitHub Pages는 서버가 없으므로 원천적으로 해당 없음 | ❌ 미반영 (아키텍처 전제가 다름) |
| YouTube Data API / LLM 관심사 분류 | API 키와 외부 전송이 필요하고 순수 리캡 방향과 맞지 않음 | ❌ 완전 제외 |
| SHA-256 fingerprint + DB 재파싱 방지 | 서버 저장소가 없으므로 MVP에서 불필요 | ❌ 미반영 |

---

## 4. 확정 스키마

원본 필드 구조는 이전 문서와 동일하다 (실데이터로 검증 완료 상태 유지):

```json
{
  "header": "YouTube" | "YouTube Music",
  "title": "{내용} 을(를) 검색했습니다./시청했습니다./확인함",
  "titleUrl": "...search_query=..." | "watch?v={id}" | "/post/{id}",
  "subtitles": [{"name": "채널명", "url": ".../channel/{channelId}"}],
  "time": "2026-08-25T08:37:46.881Z",
  "products": ["YouTube"]
}
```

**필드 명칭**: 내부 필드명은 `product`가 아니라 **`service`**로 쓰고, 값의 출처는 `header`로 고정한다. `products` 배열은 구분력이 낮으므로 파서에서 참조하지 않는다.

기준 건수(현재 파일 검증 완료, 테스트 기준선으로 사용): 검색 8,413 / 시청-영상 26,114 / 커뮤니티게시물 1,075 / Shorts 표식 872 / 구독 453.

---

## 5. 파일 구조

```
youtube-me/
├── index.html
├── package.json
  ├── vite.config.ts              # base 경로 설정 필수 (10장 참고)
├── tsconfig.json
├── .github/
│   └── workflows/
│       └── deploy.yml          # push → build → gh-pages 자동 배포
└── src/
    ├── main.ts                  # 엔트리포인트: 업로드 이벤트 바인딩, 전체 흐름 조립
    ├── style.css
    ├── types.ts                 # SearchRecord/WatchRecord/CommunityPostRecord/SubscriptionRecord/ConfidenceScore
    ├── parsers/
    │   ├── searchHistory.ts     # 검색_기록.json → SearchRecord[]
    │   ├── watchHistory.ts      # 시청_기록.json → (WatchRecord[], CommunityPostRecord[])
    │   └── subscriptions.ts     # 구독정보.csv → SubscriptionRecord[]
    ├── features/
    │   ├── usage.ts             # 기초 사용량 (건수, 활동일수, 기간)
    │   └── behavior.ts          # 다양성/HHI/신규발견율/반복시청/주말편중도
    ├── quality/
    │   └── confidence.ts        # 데이터 완전성 점수 (8장)
    └── ui/
      └── render.ts            # 리캡 결과 화면 DOM 렌더링
```

    유형 판정 폴더는 만들지 않는다. 통계 결과를 성격 유형으로 단정하지 않고 리캡 카드와 설명 문구로 보여준다.

---

## 6. 파일별 책임과 인터페이스

### `src/types.ts`
```typescript
export interface SearchRecord {
  query: string;
  time: Date;
  service: 'YouTube' | 'YouTube Music';
}

export interface WatchRecord {
  videoId: string | null;
  title: string;
  channelId: string | null;
  channelName: string | null;
  time: Date;
  service: 'YouTube' | 'YouTube Music';
  isShort: boolean;
}

export interface CommunityPostRecord {
  postUrl: string;
  channelId: string | null;
  channelName: string | null;
  time: Date;
}

export interface SubscriptionRecord {
  channelId: string;
  channelUrl: string;
  channelTitle: string;
}

export interface ConfidenceScore {
  searchCoverage: number;       // 검색 기록 기간의 신�, 절대적 척도는 5장 참고
  watchCoverage: number;        // 시청 기록 기간 vs 검색 기록 기간 비율
  watchChannelCoverage: number; // channelId 있는 시청 비율
  subscriptionCoverage: number; // 구독정보 존재 여부 (0 or 1)
  overallConfidence: number;
}
```

### `src/parsers/searchHistory.ts`
Python 버전과 동일 로직(고정 접미사 제거 → 실패시 URL 파라미터 폴백):
```typescript
const SEARCH_SUFFIX = / 을\(를\) 검색했습니다\.?$/;

export function parseSearchHistory(raw: any[]): SearchRecord[] {
  return raw.flatMap((entry) => {
    if (!entry.time || !entry.title) return [];
    const stripped = entry.title.replace(SEARCH_SUFFIX, '').trim();
    const query = stripped !== entry.title.trim()
      ? stripped
      : new URL(entry.titleUrl ?? '', location.href).searchParams.get('search_query') ?? '';
    if (!query) return [];
    return [{ query, time: new Date(entry.time), service: entry.header ?? 'YouTube' }];
  });
}
```
- 검증 기준: 8,407건 중 접미사 제거 경로로 처리되는 비율이 100%에서 떨어지면 Takeout 포맷 변경 신호.

### `src/parsers/watchHistory.ts`
- `titleUrl`에 `/post/` 포함 → `CommunityPostRecord`로 분리 (1,075건 기준)
- `watch?v=` 또는 `/shorts/` 포함 → `WatchRecord`, `title`에 `#shorts` 포함 여부로 `isShort` 플래그 (872건 기준)
- `titleUrl`이 없는 11건은 미분류 기록으로 보존하되 영상 통계에서는 제외한다.
- `subtitles[0]` 없으면 `channelId`/`channelName`은 `null` (2,462건 발생 확인됨 — 에러 아님)

### `src/parsers/subscriptions.ts`
- CSV는 `csv-parse` 또는 자체 split 로직으로 처리. **헤더 텍스트가 아니라 열 위치(0/1/2)로 매핑** — 로케일에 따라 헤더가 한글일 수 있음(실측: `채널 ID,채널 URL,채널 제목`).
- 시간 컬럼 없음 확정 — `SubscriptionRecord`에 시간 필드 자체가 없다.

### `src/features/behavior.ts`
구체화안 3장 수식 그대로: 정규화 섀넌 엔트로피(다양성), HHI(집중도), 신규채널발견율, 반복시청지수, 주말편중도. Python 버전에서 실제 검증된 값(다양성 0.87 / 신규발견율 32% / 반복시청 61%)을 회귀 테스트 기준값으로 재사용 가능.

### `src/ui/render.ts`
- 계산된 통계만 받아 리캡 화면을 렌더링한다.
- 총 시청 수, 가장 많이 본 채널, 가장 많이 활동한 요일·시간대, 신규 채널 비율, 반복 시청 비율, 채널 다양성, 커뮤니티 게시물 수를 표시한다.
- 관심사나 성격을 추측하는 문구 대신 기록에서 확인된 패턴으로 표현한다.
- 데이터가 부족한 지표는 0으로 꾸미지 않고 `데이터 부족`으로 표시한다.

---

## 7. 외부 서비스와 AI 제외

아래 표는 이전 방향을 검토했던 기록이며 현재 구현 대상이 아니다. 현재 결정은 AI와 모든 외부 API를 사용하지 않는 것이다.

서버가 없으므로 YouTube Data API를 브라우저에서 직접 호출해야 하는데, API 키가 클라이언트 코드/네트워크 요청에 그대로 노출된다. 선택지 3가지:

| 방식 | 설명 | 트레이드오프 |
|---|---|---|
| A. 이번 버전에서 제외 | 로컬 키워드 규칙만으로 관심사 추정, API 미사용 | 가장 단순하지만 카테고리 정확도 낮음 |
| B. Referrer 제한 키 | Google Cloud Console에서 API 키를 자기 github.io 도메인으로 제한 | 키는 보이지만 다른 도메인에서 도용 불가 — 실무에서 흔히 쓰는 절충안 |
| C. 얇은 프록시 함수 | Cloudflare Workers 등 무료 서버리스 함수 하나만 추가해 키를 서버 쪽에 숨김 | GitHub Pages의 "서버 없음" 원칙이 부분적으로 깨짐, 대신 안전 |

이 프로젝트에는 관심사 분류 Phase를 두지 않는다.

- YouTube Data API를 호출하지 않는다.
- API 키, 서버리스 프록시, LLM, 외부 형태소 분석 서비스를 사용하지 않는다.
- 영상 제목이나 채널명으로 관심사를 추정하거나 분류하지 않는다.
- 분석 가능한 정보는 JSON에 실제로 들어 있는 값과 그 값을 이용한 산술 통계로 제한한다.
- 향후 외부 서비스 연동은 별도 제품 결정 없이는 도입하지 않는다.

---

## 8. 데이터 완전성 점수

실측 데이터가 보여준 기간 차이 — 검색은 2020-07-05부터, 시청은 2026-02-17부터 — 를 숨기지 않고 점수와 안내 문구로 노출한다. 두 기록은 같은 기간을 측정하지 않으므로 검색과 시청을 하나의 활동량으로 단순 합산하지 않는다.

```typescript
// quality/confidence.ts (개념적 스케치, 실제 계산식은 구현 시 확정)
export function computeConfidence(
  searches: SearchRecord[],
  watches: WatchRecord[],
): ConfidenceScore {
  // watchCoverage = 시청 기록 기간(일) / 검색 기록 기간(일), 1로 클램프
  // watchChannelCoverage = channelId 있는 시청 수 / 전체 시청 수
  // overallConfidence = 위 항목들의 가중 평균
}
```

결과 화면에는 기간 차이를 숨기지 않는 안내 문구를 노출한다:
> "검색 기록은 충분하지만 시청 기록은 최근 4개월 위주라, 최근 성향 해석의 비중이 높습니다."

---

## 9. 결과 해석 — 장기 탐색과 최근 소비 분리

기존엔 검색·시청·구독을 동등하게 합쳐서 하나의 유형만 냈는데, 실측 데이터의 기간 불균형을 고려하면 이렇게 2층으로 나누는 게 더 정직하다.

- **장기 탐색 성향** — 검색 기록(6년치) 기반, 안정적
- **최근 소비 성향** — 시청 기록(약 6.5개월치) 기반, 최근 편향 명시
- **지속 관심** — 구독 기반 (시간 정보 없음, 현재 스냅샷)

결과 문구 예시: "장기적으로는 다양한 주제를 탐색해온 편이지만, 최근 시청은 특정 채널에 더 집중되는 패턴입니다."

---

## 8. GitHub Pages 배포 설정

**`vite.config.ts`** — 프로젝트 사이트(`username.github.io/repo명/`)로 배포하면 base 경로를 반드시 맞춰야 자산 경로가 깨지지 않는다:
```typescript
export default defineConfig({
  base: '/Youtube_me/', // 저장소 이름과 동일하게
});
```

**`.github/workflows/deploy.yml`** — push할 때마다 자동 빌드·배포:
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```
설정 후 저장소 Settings → Pages에서 소스를 `gh-pages` 브랜치로 지정하면 끝. 별도 서버·도메인 비용 없음.

---

## 11. 구현 체크리스트

- [x] 데이터 스키마 확정 (2장) — 실데이터로 검증 완료, 추가 확인 불필요
- [x] 파일 구조 확정 (3장) — 이 트리 그대로 스캐폴딩하면 됨
- [x] 파싱 핵심 로직 (4장) — 정규식/URL 파싱 규칙은 실데이터 기준 100% 검증됨
- [x] 특징 계산 수식 — 구체화안 3장 + Python 버전에서 나온 실제 검증값 존재
- [ ] confidence 계산식의 정확한 가중치 (8장) — 개념만 정의, 수치는 구현하며 조정

구현은 4장의 스키마와 6~9장의 로직을 기준으로 진행한다.

---

## 12. 남은 결정 사항

- 재방문 시 재업로드를 피하기 위한 IndexedDB 캐싱 도입 여부 (MVP는 세션 내 메모리 처리로 충분, 필요해지면 추가)
- 커뮤니티 게시물(1,075건)을 별도 활동 통계로 표시할지
