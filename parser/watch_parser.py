import json

from bs4 import BeautifulSoup

def inspect_watch_history(html_content):
    """
    Google Takeout 시청 기록 HTML의 구조를 확인한다.
    """
    return BeautifulSoup(
        html_content,
        "html.parser"
    )


def get_text_preview(html_content, limit=5000):
    """
    시청 기록 HTML에서 텍스트를 추출한다.
    """
    soup = inspect_watch_history(html_content)

    text = soup.get_text(
        "\n",
        strip=True
    )

    return text[:limit]

def parse_watch_history(html_content):
    """
    Google Takeout YouTube 시청 기록을 파싱한다.
    """

    soup = BeautifulSoup(
        html_content,
        "html.parser"
    )

    results = []

    records = soup.select(
        "div.outer-cell"
    )

    for record in records:

        header = record.select_one(
            ".header-cell .mdl-typography--title"
        )

        content = record.select_one(
            ".content-cell.mdl-typography--body-1"
        )

        if not header or not content:
            continue

        product = header.get_text(
            strip=True
        )

        links = content.find_all("a")

        if not links:
            continue

        # 첫 번째 링크 = 영상/게시물
        title = links[0].get_text(
            strip=True
        )

        url = links[0].get(
            "href"
        )

        # 두 번째 링크가 있으면 채널
        channel = None

        if len(links) >= 2:
            channel = links[1].get_text(
                strip=True
            )

        # 줄 단위 텍스트
        lines = [
            line.strip()
            for line in content.get_text(
                "\n",
                strip=True
            ).split("\n")
            if line.strip()
        ]

        timestamp = None

        # 일반적인 구조:
        # 제목
        # 을(를) 시청했습니다.
        # 채널
        # 시간
        for line in lines:

            if "시청했습니다." in line:
                index = lines.index(line)

                if index + 1 < len(lines):

                    # 다음 줄이 채널이면
                    # 그 다음 줄이 시간
                    if index + 2 < len(lines):
                        timestamp = lines[index + 2]
                    else:
                        timestamp = lines[index + 1]

                break

        if not timestamp:
            continue

        results.append(
            {
                "title": title,
                "channel": channel,
                "url": url,
                "timestamp": timestamp,
                "product": product,
            }
        )

    return results


def parse_watch_history_json(json_content):
    """Google Takeout의 ``watch-history.json``을 분석용 행 목록으로 변환한다."""
    if isinstance(json_content, bytes):
        json_content = json_content.decode("utf-8-sig")

    data = json.loads(json_content)

    if isinstance(data, dict):
        data = data.get("watchHistory", data.get("items", []))

    if not isinstance(data, list):
        raise ValueError("JSON 최상위 값은 시청 기록 배열이어야 합니다.")

    results = []

    for item in data:
        if not isinstance(item, dict) or not item.get("time"):
            continue

        title = item.get("title", "")
        for prefix in ("Watched ", "시청함 ", "시청한 동영상 "):
            if title.startswith(prefix):
                title = title[len(prefix):]
                break

        subtitles = item.get("subtitles") or []
        channel = subtitles[0].get("name") if subtitles and isinstance(subtitles[0], dict) else None

        results.append(
            {
                "title": title,
                "channel": channel,
                "url": item.get("titleUrl"),
                "timestamp": item["time"],
                "product": item.get("header", "YouTube"),
            }
        )

    return results