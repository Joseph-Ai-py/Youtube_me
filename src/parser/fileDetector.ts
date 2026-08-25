import type { TakeoutFile } from "./zipImporter";

export function findSearchHistory(
  files: TakeoutFile[]
): TakeoutFile | undefined {
  return files.find((file) => {
    const name = file.name.trim();

    return name === "검색 기록.html";
  });
}

export function findWatchHistory(
  files: TakeoutFile[]
): TakeoutFile | undefined {
  return files.find((file) => {
    const name = file.name.trim();

    return name === "시청 기록.html";
  });
}

export function findSubscriptions(
  files: TakeoutFile[]
): TakeoutFile | undefined {
  return files.find((file) => {
    const name = file.name.trim();

    return name === "구독정보.csv";
  });
}