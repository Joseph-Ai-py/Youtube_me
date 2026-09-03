from bs4 import BeautifulSoup


def inspect_search_history(html_content):
    """
    검색 기록 HTML의 구조를 확인하기 위한 함수.
    """

    soup = BeautifulSoup(
        html_content,
        "html.parser"
    )

    return soup

def get_text_preview(html_content, limit=3000):
    """
    HTML에서 텍스트를 추출하여
    Parser 개발에 사용할 미리보기 데이터를 반환한다.
    """

    soup = BeautifulSoup(
        html_content,
        "html.parser"
    )

    text = soup.get_text(
        "\n",
        strip=True
    )

    return text[:limit]

def parse_search_history(html_content):
    """
    검색 기록 HTML을 BeautifulSoup 객체로 변환한다.
    """

    soup = BeautifulSoup(
        html_content,
        "html.parser"
    )

    results = []

    # 검색 기록 하나하나를 찾는다.
    records = soup.select(
        "div.outer-cell"
    )

    for record in records:

        # YouTube / YouTube Music
        header = record.select_one(
            ".header-cell .mdl-typography--title"
        )

        # 검색어 + 시간
        content = record.select_one(
            ".content-cell.mdl-typography--body-1"
        )

        if not header or not content:
            continue

        # 제품명
        product = header.get_text(
            strip=True
        )

        # 검색어
        link = content.find("a")

        if not link:
            continue

        query = link.get_text(
            strip=True
        )

        # 시간
        text = content.get_text(
            "\n",
            strip=True
        )

        lines = [
            line.strip()
            for line in text.split("\n")
            if line.strip()
        ]

        timestamp = None

        for line in lines:

            if "검색했습니다." not in line:
                continue

            index = lines.index(line)

            if index + 1 < len(lines):
                timestamp = lines[index + 1]

            break

        if not timestamp:
            continue

        results.append(
            {
                "query": query,
                "timestamp": timestamp,
                "product": product,
            }
        )

    return results

def get_html_preview(html_content, limit=10000):
    """
    검색 기록 HTML 원본을 일부 확인한다.
    """
    return html_content.decode(
        "utf-8",
        errors="replace"
    )[:limit]