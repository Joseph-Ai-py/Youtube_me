# YouTube Me

Google Takeout의 YouTube 데이터를 브라우저에서 분석해 나만의 **YouTube Recap**을 만드는 정적 웹 앱입니다.

## 주요 특징

- Google Takeout ZIP 파일 하나만 업로드
- ZIP 내부에서 시청 기록, 검색 기록, 구독 정보를 자동 탐색
- 시청 기록은 브라우저 안에서만 처리
- YouTube 시청과 YouTube Music 감상을 별도로 집계
- AI, YouTube Data API, 외부 API, API 키를 사용하지 않음
- 원본 데이터가 서버로 전송되거나 저장되지 않음

## 제공하는 리캡

### YouTube 시청

- 총 시청 기록과 커뮤니티 게시물 수
- 가장 많이 본 채널
- 가장 활발했던 요일과 시간대
- 활동한 날짜 수와 하루 평균 시청 수
- 주말 시청 비율
- 반복해서 본 영상 TOP 5
- 새 채널 발견 비율
- 채널 다양성
- Shorts 기록 수
- 가장 최근에 본 영상

### YouTube Music

- 전체 음악 감상 수
- 가장 많이 들은 음악
- 아티스트 또는 채널명
- YouTube와 YouTube Music 사용량 비교

### 검색 기록

- 검색 기록 수
- 많이 검색한 검색어 TOP 5

## 사용 방법

1. Google Takeout에서 YouTube 데이터를 ZIP으로 다운로드합니다.
2. 개발 서버를 실행합니다.
3. 화면에서 ZIP 파일을 선택합니다.
4. 시청 기록과 검색 기록이 자동으로 분석됩니다.

Google Takeout ZIP 안에 다음 파일이 있으면 사용할 수 있습니다.

```text
Takeout/
└── YouTube 및 YouTube Music/
    ├── 시청 기록/
    │   ├── 시청 기록.json
    │   └── 검색 기록.json
    └── 구독정보/
        └── 구독정보.csv
```

## 실행

Node.js 20 이상이 필요합니다.

```bash
npm install
npm run dev
```

개발 서버 주소:

```text
http://localhost:5173/Youtube_me/
```

프로덕션 빌드:

```bash
npm run build
```

## 배포

GitHub Actions가 `main` 브랜치에 push될 때마다 Vite를 빌드하고 GitHub Pages에 자동 배포합니다.

1. 변경 사항을 GitHub 저장소의 `main` 브랜치에 push합니다.

```bash
git add .
git commit -m "Deploy YouTube Recap"
git push origin main
```

2. GitHub 저장소에서 `Settings` → `Pages`로 이동합니다.
3. `Build and deployment`의 `Source`를 `GitHub Actions`로 선택합니다.
4. `Actions` 탭에서 `Deploy to GitHub Pages` workflow가 성공할 때까지 기다립니다.
5. 배포가 완료되면 다음 주소에서 앱을 확인합니다.

```text
https://joseph-ai-py.github.io/Youtube_me/
```

프로젝트 사이트 경로를 위해 `vite.config.ts`의 base 경로는 `/Youtube_me/`로 설정되어 있습니다. Google Takeout ZIP과 압축 해제된 원본 데이터는 `.gitignore`에 등록되어 GitHub에 올라가지 않습니다.

## 개인정보 보호

JSON과 CSV 원본은 업로드 후 브라우저 메모리 안에서만 사용합니다. 분석 결과도 서버로 전송하지 않습니다. 파일을 새로 선택하거나 페이지를 닫으면 분석 데이터는 유지되지 않습니다.