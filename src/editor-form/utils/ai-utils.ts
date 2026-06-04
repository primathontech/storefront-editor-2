export function readFileAsBase64(
  file: File
): Promise<{ mediaType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Failed to read file as data URL"));
          return;
        }

        const match = result.match(/^data:(.*?);base64,(.*)$/);
        if (!match) {
          reject(new Error("Invalid data URL format"));
          return;
        }

        const mediaType = match[1];
        const data = match[2];
        resolve({ mediaType, data });
      } catch (error) {
        reject(error as Error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsDataURL(file);
  });
}
