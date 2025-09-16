import { supabase } from "@/client/supabase";

export interface MediaUploadResult {
  url: string;
  path: string;
  publicUrl: string;
}

export const mediaService = {
  // Upload a file to Supabase Storage
  async uploadMedia(
    file: File,
    bucket: string = "chat-media",
    folder: string = "messages"
  ): Promise<MediaUploadResult> {
    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(filePath);

      return {
        url: publicUrl,
        path: filePath,
        publicUrl: publicUrl,
      };
    } catch (error) {
      console.error("Media upload error:", error);
      throw new Error(error instanceof Error ? error.message : "Upload failed");
    }
  },

  // Delete a media file from Supabase Storage
  async deleteMedia(
    filePath: string,
    bucket: string = "chat-media"
  ): Promise<boolean> {
    try {
      const { error } = await supabase.storage.from(bucket).remove([filePath]);

      if (error) {
        console.error("Delete media error:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Delete media error:", error);
      return false;
    }
  },

  // Get file info from URL
  getFileInfoFromUrl(
    url: string
  ): { fileName: string; fileType: string } | null {
    try {
      const urlParts = url.split("/");
      const fileName = urlParts[urlParts.length - 1];
      const fileExt = fileName.split(".").pop()?.toLowerCase();

      let fileType = "unknown";
      if (["jpg", "jpeg", "png", "gif", "webp"].includes(fileExt || "")) {
        fileType = "image";
      } else if (["mp4", "webm", "mov", "quicktime"].includes(fileExt || "")) {
        fileType = "video";
      }

      return { fileName, fileType };
    } catch (error) {
      console.error("Error parsing file info from URL:", error);
      return null;
    }
  },

  // Validate file before upload
  validateFile(file: File): { valid: boolean; error?: string } {
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return { valid: false, error: "File size must be less than 10MB" };
    }

    // Check file type
    const validImageTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    const validVideoTypes = ["video/mp4", "video/webm", "video/quicktime"];
    const validTypes = [...validImageTypes, ...validVideoTypes];

    if (!validTypes.includes(file.type)) {
      return {
        valid: false,
        error:
          "Please select an image (JPEG, PNG, GIF, WebP) or video (MP4, WebM, QuickTime) file",
      };
    }

    return { valid: true };
  },

  // Create a preview URL for the file
  createPreviewUrl(file: File): string {
    return URL.createObjectURL(file);
  },

  // Revoke preview URL to free memory
  revokePreviewUrl(url: string): void {
    URL.revokeObjectURL(url);
  },
};
