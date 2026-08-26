import streamlit as st

from parser.zip_importer import get_file_list, read_file
from parser.file_detector import find_youtube_files
from parser.search_parser import get_text_preview

st.set_page_config(
    page_title="YouTube Me",
    page_icon="▶️",
)

st.title("▶️ YouTube Me")

st.write(
    "Google Takeout에서 다운로드한 "
    "YouTube ZIP 파일을 업로드해주세요."
)

uploaded_file = st.file_uploader(
    "YouTube Takeout ZIP",
    type=["zip"],
)


if uploaded_file is not None:

    st.success("ZIP 파일 업로드 완료!")

    # 1. ZIP 내부 파일 목록 가져오기
    file_paths = get_file_list(uploaded_file)

    st.write(f"전체 파일: {len(file_paths)}개")

    # 2. YouTube 관련 파일 찾기
    youtube_files = find_youtube_files(file_paths)

    st.write(
        "검색 기록:",
        "발견 ✅" if youtube_files["search"] else "없음 ❌"
    )

    st.write(
        "시청 기록:",
        "발견 ✅" if youtube_files["watch"] else "없음 ❌"
    )

    st.write(
        "구독 정보:",
        "발견 ✅" if youtube_files["subscriptions"] else "없음 ❌"
    )

    # 개발 중에는 실제 경로도 확인
    with st.expander("발견된 파일 경로 보기"):

        st.write(
            "검색 기록:",
            youtube_files["search"]
        )

        st.write(
            "시청 기록:",
            youtube_files["watch"]
        )

        st.write(
            "구독 정보:",
            youtube_files["subscriptions"]
        )

if youtube_files["search"]:

    search_html = read_file(
        uploaded_file,
        youtube_files["search"]
    )

    st.subheader("🔍 검색 기록 HTML 미리보기")

    preview = get_text_preview(search_html)

    st.text_area(
        "HTML에서 추출한 텍스트",
        preview,
        height=400
    )