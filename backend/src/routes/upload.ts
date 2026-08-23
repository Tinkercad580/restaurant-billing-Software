import { Router, Request, Response } from "express";
import multer from "multer";
import { uploadBuffer } from "../cloudinary";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
      cb(null, true);
    } else {
      cb(new Error("Only JPG or PNG images are allowed"));
    }
  },
});

// POST /api/upload — accepts multipart field "image", returns { url }
router.post("/", (req: Request, res: Response) => {
  upload.single("image")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload failed" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    try {
      const url = await uploadBuffer(req.file.buffer);
      res.status(201).json({ url });
    } catch (error) {
      res.status(502).json({ error: "Failed to upload image" });
    }
  });
});

export default router;
