import multer from "multer";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { env } from "@/config/env";
import { ValidationError } from "@/domain/errors/AppError";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILES = 10;

/**
 * Memory storage: files land in req.files as Buffers, handed straight to
 * CloudinaryImageStorageService.upload() without ever touching disk.
 */
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxImageUploadBytes,
    files: MAX_FILES,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new Error(`Unsupported image type: ${file.mimetype}. Allowed: JPEG, PNG, WebP.`));
      return;
    }
    callback(null, true);
  },
});

/**
 * Wraps multer so its errors (bad file type, over size, too many files)
 * surface as a proper 400 ValidationError instead of falling through to
 * the generic 500 handler -- multer errors are plain Errors/MulterErrors,
 * not AppError subclasses, and would otherwise be treated as unexpected
 * bugs.
 */
export function uploadPropertyImages(): RequestHandler {
  const handler = imageUpload.array("images", MAX_FILES);

  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : "Image upload failed";
        next(new ValidationError(message));
        return;
      }
      next();
    });
  };
}

/** Single-file variant used by identity verification document upload
 * (Phase 4 Part 5) -- same memory storage / mime-type / size constraints,
 * just one file under a configurable field name instead of an array. */
export function uploadSingleImage(fieldName: string): RequestHandler {
  const handler = imageUpload.single(fieldName);

  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : "Image upload failed";
        next(new ValidationError(message));
        return;
      }
      next();
    });
  };
}
