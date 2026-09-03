# YouTube Me — 구현계획서

> ⚠️ **배포처가 GitHub Pages로 정해지면서 이 문서(Python/Streamlit 기준)는 `youtube-me-github-pages-plan.md`로 대체되었다.** 데이터 스키마·특징 수식 등 로직 참고용으로는 여전히 유효하다.

> 원본 아이디어 문서, 구체화안(v2), `google-timeline-visualizer` 분석(스트리밍 파싱 기법), 그리고 실제 업로드 파일 3종의 검증 결과를 종합해 만든 실행 계획서다. "무엇을 만들지"는 구체화안에서 정했으니, 이 문서는 **어떤 순서로, 어떤 모듈로, 어떤 테스트와 함께 만들 것인가**에 집중한다.

---

## 0. 구현 순서 한눈에

| Phase | 목표 | 산출물 |
|---|---|---|
| 0 | 파서 3종 | `search_history.py`, `watch_history.py`, `subscriptions.py` + 유닛 테스트 |
| 1 | 특징 추출 | `features/` 모듈, 특징 벡터 생성 함수 |
| 2 | 관심사 분류 | YouTube Data API 연동 + 채널 캐시 |
| 3 | 유형 판정 | `typing/rules.py` (규칙 기반, Phase 1 방식) |
| 4 | Streamlit 앱 | 업로드 UI + 결과 화면을 담은 단일 앱 (배포 간소화) |
| 5 | 프라이버시 파이프라인 | 원본 삭제 / TTL 로직 |
| 6 | 베타 준비 | 특징 벡터 수집·저장 스크립트 |

Phase 0~5는 순서대로 의존관계가 있고(파서 없이는 특징 추출 불가, 특징 없이는 유형 판정 불가), Phase 6은 0~5가 끝난 뒤 실사용자 데이터를 모으는 단계다. 데이터 기반 군집화(구체화안 5장의 Phase 2)는 Phase 6 이후 별도 계획으로 다룬다.

---

## 1. 확정된 데이터 스키마

실제 업로드 파일 3종을 검증해 다음이 **확정**되었다 (더 이상 가정이 아니다).

### 1.1 검색_기록.json / 시청_기록.json 공통 원본 구조

```json
{
  "header": "YouTube" | "YouTube Music",
  "title": "{내용} 을(를) 검색했습니다./시청했습니다./확인함",
  "titleUrl": "...search_query=..." | "https://www.youtube.com/watch?v={id}" | ".../post/{id}",
  "subtitles": [{"name": "채널명", "url": ".../channel/{channelId}"}],
  "time": "2026-08-25T08:37:46.881Z",
  "products": ["YouTube"],
  "activityControls": [...]
}
```

검증된 사실:
- `title`의 "을(를)"은 문법적으로 안 맞아도 항상 이 리터럴 그대로 박혀 있다 (검색 기록 8,407건 전량이 `~을(를) 검색했습니다` 패턴과 100% 일치).
- 시청 기록 12,300건 중 **527건은 영상 시청이 아니라 커뮤니티 게시물 조회**다(`titleUrl`이 `/post/...`). title 텍스트가 아니라 `titleUrl`의 URL 패턴으로 구분하는 것이 더 견고하다.
- Shorts는 구조적 필드가 없고 `title`에 `#shorts` 문자열이 있을 때만 식별 가능 (12,300건 중 427건).
- `subtitles`가 없는 레코드가 865건 있는데, 이 중 상당수가 위 커뮤니티 게시물 케이스다. 파서는 `subtitles` 부재를 에러가 아니라 `None`으로 정상 처리해야 한다.

### 1.2 구독정보.csv

**확정**: 컬럼은 정확히 3개, `채널 ID`, `채널 URL`, `채널 제목` 순서이며 **시간 컬럼은 없다**. 구체화안에서 예측했던 대로다. → 구독 시점은 시청 기록에서 해당 채널이 최초 등장한 시점으로 근사한다는 대안을 그대로 채택한다.

### 1.3 내부 정규화 스키마 (파서가 뱉어야 하는 형태)

```python
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

@dataclass
class SearchRecord:
    query: str
    time: datetime
    product: str  # "YouTube" | "YouTube Music"

@dataclass
class WatchRecord:
    video_id: Optional[str]
    title: str
    channel_id: Optional[str]
    channel_name: Optional[str]
    time: datetime
    product: str
    is_short: bool

@dataclass
class CommunityPostRecord:
    post_url: str
    channel_id: Optional[str]
    channel_name: Optional[str]
    time: datetime

@dataclass
class SubscriptionRecord:
    channel_id: str
    channel_url: str
    channel_title: str
```

`WatchRecord`와 `CommunityPostRecord`를 분리한 것이 핵심이다. 커뮤니티 게시물은 버리지 않고 보관하되(추후 "커뮤니티 활동형" 같은 부가 지표로 쓸 여지를 남김), 시청 관련 지표 계산에는 절대 섞이지 않도록 타입 자체를 나눈다.

---

## 2. 프로젝트 구조

```
youtube-me/
├── parser/
│   ├── __init__.py
│   ├── schemas.py          # 위 1.3 dataclass 정의
│   ├── search_history.py
│   ├── watch_history.py
│   └── subscriptions.py
├── features/
│   ├── __init__.py
│   ├── usage.py             # 기초 사용량 지표
│   ├── behavior.py          # 다양성/집중도/신규발견율/버스티니스
│   └── categorize.py        # 관심사 분류 (API + 캐시 + 로컬 키워드)
├── typing_engine/           # 'typing'은 표준 라이브러리와 이름이 겹치므로 회피
│   ├── __init__.py
│   └── rules.py             # Phase 1 규칙 기반 판정
├── app.py                    # Streamlit 메인 엔트리포인트 (업로드 UI + 결과 화면)
├── tests/
│   ├── fixtures/             # 통계치만 반영한 합성 샘플 (실제 개인정보 미포함)
│   └── test_*.py
└── requirements.txt
```

---

## 3. Phase별 상세 작업

### Phase 0 — 파서

**0-1. `search_history.py`**

```python
import re
from urllib.parse import urlparse, parse_qs

SEARCH_SUFFIX = re.compile(r'\s*을\(를\)\s*검색했습니다\.?$')

def extract_query(title: str, title_url: str) -> str:
    m = SEARCH_SUFFIX.sub('', title).strip()
    if m and m != title.strip():
        return m
    # 패턴이 안 맞으면 URL 파라미터로 폴백 (더 견고함)
    qs = parse_qs(urlparse(title_url).query)
    return qs.get('search_query', [''])[0]
```
- 테스트: 실제 파일 기준 8,407건 전량이 정규식 경로로 처리되는지 회귀 테스트. 매치율이 100%에서 떨어지면 Takeout 포맷이 바뀌었다는 신호(구체화안 12장 리스크와 연결)이므로 알림 처리.

**0-2. `watch_history.py`**

```python
def classify_entry(title_url: str) -> str:
    if '/post/' in title_url:
        return 'community_post'
    if 'watch?v=' in title_url or '/shorts/' in title_url:
        return 'video'
    return 'unknown'

def extract_video_id(title_url: str) -> str | None:
    qs = parse_qs(urlparse(title_url).query)
    return qs.get('v', [None])[0]

def extract_channel(subtitles: list | None) -> tuple[str | None, str | None]:
    if not subtitles:
        return None, None
    name = subtitles[0].get('name')
    url = subtitles[0].get('url', '')
    channel_id = url.rstrip('/').rsplit('/', 1)[-1] if '/channel/' in url else None
    return channel_id, name
```
- `is_short`은 `'#shorts' in title` 로 플래그.
- `classify_entry`가 `'community_post'`면 `CommunityPostRecord`로, `'video'`면 `WatchRecord`로 분기.
- 테스트: 커뮤니티 게시물 527건이 정확히 분리되는지, Shorts 427건이 정확히 플래그되는지, `subtitles` 없는 865건에서 예외 없이 `None`이 나오는지.

**0-3. `subscriptions.py`**

```python
import pandas as pd

def parse_subscriptions(path: str) -> list[SubscriptionRecord]:
    df = pd.read_csv(path, header=0)
    df.columns = ['channel_id', 'channel_url', 'channel_title']  # 헤더 텍스트가 아니라 위치 신뢰
    return [SubscriptionRecord(**row) for row in df.to_dict('records')]
```
- 헤더 이름이 로케일에 따라 달라질 수 있으므로(이번 확인에선 한글 헤더였음) 이름 매칭이 아니라 위치 기반으로 강제 고정.

**Exit 기준**: 실제 3개 파일을 넣었을 때 파서가 예외 없이 통과하고, 위에서 언급한 정확한 건수(검색 8,407 / 시청-영상 11,773 / 커뮤니티게시물 527 / Shorts 427 / 구독 448)가 재현되면 Phase 0 완료.

---

### Phase 1 — 특징 추출

구체화안 3장의 수식을 그대로 구현한다. 유일한 추가 규칙: **`CommunityPostRecord`는 어떤 시청 관련 지표 계산에도 포함하지 않는다.**

```python
# features/behavior.py
import numpy as np

def channel_diversity(watch_counts: dict[str, int]) -> float:
    counts = np.array(list(watch_counts.values()))
    p = counts / counts.sum()
    entropy = -(p * np.log2(p)).sum()
    max_entropy = np.log2(len(counts))
    return float(entropy / max_entropy) if max_entropy > 0 else 0.0

def channel_concentration_hhi(watch_counts: dict[str, int]) -> float:
    p = np.array(list(watch_counts.values()))
    p = p / p.sum()
    return float((p ** 2).sum())
```
나머지(신규채널발견율, 반복시청지수, 시간대엔트로피, 주말편중도, 버스티니스, 관심사 다양성/변화율)도 같은 모듈에 함수 단위로 추가.

**참고**: 이번 계정은 시청 기록 기간이 4.5개월뿐이라(검색 기록은 6년치) "관심사 변화율" 지표는 이 계정 데이터만으로는 의미 있게 계산되지 않는다. 함수 자체는 구현하되, 호출부에서 최소 데이터 기간 조건(구체화안 10장)을 체크해 조건 미달 시 `None`을 반환하도록 설계한다.

---

### Phase 2 — 관심사 분류

- `WatchRecord.video_id`를 50개씩 묶어 `videos.list(part=snippet)` 호출.
- 이번 계정 기준 실제 영상 시청은 11,773건 → 11,773 ÷ 50 ≈ **236회 호출**로 전체 카테고리 조회 완료 (일일 쿼터 10,000의 극히 일부).
- `channel_id` 단위 캐시 테이블(초기엔 SQLite 한 테이블로 충분)을 두고, 2단계 LLM 보강 분류는 캐시에 없는 채널만 호출.
- 검색어(`SearchRecord.query`)는 로컬 형태소 분석(Kiwi)으로만 처리, 외부 API로 원문 전송 금지 — 구체화안 4장·6장 원칙 그대로.

---

### Phase 3 — 유형 판정 (규칙 기반)

```python
# typing_engine/rules.py
def assign_type(scores: dict) -> str:
    if scores['channel_diversity'] > THRESH_DIVERSITY_HIGH and scores['new_channel_rate'] > THRESH_NEW_HIGH:
        return 'explorer'      # 🧭 탐험형
    if scores['channel_hhi'] > THRESH_HHI_HIGH and scores['repetition_index'] > THRESH_REPEAT_HIGH:
        return 'immersive'     # 🎯 몰입형
    if scores['burstiness'] > THRESH_BURST_HIGH and scores['baseline_usage'] < THRESH_USAGE_LOW:
        return 'binge'         # 🎉 순간집중형
    return 'balanced'          # 균형형
```

**주의**: `THRESH_*` 값은 지금은 근거 없는 임시값이다. 베타 코호트가 없는 지금 단계에서는 다음 순서로 보정한다:
1. 우선 본인 계정(이번에 검증한 데이터)을 포함해 지인 5~10명 정도의 실제 계산값을 뽑아본다.
2. 그 분포를 보고 상/중/하 백분위 경계를 잡는다(구체화안 5장의 percentile 방식).
3. 30~50명 베타로 확장되면 다시 조정한다.

즉 Phase 3은 "완성"이 아니라 "동작하는 첫 버전"이 목표다.

---

### Phase 4 — Streamlit 앱 (기존 API 서버 계획을 대체)

배포 난이도 때문에 FastAPI + 별도 프론트엔드 대신 **Streamlit 단일 앱**으로 방향을 바꾼다. Phase 0~3(파서·특징추출·관심사분류·유형판정)은 프레임워크와 무관한 순수 Python 함수이므로 그대로 재사용하고, 이 Phase는 그 함수들을 호출하는 화면(UI) 계층만 새로 정의한다.

**바뀌는 것**
- `api/main.py`(FastAPI) 대신 `app.py`(Streamlit) 하나가 업로드~결과 표시까지 전담
- 별도 프론트엔드(Next.js) 없이 `st.file_uploader` / `st.metric` / `st.bar_chart` 등 내장 위젯으로 화면 구성
- 비동기 작업 큐·웹소켓·CORS 설정이 불필요 — 요청부터 렌더링까지 프로세스 하나가 처리

**안 바뀌는 것**
- 파서(Phase 0)·특징 계산(Phase 1)·관심사 분류(Phase 2)·유형 판정(Phase 3)의 로직 자체와 구체화안 8장의 결과 스키마
- 프라이버시 원칙(Phase 5) — 원본을 남기지 않는다는 방침은 UI 프레임워크와 무관하게 동일 적용

**배포**
- Streamlit Community Cloud에 GitHub 저장소만 연결하면 끝 (무료, 별도 서버·도메인·CI 설정 불필요, 푸시하면 자동 재배포)

**트레이드오프**
- 이번에 확인한 파일 크기(수 MB) 기준으로는 동기 처리로 충분하다 — 비동기 큐(구체화안 1장)는 아직 시기상조
- Streamlit은 원본 아이디어 문서 18장의 "공유 이미지·바이럴 루프" 같은 소비자 앱 느낌의 화면을 만들기엔 한계가 있다. Phase 6 베타 테스트 단계엔 적합하지만, 정식 공개 시점엔 프론트엔드를 다시 검토해야 할 수 있다.

---

### Phase 5 — 프라이버시 파이프라인

- 업로드된 원본 3개 파일: 파싱 완료 즉시 삭제.
- `CommunityPostRecord`, `SearchRecord.query` 원문: 특징/카테고리 추출 후 폐기, DB에는 특징 벡터·유형·날짜범위 요약만 저장.
- 구체화안 6장 표를 그대로 체크리스트로 사용.

---

### Phase 6 — 베타 준비

- Phase 0~5로 만든 파이프라인을 지인 30~50명에게 돌려 특징 벡터를 수집.
- 수집된 벡터로 Phase 3의 임시 임계값을 재조정하고, 이후 구체화안 5장의 k-평균/실루엣 스코어 기반 군집화(Phase 2)로 넘어간다. 이 부분은 데이터가 쌓인 뒤 별도 계획서로 다룬다.

---

## 4. 테스트 전략

각 Phase의 "Exit 기준"에 이미 포함시켰지만 정리하면:

| 대상 | 검증 내용 |
|---|---|
| 검색 파서 | 8,407건 중 패턴 매치 회귀 (100% 기준선) |
| 시청 파서 | 커뮤니티 게시물 527건 정확히 분리, Shorts 427건 플래그, `subtitles` 없는 865건 예외 없이 처리 |
| 구독 파서 | 448행, 컬럼 3개, 위치 기반 파싱이 헤더 텍스트와 무관하게 동작 |
| 특징 계산 | 엔트로피/HHI 값이 0~1 범위를 벗어나지 않는지 |
| 관심사 변화율 | 데이터 기간 부족 시 예외 대신 `None` 반환 |

테스트 픽스처는 실제 파일에서 뽑은 **개인 식별 가능한 원문(검색어·영상 제목·채널명)을 그대로 쓰지 않고**, 구조와 건수만 반영한 합성 데이터로 구성한다 — 서비스 자체가 표방하는 "원본 데이터 최소 보관" 원칙을 개발 단계에서도 지킨다.

---

## 5. 남은 결정 사항

- Phase 3 임계값을 몇 명 데이터로 언제 재조정할지 (지금은 "본인+지인 5~10명" 정도로 잠정)
- 커뮤니티 게시물 데이터를 향후 별도 지표로 쓸지, 아예 버릴지
- Phase 2의 LLM 보강 분류를 언제부터 붙일지 (공식 카테고리만으로 첫 버전을 낼지, 처음부터 2단계까지 갈지)

---

## 6. 지금 바로 시작할 것

1. Phase 0 파서 3개 구현 — 스키마가 이미 실데이터로 확정되었으니 바로 착수 가능
2. 파서 결과를 본인 데이터로 직접 돌려보고 위 표의 기준 건수(8,407 / 11,773 / 527 / 427 / 448)가 재현되는지 확인
3. 확인되면 Phase 1(특징 추출)로 진행
