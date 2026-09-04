def find_youtube_files(file_paths):
    """
    Google Takeout ZIP 내부에서
    YouTube 분석에 필요한 파일을 찾는다.
    """

    result = {
        "search": None,
        "watch": None,
        "subscriptions": None,
    }

    for path in file_paths:

        if path.endswith("검색 기록.html"):
            result["search"] = path

        elif path.endswith("시청 기록.html"):
            result["watch"] = path

        elif path.endswith("구독정보.csv"):
            result["subscriptions"] = path

    return result