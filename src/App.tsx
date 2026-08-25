import { useState } from "react";
import { importTakeoutZip } from "./parser/zipImporter";
import {
  findSearchHistory,
  findWatchHistory,
  findSubscriptions,
} from "./parser/fileDetector";

function App() {
  const [message, setMessage] = useState(
    "Google Takeout에서 받은 YouTube ZIP 파일을 선택해주세요."
  );

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setMessage("ZIP 파일을 분석하고 있습니다...");

      const files = await importTakeoutZip(file);

      console.log("전체 파일:", files);

      const searchFile = findSearchHistory(files);
      const watchFile = findWatchHistory(files);
      const subscriptionFile = findSubscriptions(files);

      console.log("검색 기록:", searchFile);
      console.log("시청 기록:", watchFile);
      console.log("구독 정보:", subscriptionFile);

      setMessage(
        [
          `전체 파일: ${files.length}개`,
          `검색 기록: ${searchFile ? "발견 ✅" : "없음 ❌"}`,
          `시청 기록: ${watchFile ? "발견 ✅" : "없음 ❌"}`,
          `구독 정보: ${subscriptionFile ? "발견 ✅" : "없음 ❌"}`,
        ].join("\n")
      );
    } catch (error) {
      console.error(error);
      setMessage("ZIP 파일을 읽는 중 오류가 발생했습니다.");
    }
  }

  return (
    <main style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1>YouTube Me</h1>

      <p>
        Google Takeout에서 받은 YouTube ZIP 파일을 선택하세요.
      </p>

      <input
        type="file"
        accept=".zip"
        onChange={handleFileChange}
      />

      <hr />

      <pre>{message}</pre>
    </main>
  );
}

export default App;