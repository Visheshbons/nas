// ---------- Initialization ---------- //
import express from "express";
import chalk from "chalk";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { createReadStream, createWriteStream, existsSync, statSync } from "fs";
import mime from "mime-types";
import fileUpload from "express-fileupload";
import sanitize from "sanitize-filename";

const app = express();
const port = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base directory for file storage
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, "storage");

// ---------- Middleware ---------- //
app.use(express.static("public"));
app.use(express.json());
app.use(
  fileUpload({
    createParentPath: true,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  }),
);
app.set("view engine", "ejs");

// ---------- Configuration ---------- //
const dev = false; // Set to true to block network access

// ---------- Helper Functions ---------- //
/**
 * Iterates through network interfaces to find the primary non-internal IPv4 address.
 * @returns {string} The detected network IP or 'localhost' as a fallback.
 */
function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

/**
 * Safely join paths and ensure they don't escape the storage directory
 * @param {...string} paths - Path segments to join
 * @returns {string} Safe path within storage directory
 */
function safePath(...paths) {
  const normalized = path.normalize(path.join(...paths));
  const resolvedPath = path.resolve(STORAGE_DIR, normalized);

  if (!resolvedPath.startsWith(STORAGE_DIR)) {
    throw new Error("Path traversal attempt detected");
  }
  return resolvedPath;
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatSize(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Get file and directory information
 * @param {string} itemPath - Path to item
 * @param {string} baseName - Base name of item
 * @returns {Object} Item information
 */
async function getItemInfo(itemPath, baseName) {
  const stats = await fs.stat(itemPath);
  const isDir = stats.isDirectory();

  return {
    name: baseName,
    type: isDir ? "directory" : "file",
    size: isDir ? null : formatSize(stats.size),
    modified: stats.mtime.toLocaleString(),
    path: path.relative(STORAGE_DIR, itemPath),
  };
}

// ---------- Ensure Storage Directory Exists ---------- //
if (!existsSync(STORAGE_DIR)) {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

// ---------- Routes ---------- //
// Main route - File browser
app.get("/", async (req, res) => {
  try {
    const requestPath = req.query.path || "";
    const currentPath = safePath(requestPath);
    const items = [];

    for (const item of await fs.readdir(currentPath)) {
      const itemPath = path.join(currentPath, item);
      items.push(await getItemInfo(itemPath, item));
    }

    items.sort((a, b) => {
      // Directories first, then files
      if (a.type === "directory" && b.type !== "directory") return -1;
      if (a.type !== "directory" && b.type === "directory") return 1;
      return a.name.localeCompare(b.name);
    });

    res.render("index", {
      items,
      currentPath: path.relative(STORAGE_DIR, currentPath),
    });
  } catch (error) {
    console.error("Error reading directory:", error);
    res.status(500).send("Error reading directory");
  }
});

// File upload
app.post("/upload", async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send("No files were uploaded.");
    }

    const targetDir = safePath(req.query.path || "");
    const files = Array.isArray(req.files.files)
      ? req.files.files
      : [req.files.files];

    for (const file of files) {
      const sanitizedName = sanitize(file.name);
      const targetPath = path.join(targetDir, sanitizedName);
      await file.mv(targetPath);
    }

    res.status(200).send("Files uploaded successfully");
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).send("Error uploading files");
  }
});

// File download
app.get("/download", async (req, res) => {
  try {
    const filePath = safePath(req.query.path || "");
    const stats = await fs.stat(filePath);

    if (!stats.isFile()) {
      return res.status(400).send("Not a file");
    }

    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(filePath)}"`,
    );

    createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).send("Error downloading file");
  }
});

// Preview file
app.get("/preview", async (req, res) => {
  try {
    const filePath = safePath(req.query.path);
    const stats = await fs.stat(filePath);

    if (!stats.isFile()) {
      return res.status(400).send("Not a file");
    }

    // Get MIME type
    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    res.setHeader("Content-Type", mimeType);

    // For text files and images under 5MB, send the full file
    if (
      (mimeType.startsWith("text/") ||
        mimeType.startsWith("image/") ||
        mimeType.includes("javascript")) &&
      stats.size < 5 * 1024 * 1024
    ) {
      const content = await fs.readFile(filePath);
      return res.send(content);
    }

    // For larger files and other types, stream the content
    createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error("Preview error:", error);
    res.status(500).send("Error generating preview");
  }
});

// Move file/folder
app.post("/move", async (req, res) => {
  try {
    const { source, target } = req.body;
    if (!source || !target) {
      return res.status(400).send("Source and target paths are required");
    }

    const sourcePath = safePath(source);
    const sourceStats = await fs.stat(sourcePath);
    const sourceBasename = path.basename(sourcePath);

    const targetPath = safePath(target, sourceBasename);

    // Check if target exists and is a directory
    const targetStats = await fs.stat(safePath(target));
    if (!targetStats.isDirectory()) {
      return res.status(400).send("Target must be a directory");
    }

    // Check if destination already exists
    if (existsSync(targetPath)) {
      return res
        .status(409)
        .send(
          "A file or folder with this name already exists in the destination",
        );
    }

    await fs.rename(sourcePath, targetPath);
    res.status(200).send("Item moved successfully");
  } catch (error) {
    console.error("Move error:", error);
    if (error.message.includes("Path traversal")) {
      res.status(403).send("Invalid path");
    } else if (error.code === "EXDEV") {
      res.status(500).send("Cannot move files between different drives");
    } else {
      res.status(500).send("Error moving item");
    }
  }
});

// Delete file/folder
app.post("/delete", async (req, res) => {
  try {
    const itemPath = safePath(req.body.path);
    const stats = await fs.stat(itemPath);

    if (stats.isDirectory()) {
      await fs.rm(itemPath, { recursive: true });
    } else {
      await fs.unlink(itemPath);
    }

    res.status(200).send("Item deleted successfully");
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).send("Error deleting item");
  }
});

// Create new folder
app.post("/create-folder", async (req, res) => {
  try {
    const { name, path: parentPath } = req.body;
    if (!name) {
      return res.status(400).send("Folder name is required");
    }

    const sanitizedName = sanitize(name);
    if (!sanitizedName) {
      return res.status(400).send("Invalid folder name");
    }

    const folderPath = safePath(parentPath || "", sanitizedName);

    // Check if folder already exists
    if (existsSync(folderPath)) {
      return res.status(409).send("Folder already exists");
    }

    await fs.mkdir(folderPath, { recursive: true });
    res.status(200).send("Folder created successfully");
  } catch (error) {
    console.error("Create folder error:", error);
    if (error.message.includes("Path traversal")) {
      res.status(403).send("Invalid folder location");
    } else {
      res.status(500).send("Error creating folder");
    }
  }
});

// Rename file/folder
app.post("/rename", async (req, res) => {
  try {
    const { oldPath, newName } = req.body;
    const sanitizedName = sanitize(newName);
    const oldFullPath = safePath(oldPath);
    const newFullPath = safePath(path.dirname(oldPath), sanitizedName);

    await fs.rename(oldFullPath, newFullPath);
    res.status(200).send("Item renamed successfully");
  } catch (error) {
    console.error("Rename error:", error);
    res.status(500).send("Error renaming item");
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).send("404 Not Found");
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("500 Internal Server Error");
});

// ---------- Server Start ---------- //
app.listen(port, dev ? "127.0.0.1" : "0.0.0.0", () => {
  const ipAddress = getNetworkIP();

  console.log(`Server is up and running on port ${chalk.green(port)}!`);

  if (dev) {
    console.log(`Development Mode: Network access is ${chalk.red("BLOCKED")}`);
    console.log(`Access locally at ${chalk.cyan(`http://localhost:${port}`)}`);
  } else {
    console.log(`Network Mode: External access is ${chalk.green("ALLOWED")}`);
    console.log(
      `Access on your network at ${chalk.cyan(`http://${ipAddress}:${port}`)}`,
    );
  }
});
