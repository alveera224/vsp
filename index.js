import express from "express";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import dotenv from "dotenv";
dotenv.config();
// Manually set the FFmpeg path
//ffmpeg.setFfmpegPath("C:\\Users\\abhishekd\\Downloads\\ffmpeg\\bin\\ffmpeg"); // Update this with your FFmpeg binary path
ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);

const app = express();

// Ensure upload directories exist
const ensureDirectoryExistence = (directoryPath) => {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
};

// Multer middleware configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "./uploads";
    ensureDirectoryExistence(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${file.fieldname}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  },
});

const upload = multer({ storage: storage });

// Middleware setup
app.use(cors({ origin: ["http://localhost:3000", "http://localhost:5173"], credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Video Upload Service" });
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const lessonId = uuidv4();
  const videoPath = req.file.path; // Path to the uploaded video
  const outputPath = `./uploads/courses/${lessonId}`;
  const hlsPath = `${outputPath}/index.m3u8`;

  console.log("Uploaded file path:", videoPath);

  // Ensure the output directory exists
  ensureDirectoryExistence(outputPath);

  // Use fluent-ffmpeg for HLS conversion
  ffmpeg(videoPath)
    .outputOptions([
      "-codec:v libx264",
      "-codec:a aac",
      "-hls_time 10",
      "-hls_playlist_type vod",
      `-hls_segment_filename ${path.join(outputPath, "segment%03d.ts")}`,
    ])
    .output(hlsPath)
    .on("start", (commandLine) => {
      console.log(`FFmpeg process started: ${commandLine}`);
    })
    .on("error", (err) => {
      console.error(`FFmpeg error: ${err.message}`);
      return res.status(500).json({ error: "Video processing failed" });
    })
    .on("end", () => {
      console.log("HLS conversion completed");
      const videoUrl = `http://localhost:3000/uploads/courses/${lessonId}/index.m3u8`;

      res.json({
        message: "Video successfully converted to HLS format",
        videoUrl: videoUrl,
        lessonId: lessonId,
      });
    })
    .run();
});

// Start the server
app.listen(3000, () => {
  console.log("App is listening on port 3000...");
});
