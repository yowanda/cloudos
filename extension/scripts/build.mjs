#!/usr/bin/env node
// Build pipeline for the CloudOS browser extension.
//
//   node scripts/build.mjs [--watch] [--no-zip]
//
// Steps:
//   1. Read the manifest template + this package's version.
//   2. Bundle the three TypeScript entrypoints (newtab, options, background,
//      content/bridge) with esbuild.
//   3. Copy the HTML shells into the right output folders.
//   4. Rasterise the source SVG into the four PNG sizes Chrome expects.
//      Falls back gracefully if no SVG → PNG tool is on PATH.
//   5. Emit a single zip artifact at dist/cloudos-extension.zip for upload to
//      the Chrome Web Store / Firefox AMO.

import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { deflateRaw } from "node:zlib";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const execFileAsync = promisify(execFile);
const deflateRawAsync = promisify(deflateRaw);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "src");
const distDir = path.join(root, "dist");
const iconsSrcDir = path.join(root, "icons");

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const skipZip = args.has("--no-zip");

// 1x1 transparent PNG, base64-decoded once at module load. Declared up here
// so it's safe to use from inside copyIcons() which is invoked above the
// const-with-TDZ position in source order.
const TRANSPARENT_1X1_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

const ENTRYPOINTS = [
  {
    entry: path.join(srcDir, "newtab/index.ts"),
    outfile: path.join(distDir, "newtab/index.js"),
  },
  {
    entry: path.join(srcDir, "options/index.ts"),
    outfile: path.join(distDir, "options/index.js"),
  },
  {
    entry: path.join(srcDir, "background/service-worker.ts"),
    outfile: path.join(distDir, "background/service-worker.js"),
  },
  {
    entry: path.join(srcDir, "content/bridge.ts"),
    outfile: path.join(distDir, "content/bridge.js"),
  },
];

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

await writeManifest(pkg.version);
await copyHtmlShells();
await copyIcons();

if (watch) {
  const ctx = await esbuild.context({
    entryPoints: ENTRYPOINTS.map((e) => ({
      in: e.entry,
      out: trimExt(path.relative(distDir, e.outfile)),
    })),
    outdir: distDir,
    bundle: true,
    format: "esm",
    target: ["chrome120", "firefox115"],
    platform: "browser",
    sourcemap: "linked",
    logLevel: "info",
  });
  console.log("[extension] esbuild watching for changes…");
  await ctx.watch();
} else {
  await esbuild.build({
    entryPoints: ENTRYPOINTS.map((e) => ({
      in: e.entry,
      out: trimExt(path.relative(distDir, e.outfile)),
    })),
    outdir: distDir,
    bundle: true,
    format: "esm",
    target: ["chrome120", "firefox115"],
    platform: "browser",
    sourcemap: false,
    minify: false,
    legalComments: "none",
    logLevel: "info",
  });

  if (!skipZip) {
    const zipPath = path.join(distDir, "cloudos-extension.zip");
    await zipDirectory(distDir, zipPath, ["cloudos-extension.zip"]);
    console.log(`[extension] wrote ${path.relative(root, zipPath)}`);
  }
}

async function writeManifest(version) {
  const templatePath = path.join(srcDir, "manifest.template.json");
  const raw = await readFile(templatePath, "utf8");
  const filled = raw.replace("__VERSION__", version);
  // Validate as JSON so a typo in the template fails the build instead of
  // shipping a broken manifest.
  JSON.parse(filled);
  await writeFile(path.join(distDir, "manifest.json"), filled);
}

async function copyHtmlShells() {
  await mkdir(path.join(distDir, "newtab"), { recursive: true });
  await mkdir(path.join(distDir, "options"), { recursive: true });
  await copyFile(path.join(srcDir, "newtab/index.html"), path.join(distDir, "newtab/index.html"));
  await copyFile(path.join(srcDir, "options/index.html"), path.join(distDir, "options/index.html"));
}

async function copyIcons() {
  const outDir = path.join(distDir, "icons");
  await mkdir(outDir, { recursive: true });
  const sizes = [16, 32, 48, 128];
  const svgPath = path.join(iconsSrcDir, "icon.svg");

  // Always copy the SVG itself for browsers / users that prefer it.
  await copyFile(svgPath, path.join(outDir, "icon.svg"));

  // Try magick (ImageMagick 7) first, then convert (ImageMagick 6),
  // then rsvg-convert. If none are available, log a warning — tests will
  // still pass but the unpacked extension won't render the action icon.
  for (const size of sizes) {
    const out = path.join(outDir, `icon-${size}.png`);
    const ok = await tryRasterise(svgPath, out, size);
    if (!ok) {
      console.warn(
        `[extension] could not rasterise ${size}x${size}; install ImageMagick or rsvg-convert`,
      );
      // Fall back to a 1x1 transparent PNG so the manifest still loads.
      await writeFile(out, TRANSPARENT_1X1_PNG);
    }
  }
}

async function tryRasterise(input, output, size) {
  const candidates = [
    {
      cmd: "magick",
      args: [
        "-background",
        "none",
        "-density",
        `${size * 4}`,
        input,
        "-resize",
        `${size}x${size}`,
        output,
      ],
    },
    {
      cmd: "convert",
      args: [
        "-background",
        "none",
        "-density",
        `${size * 4}`,
        input,
        "-resize",
        `${size}x${size}`,
        output,
      ],
    },
    {
      cmd: "rsvg-convert",
      args: ["-w", String(size), "-h", String(size), "-o", output, input],
    },
  ];
  for (const { cmd, args } of candidates) {
    try {
      await execFileAsync(cmd, args, { timeout: 30_000 });
      return true;
    } catch {
      // Try the next candidate.
    }
  }
  return false;
}

function trimExt(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

// ---------------------------------------------------------------------------
// Tiny zip writer (store + deflate). Avoids pulling in another dependency
// just to package the extension.
// ---------------------------------------------------------------------------

async function zipDirectory(dir, outputPath, exclude) {
  const files = await collectFiles(dir, dir);
  const filtered = files.filter((relative) => !exclude.includes(relative));
  filtered.sort();

  const out = createWriteStream(outputPath);
  const entries = [];
  let offset = 0;

  for (const relative of filtered) {
    const absolute = path.join(dir, relative);
    const data = await readFile(absolute);
    const compressed = await deflateRawAsync(data);
    const useDeflate = compressed.length < data.length;
    const payload = useDeflate ? compressed : data;
    const method = useDeflate ? 8 : 0; // 8=deflate, 0=stored
    const crc32 = computeCrc32(data);
    const nameBytes = Buffer.from(relative, "utf8");
    const stats = await stat(absolute);
    const dosTime = toDosTime(stats.mtime);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(dosTime.time, 10);
    localHeader.writeUInt16LE(dosTime.date, 12);
    localHeader.writeUInt32LE(crc32, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);

    out.write(localHeader);
    out.write(nameBytes);
    out.write(payload);

    entries.push({
      relative: nameBytes,
      method,
      dosTime,
      crc32,
      compressedSize: payload.length,
      uncompressedSize: data.length,
      offset,
    });
    offset += localHeader.length + nameBytes.length + payload.length;
  }

  const centralDirStart = offset;
  let centralDirSize = 0;
  for (const entry of entries) {
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4); // made by
    header.writeUInt16LE(20, 6); // version needed
    header.writeUInt16LE(0, 8); // flags
    header.writeUInt16LE(entry.method, 10);
    header.writeUInt16LE(entry.dosTime.time, 12);
    header.writeUInt16LE(entry.dosTime.date, 14);
    header.writeUInt32LE(entry.crc32, 16);
    header.writeUInt32LE(entry.compressedSize, 20);
    header.writeUInt32LE(entry.uncompressedSize, 24);
    header.writeUInt16LE(entry.relative.length, 28);
    header.writeUInt16LE(0, 30); // extra field length
    header.writeUInt16LE(0, 32); // comment length
    header.writeUInt16LE(0, 34); // disk number start
    header.writeUInt16LE(0, 36); // internal attrs
    header.writeUInt32LE(0, 38); // external attrs
    header.writeUInt32LE(entry.offset, 42);
    out.write(header);
    out.write(entry.relative);
    centralDirSize += header.length + entry.relative.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk where central dir starts
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirStart, 16);
  eocd.writeUInt16LE(0, 20); // comment length
  out.write(eocd);

  await new Promise((resolve, reject) => {
    out.end(() => resolve());
    out.on("error", reject);
  });
}

async function collectFiles(root, current) {
  const out = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const abs = path.join(current, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectFiles(root, abs)));
    } else if (entry.isFile()) {
      out.push(path.relative(root, abs).split(path.sep).join("/"));
    }
  }
  return out;
}

function computeCrc32(buf) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function toDosTime(date) {
  const y = Math.max(date.getFullYear(), 1980);
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours();
  const min = date.getMinutes();
  const s = Math.floor(date.getSeconds() / 2);
  const dos = {
    date: ((y - 1980) << 9) | (m << 5) | d,
    time: (h << 11) | (min << 5) | s,
  };
  return dos;
}
