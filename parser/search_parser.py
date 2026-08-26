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

    return BeautifulSoup(
        html_content,
        "html.parser"
    )

def get_text_preview(html_content, limit=3000):
    """
    HTML 텍스트 미리보기.
    """

    soup = parse_search_history(html_content)

    text = soup.get_text(
        "\n",
        strip=True
    )

    return text[:limit]