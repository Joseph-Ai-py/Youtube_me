import io
import zipfile


def get_file_list(uploaded_file):
    """
    Streamlit에서 업로드한 ZIP 파일의
    내부 파일 경로 목록을 반환한다.
    """

    zip_data = io.BytesIO(uploaded_file.getvalue())

    with zipfile.ZipFile(zip_data, "r") as zip_file:
        return zip_file.namelist()

def read_file(uploaded_file, file_path):
    """
    ZIP 내부의 특정 파일 내용을 읽는다.
    """

    zip_data = io.BytesIO(uploaded_file.getvalue())

    with zipfile.ZipFile(zip_data, "r") as zip_file:
        content = zip_file.read(file_path)

    return content