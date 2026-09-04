import json

import streamlit as st

from parser.watch_parser import parse_watch_history_json

st.set_page_config(
    page_title="YouTube Me",
    page_icon="▶️",
)

st.title("YouTube 시청 기록 분석")

st.write(
    "Google Takeout에서 받은 watch-history.json 파일을 업로드해주세요."
)

uploaded_file = st.file_uploader(
    "시청 기록 JSON",
    type=["json"],
)

if uploaded_file is not None:
    try:
        watch_events = parse_watch_history_json(uploaded_file.getvalue())
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        st.error(f"JSON 파일을 읽지 못했습니다: {error}")
    else:
        st.success(f"시청 기록 {len(watch_events):,}개를 불러왔습니다.")
        st.dataframe(watch_events, use_container_width=True, hide_index=True)