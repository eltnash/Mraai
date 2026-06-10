import { Injectable, inject } from '@angular/core';

import { SupabaseService } from './supabase.service';

const BUCKET = 'trade-screenshots';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

export interface GalleryUploadResult {
  storagePath: string;
  fileName: string;
  mimeType: string;
}

@Injectable({ providedIn: 'root' })
export class GalleryMediaService {
  private readonly supabase = inject(SupabaseService);

  validateFile(file: File): string | null {
    if (!ALLOWED_MIME.has(file.type) && file.type !== '') {
      return 'Use PNG, JPEG, or WebP images only.';
    }
    if (file.size > MAX_BYTES) {
      return 'Image must be 5 MB or smaller.';
    }
    return null;
  }

  buildStoragePath(userId: string, accountId: string, fileName: string): string {
    const ext = fileName.includes('.') ? fileName.split('.').pop() : 'png';
    return `${userId}/gallery/${accountId}/${crypto.randomUUID()}.${ext}`;
  }

  async upload(accountId: string, file: File): Promise<GalleryUploadResult> {
    const validationError = this.validateFile(file);
    if (validationError) {
      throw new Error(validationError);
    }

    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const mimeType = file.type || 'image/png';
    const storagePath = this.buildStoragePath(user.id, accountId, file.name);

    const { error } = await this.supabase.client.storage.from(BUCKET).upload(storagePath, file, {
      contentType: mimeType,
      upsert: false,
    });
    if (error) {
      throw new Error(error.message);
    }

    return { storagePath, fileName: file.name, mimeType };
  }

  async remove(storagePath: string): Promise<void> {
    const { error } = await this.supabase.client.storage.from(BUCKET).remove([storagePath]);
    if (error) {
      throw new Error(error.message);
    }
  }

  async signedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
    const { data, error } = await this.supabase.client.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, expiresIn);
    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? 'Could not load image');
    }
    return data.signedUrl;
  }
}
