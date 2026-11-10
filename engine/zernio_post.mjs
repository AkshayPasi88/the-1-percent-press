#!/usr/bin/env node
// zernio_post.mjs — publish a media file to Instagram + Pinterest via the
// Zernio API (presign upload → public URL → POST /v1/posts).
//
// Usage:
//   node zernio_post.mjs <file> "<caption>" [--type image|video]
//                        [--platforms ig,pin] [--at "2026-11-16T09:30:00+05:30"]
//                        [--board <boardId>] [--first-comment "<text>"] [--pin-title "<title>"]
//
// --at omitted  → publishNow
// Secrets are read from /home/z/my-project/.secrets/ (never printed).
import fs from "node:fs";
import path from "node:path";

const SEC = "/home/z/my-project/.secrets";
const KEY = fs.readFileSync(`${SEC}/zernio_key`, "utf8").trim();
const IG = fs.readFileSync(`${SEC}/instagram_account_id`, "utf8").trim();
const PIN = fs.readFileSync(`${SEC}/pinterest_account_id`, "utf8").trim();
const API = "https://zernio.com/api/v1";

const argv = process.argv.slice(2);
const file = argv.shift();
const caption = argv.shift();
if (!file || !caption) {
  console.error("usage: node zernio_post.mjs <file> <caption> [--type image|video] [--platforms ig,pin] [--at ISO] [--board id] [--first-comment text] [--pin-title text]");
  process.exit(1);
}
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const type = opt("--type") ?? (/\.(mp4|mov|webm)$/i.test(file) ? "video" : "image");
const platformsArg = (opt("--platforms") ?? "ig,pin").split(",");
const scheduleAt = opt("--at");
const boardId = opt("--board");
const firstComment = opt("--first-comment");
const pinTitle = opt("--pin-title");

const platforms = [];
if (platformsArg.includes("ig"))
  platforms.push({
    platform: "instagram",
    accountId: IG,
    ...(firstComment ? { platformSpecificData: { firstComment } } : {}),
  });
if (platformsArg.includes("pin"))
  platforms.push({
    platform: "pinterest",
    accountId: PIN,
    ...(boardId ? { platformSpecificData: { boardId } } : {}),
    ...(pinTitle ? { platformSpecificData: { ...(boardId ? { boardId } : {}), title: pinTitle } } : {}),
  });

const authHeaders = { Authorization: `Bearer ${KEY}` };

async function main() {
  /* 1. presign */
  const presignRes = await fetch(`${API}/media/presign`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ filename: path.basename(file), contentType: type === "video" ? "video/mp4" : "image/png" }),
  });
  const presign = await presignRes.json().catch(() => ({}));
  if (!presignRes.ok || !presign.uploadUrl) {
    console.error("PRESIGN FAILED", presignRes.status, JSON.stringify(presign).slice(0, 400));
    process.exit(2);
  }
  console.log(`presigned: ${presign.publicUrl}`);

  /* 2. upload */
  const buf = fs.readFileSync(file);
  const upRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": type === "video" ? "video/mp4" : "image/png" },
    body: buf,
  });
  if (!upRes.ok) {
    console.error("UPLOAD FAILED", upRes.status, (await upRes.text()).slice(0, 300));
    process.exit(3);
  }
  console.log(`uploaded: ${(buf.length / 1024 / 1024).toFixed(2)} MB`);

  /* 3. create post */
  const body = {
    content: caption,
    mediaItems: [{ url: presign.publicUrl, type }],
    platforms,
    ...(scheduleAt ? { scheduledFor: scheduleAt } : { publishNow: true }),
  };
  const postRes = await fetch(`${API}/posts`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const post = await postRes.json().catch(() => ({}));
  if (!postRes.ok) {
    console.error("POST FAILED", postRes.status, JSON.stringify(post).slice(0, 500));
    process.exit(4);
  }
  const p = post.post ?? post;
  console.log(`post created: ${p._id} status=${p.status}`);
  for (const pl of p.platforms ?? []) {
    console.log(`  ${pl.platform}: ${pl.status}${pl.platformPostUrl ? " → " + pl.platformPostUrl : ""}`);
  }
  if (post.message) console.log(`message: ${post.message}`);

  /* 4. poll status a few times if not final */
  const id = p._id;
  if (id && !["published", "failed", "error"].includes(p.status)) {
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 8000));
      const stRes = await fetch(`${API}/posts/${id}`, { headers: authHeaders });
      const st = await stRes.json().catch(() => ({}));
      const sp = st.post ?? st;
      const statuses = (sp.platforms ?? []).map((x) => `${x.platform}:${x.status}`).join(" ");
      console.log(`poll ${i + 1}: post=${sp.status ?? "?"} ${statuses}`);
      if (sp.status === "published" || sp.status === "failed") {
        for (const x of sp.platforms ?? [])
          if (x.platformPostUrl) console.log(`  ${x.platform} URL: ${x.platformPostUrl}`);
        break;
      }
    }
  }
}

main().catch((e) => { console.error("ERROR", e.message); process.exit(9); });
