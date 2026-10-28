import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAdminSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { put } from '@vercel/blob';
import { writeAuditLog } from '@/lib/audit';
import { getUploadRoot } from '@/lib/uploadStorage';

export const dynamic = 'force-dynamic';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4'] as const;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

// Lưu trữ: có BLOB_READ_WRITE_TOKEN → Vercel Blob (bắt buộc trên Vercel vì ổ đĩa serverless không bền);
// không có → ghi vào public/uploads (máy chủ riêng / máy phát triển).
const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
};

function generateSecureFileName(ext: string): string {
  return `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
}

function validateFileContent(buf: Buffer, ext: string): { valid: boolean; reason?: string } {
  if (buf.length < 12) {
    return { valid: false, reason: 'Tệp rỗng hoặc kích thước quá nhỏ' };
  }

  // Chống nhúng script / HTML / SVG trong tệp tải lên
  const previewText = buf.subarray(0, Math.min(buf.length, 1024)).toString('utf-8').toLowerCase();
  if (
    previewText.includes('<script') ||
    previewText.includes('<?php') ||
    previewText.includes('<html') ||
    previewText.includes('<svg') ||
    previewText.includes('<?xml') ||
    previewText.includes('onload=') ||
    previewText.includes('onerror=')
  ) {
    return { valid: false, reason: 'Nội dung tệp chứa mã độc hoặc định dạng SVG/HTML/Script không được phép' };
  }

  switch (ext) {
    case '.jpg':
    case '.jpeg': {
      const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      if (!isJpeg) return { valid: false, reason: 'Nội dung không đúng định dạng JPEG (Magic bytes không khớp)' };
      return { valid: true };
    }
    case '.png': {
      const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      if (!isPng) return { valid: false, reason: 'Nội dung không đúng định dạng PNG (Magic bytes không khớp)' };
      return { valid: true };
    }
    case '.gif': {
      const isGif = buf.subarray(0, 4).toString('ascii') === 'GIF8';
      if (!isGif) return { valid: false, reason: 'Nội dung không đúng định dạng GIF (Magic bytes không khớp)' };
      return { valid: true };
    }
    case '.webp': {
      const isRiff = buf.subarray(0, 4).toString('ascii') === 'RIFF';
      const isWebp = buf.subarray(8, 12).toString('ascii') === 'WEBP';
      if (!isRiff || !isWebp) return { valid: false, reason: 'Nội dung không đúng định dạng WEBP (Magic bytes không khớp)' };
      return { valid: true };
    }
    case '.mp4': {
      const isMp4 = buf.subarray(4, 8).toString('ascii') === 'ftyp';
      if (!isMp4) return { valid: false, reason: 'Nội dung không đúng định dạng MP4 (Magic bytes không khớp)' };
      return { valid: true };
    }
    default:
      return { valid: false, reason: `Đuôi tệp "${ext}" không nằm trong danh sách cho phép` };
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'upload.use')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền tải tệp lên máy chủ.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ success: false, error: 'Yêu cầu tải lên phải là multipart/form-data.' }, { status: 400 });
    }
    const folderType = (formData.get('folder') as string) || 'products'; // products, combos, banners
    const files = formData.getAll('files') as File[];
    const singleFile = formData.get('file') as File | null;

    const filesToUpload: File[] = [];
    if (singleFile && singleFile.size > 0) {
      filesToUpload.push(singleFile);
    }
    if (files && files.length > 0) {
      for (const f of files) {
        if (f && f.size > 0 && !filesToUpload.includes(f)) {
          filesToUpload.push(f);
        }
      }
    }

    if (filesToUpload.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tệp tải lên' },
        { status: 400 }
      );
    }

    // Target upload directory: public/uploads/[folderType]
    const cleanFolder = folderType.replace(/[^a-zA-Z0-9_-]/g, '') || 'general';
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken && process.env.VERCEL) {
      return NextResponse.json(
        { success: false, error: 'Chưa cấu hình kho lưu ảnh (BLOB_READ_WRITE_TOKEN). Vui lòng tạo Vercel Blob Store và gắn vào dự án.' },
        { status: 500 }
      );
    }
    const uploadDir = path.join(getUploadRoot(), cleanFolder);
    if (!blobToken && !fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uploadedUrls: { url: string; originalName: string; size: number }[] = [];

    for (const file of filesToUpload) {
      // 1. Whitelist đuôi file nghiêm ngặt
      const ext = path.extname(file.name || '').toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext as any)) {
        return NextResponse.json(
          {
            success: false,
            error: `Định dạng tệp "${file.name}" không hợp lệ. Chỉ chấp nhận .jpg, .jpeg, .png, .webp, .gif, .mp4.`,
          },
          { status: 400 }
        );
      }

      // 2. Giới hạn dung lượng theo loại (Ảnh <= 5MB, Video <= 50MB)
      const maxAllowedSize = ext === '.mp4' ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
      if (file.size > maxAllowedSize) {
        return NextResponse.json(
          {
            success: false,
            error: `Dung lượng tệp "${file.name}" vượt quá giới hạn cho phép (${ext === '.mp4' ? '50MB' : '5MB'}).`,
          },
          { status: 400 }
        );
      }

      // 3. Đọc buffer và kiểm tra Magic Bytes khớp với đuôi file
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const contentCheck = validateFileContent(buffer, ext);
      if (!contentCheck.valid) {
        return NextResponse.json(
          {
            success: false,
            error: `Tệp "${file.name}" bị từ chối: ${contentCheck.reason}`,
          },
          { status: 400 }
        );
      }

      // 4. Bỏ hoàn toàn tên file gốc từ client, sinh tên ngẫu nhiên chống Path Traversal / Double Extension
      const safeName = generateSecureFileName(ext);
      let publicUrl: string;
      if (blobToken) {
        const blob = await put(`uploads/${cleanFolder}/${safeName}`, buffer, {
          access: 'public',
          contentType: CONTENT_TYPES[ext] || 'application/octet-stream',
          addRandomSuffix: false,
          token: blobToken,
        });
        publicUrl = blob.url;
      } else {
        const filePath = path.join(uploadDir, safeName);
        await fs.promises.writeFile(filePath, buffer);
        publicUrl = `/uploads/${cleanFolder}/${safeName}`;
      }
      uploadedUrls.push({
        url: publicUrl,
        originalName: path.basename(file.name),
        size: file.size,
      });
    }

    await writeAuditLog({
      adminId: session.userId,
      adminUsername: session.username,
      role: session.role,
      action: 'FILE_UPLOAD',
      entityType: 'FILE',
      afterJson: {
        folder: cleanFolder,
        count: uploadedUrls.length,
        files: uploadedUrls.map(u => ({ url: u.url, originalName: u.originalName, size: u.size })),
      },
    });

    return NextResponse.json({
      success: true,
      data: uploadedUrls.length === 1 ? uploadedUrls[0] : uploadedUrls,
      urls: uploadedUrls.map((u) => u.url),
      url: uploadedUrls[0].url,
    });
  } catch (error: any) {
    console.error('Upload API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi khi tải tệp lên máy chủ' },
      { status: 500 }
    );
  }
}

