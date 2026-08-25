import JSZip from "jszip";

export interface TakeoutFile {
  path: string;
  name: string;
  content: string;
}

export async function importTakeoutZip(
  file: File
): Promise<TakeoutFile[]> {
  const zip = await JSZip.loadAsync(file);

  const files: TakeoutFile[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;

    const content = await entry.async("text");

    files.push({
      path,
      name: path.split("/").pop() ?? path,
      content,
    });
  }

  return files;
}