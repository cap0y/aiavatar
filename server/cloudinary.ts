import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

// CLOUDINARY_URL 환경변수가 있으면 자동으로 설정됨
// 형식: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
if (process.env.CLOUDINARY_URL) {
  // cloudinary 라이브러리가 CLOUDINARY_URL을 자동 파싱하므로 별도 설정 불필요
  console.log("☁️ Cloudinary 설정 완료 (CLOUDINARY_URL 사용)");
} else {
  console.warn("⚠️ CLOUDINARY_URL 환경변수가 설정되지 않았습니다.");
}

/**
 * Buffer를 Cloudinary에 업로드하는 함수
 * @param buffer - 파일 버퍼
 * @param folder - Cloudinary 폴더 경로 (예: "feed-media", "profile", "chat")
 * @param options - 추가 업로드 옵션
 * @returns Cloudinary 업로드 결과 (secure_url 포함)
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  options?: {
    resourceType?: "image" | "video" | "raw" | "auto";
    publicId?: string;
    transformation?: any;
  }
): Promise<{ url: string; publicId: string; width?: number; height?: number }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `aiavatar/${folder}`,
        resource_type: options?.resourceType || "auto",
        public_id: options?.publicId,
        transformation: options?.transformation,
      },
      (error, result) => {
        if (error) {
          console.error("❌ Cloudinary 업로드 실패:", error.message);
          reject(error);
        } else if (result) {
          console.log("✅ Cloudinary 업로드 성공:", {
            url: result.secure_url,
            publicId: result.public_id,
            size: `${(result.bytes / 1024 / 1024).toFixed(2)}MB`,
          });
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
          });
        }
      }
    );

    // Buffer를 스트림으로 변환하여 업로드
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

/**
 * Cloudinary에서 파일을 삭제하는 함수
 * @param publicId - 삭제할 파일의 public_id
 * @param resourceType - 리소스 유형
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: "image" | "video" | "raw" = "image"
): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    console.log("🗑️ Cloudinary 삭제:", { publicId, result: result.result });
    return result.result === "ok";
  } catch (error) {
    console.error("❌ Cloudinary 삭제 실패:", error);
    return false;
  }
}

export { cloudinary };

