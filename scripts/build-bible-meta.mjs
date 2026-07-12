#!/usr/bin/env node
/**
 * Build per-book metadata from WEB USFM (red-letter) and BSB USFM (section headings).
 * Outputs public/bible/meta/<n>.json (n = 1-based bibleMeta index).
 *
 * Requires /tmp/eng-web_usfm.zip and /tmp/bsb_usfm.zip (downloaded if missing).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public/bible/meta");

const BOOK_CODES = [
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI",
  "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER",
  "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP",
  "HAG", "ZEC", "MAL", "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL",
  "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE",
  "2PE", "1JN", "2JN", "3JN", "JUD", "REV",
];

const WEB_ZIP = "/tmp/eng-web_usfm.zip";
const BSB_ZIP = "/tmp/bsb_usfm.zip";

function ensureZip(url, dest) {
  if (fs.existsSync(dest)) return;
  console.log(`Downloading ${url}…`);
  execSync(`curl -sL "${url}" -o "${dest}"`, { stdio: "inherit" });
}

function readUsfmFromZip(zip, pattern) {
  return execSync(`unzip -p "${zip}" "${pattern}"`, { maxBuffer: 20 * 1024 * 1024 }).toString("utf8");
}

function webUsfmPattern(code) {
  const listing = execSync(`unzip -l "${WEB_ZIP}"`, { encoding: "utf8" });
  const re = new RegExp(`(\\S*${code}eng-web\\.usfm)`, "i");
  const m = listing.match(re);
  if (!m) throw new Error(`WEB USFM not found for ${code}`);
  return m[1];
}

function parseUsfmVerseSegments(raw) {
  const segments = [];
  let wj = false;
  let buf = "";
  let i = 0;

  const flush = () => {
    if (!buf) return;
    segments.push({ text: buf, wj });
    buf = "";
  };

  while (i < raw.length) {
    if (raw[i] === "\\") {
      const rest = raw.slice(i);
      if (rest.startsWith("\\wj*")) {
        flush();
        wj = false;
        i += 4;
        continue;
      }
      if (rest.startsWith("\\wj ")) {
        flush();
        wj = true;
        i += 4;
        continue;
      }
      const foot = rest.match(/^\\f[\s\S]*?\\f\*/);
      if (foot) {
        i += foot[0].length;
        continue;
      }
      const xref = rest.match(/^\\x[\s\S]*?\\x\*/);
      if (xref) {
        i += xref[0].length;
        continue;
      }
      if (rest.startsWith("\\+w ")) {
        const end = rest.indexOf("\\+w*");
        if (end === -1) {
          i++;
          continue;
        }
        buf += rest.slice(4, end).split("|")[0];
        i += end + 4;
        continue;
      }
      if (rest.startsWith("\\w ")) {
        const end = rest.indexOf("\\w*");
        if (end === -1) {
          i++;
          continue;
        }
        buf += rest.slice(3, end).split("|")[0];
        i += end + 3;
        continue;
      }
      const skip = rest.match(/^\\[a-z0-9]+[*]?\s*/i);
      if (skip) {
        i += skip[0].length;
        continue;
      }
    }
    buf += raw[i++];
  }
  flush();
  return segments;
}

function segmentsToWjRanges(segments, webText) {
  let offset = 0;
  const ranges = [];
  for (const seg of segments) {
    const start = offset;
    offset += seg.text.length;
    if (seg.wj && seg.text.length > 0) {
      ranges.push([start, offset]);
    }
  }
  const plain = segments.map((s) => s.text).join("");
  if (plain === webText) return mergeRanges(ranges);

  // Align wj phrases into WEB verse text when USFM plain text differs slightly.
  const out = [];
  let searchFrom = 0;
  for (const seg of segments) {
    if (!seg.wj || !seg.text.trim()) continue;
    const idx = webText.indexOf(seg.text, searchFrom);
    if (idx !== -1) {
      out.push([idx, idx + seg.text.length]);
      searchFrom = idx + seg.text.length;
    }
  }
  return mergeRanges(out);
}

function mergeRanges(ranges) {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = out[out.length - 1];
    const cur = sorted[i];
    if (cur[0] <= prev[1]) prev[1] = Math.max(prev[1], cur[1]);
    else out.push(cur);
  }
  return out;
}

function parseWebWj(usfm, webBook) {
  const chapters = {};
  const parts = usfm.split(/\\c\s+(\d+)\s+/);
  for (let i = 1; i < parts.length; i += 2) {
    const ch = Number(parts[i]);
    const body = parts[i + 1] ?? "";
    const verses = {};
    const vParts = body.split(/\\v\s+(\d+)\s+/);
    for (let j = 1; j < vParts.length; j += 2) {
      const verse = Number(vParts[j]);
      const raw = (vParts[j + 1] ?? "").split(/\\c\s+\d+/)[0];
      const webText = webBook.chapters[ch - 1]?.[verse - 1];
      if (!webText) continue;
      const segments = parseUsfmVerseSegments(raw);
      const wj = segmentsToWjRanges(segments, webText);
      if (wj.length) verses[String(verse)] = wj;
    }
    if (Object.keys(verses).length) chapters[String(ch)] = { wj: verses };
  }
  return chapters;
}

function verseAfterHeading(lines, fromIndex) {
  for (let j = fromIndex + 1; j < lines.length; j++) {
    const nv = lines[j].match(/\\v\s+(\d+)\s+/);
    if (nv) return Number(nv[1]);
  }
  return 1;
}

function parseBsbHeadings(usfm) {
  const chapters = {};
  const parts = usfm.split(/\\c\s+(\d+)\s+/);
  for (let i = 1; i < parts.length; i += 2) {
    const ch = Number(parts[i]);
    const body = parts[i + 1] ?? "";
    const headings = [];
    const lines = body.split("\n");
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const s1 = line.match(/^\\s1\s+(.+?)\s*$/);
      const s2 = line.match(/^\\s2\s+(.+?)\s*$/);
      if (s1) headings.push([verseAfterHeading(lines, li), 1, s1[1].trim()]);
      if (s2) headings.push([verseAfterHeading(lines, li), 2, s2[1].trim()]);
    }
    if (headings.length) {
      if (!chapters[String(ch)]) chapters[String(ch)] = {};
      chapters[String(ch)].h = headings;
    }
  }
  return chapters;
}

function mergeChapters(webChapters, bsbChapters) {
  const keys = new Set([...Object.keys(webChapters), ...Object.keys(bsbChapters)]);
  const out = {};
  for (const k of keys) {
    out[k] = { ...(bsbChapters[k] ?? {}), ...(webChapters[k] ?? {}) };
    if (webChapters[k]?.wj) out[k].wj = webChapters[k].wj;
    if (bsbChapters[k]?.h) out[k].h = bsbChapters[k].h;
  }
  return out;
}

ensureZip("https://ebible.org/Scriptures/eng-web_usfm.zip", WEB_ZIP);
ensureZip(
  "https://github.com/BSB-publishing/bsb2usfm/releases/download/v5.4/BSB_usfm.zip",
  BSB_ZIP,
);

fs.mkdirSync(OUT_DIR, { recursive: true });

for (let i = 0; i < BOOK_CODES.length; i++) {
  const code = BOOK_CODES[i];
  const bookNr = i + 1;
  const webBook = JSON.parse(
    fs.readFileSync(path.join(ROOT, `public/bible/web/${bookNr}.json`), "utf8"),
  );

  let webUsfm = "";
  let bsbUsfm = "";
  try {
    webUsfm = readUsfmFromZip(WEB_ZIP, webUsfmPattern(code));
  } catch (e) {
    console.warn(`Skip WEB USFM for ${code}: ${e.message}`);
  }
  try {
    bsbUsfm = readUsfmFromZip(BSB_ZIP, `${code}.usfm`);
  } catch {
    console.warn(`Skip BSB headings for ${code}`);
  }

  const webCh = webUsfm ? parseWebWj(webUsfm, webBook) : {};
  const bsbCh = bsbUsfm ? parseBsbHeadings(bsbUsfm) : {};
  const chapters = mergeChapters(webCh, bsbCh);

  fs.writeFileSync(path.join(OUT_DIR, `${bookNr}.json`), JSON.stringify(chapters));
  const hCount = Object.values(chapters).reduce((n, c) => n + (c.h?.length ?? 0), 0);
  const wjCount = Object.values(chapters).reduce(
    (n, c) => n + Object.keys(c.wj ?? {}).length,
    0,
  );
  console.log(`${bookNr} ${code}: ${Object.keys(chapters).length} ch, ${hCount} headings, ${wjCount} wj verses`);
}

console.log("Done.");
