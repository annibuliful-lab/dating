import { requestError } from '@/services/user-api';


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
    if (!['dating', 'chat-media'].includes(bucket)) throw new Error('Invalid bucket');
    const form = new FormData();
    form.set('file', file);
    form.set('kind', folder === 'posts' ? 'post' : 'chat');
    if (folder.startsWith('chats/')) form.set('chatId', folder.slice(6));
    const response = await fetch('/api/storage', { method: 'POST', body: form });
    const result = await response.json();
    if (!response.ok) throw requestError(response.status);
    return result;
  },

  // Upload multiple files to Supabase Storage
  async uploadMultipleMedia(
    files: File[],
    bucket: string = "dating",
    folder: string = "messages"
  ): Promise<MediaUploadResult[]> {
    try {
      const uploadPromises = files.map((file) =>
        this.uploadMedia(file, bucket, folder)
      );
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error("Batch media upload error:", error);
      throw new Error(
        error instanceof Error ? error.message : "Batch upload failed"
      );
    }
  },

  // Delete a media file from Supabase Storage
  async deleteMedia(
    filePath: string,
    bucket: string = "chat-media"
  ): Promise<boolean> {
    const response = await fetch('/api/storage', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: [filePath], bucket }),
    });
    return response.ok;
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
