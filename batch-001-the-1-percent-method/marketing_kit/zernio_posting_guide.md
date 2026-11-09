# Publishing via Zernio — Setup & Posting Guide

Zernio (zernio.com) is a unified social-media API: one dashboard or one REST
endpoint posts to 16 platforms, including **Instagram** and **Pinterest**, with
built-in scheduling, queues and CSV bulk upload. Free tier: **2 social accounts,
unlimited posts** — enough to run this whole weekly batch.

## Step 1 — Connect your accounts (once)

1. Sign up at zernio.com and open the dashboard.
2. Connect your **Instagram Business account** (requires a linked Facebook Page —
   this is Meta's requirement, not Zernio's) and your **Pinterest business account**.
3. Generate an API key in the dashboard: permission "Read & write", full profile access.
   Keep it private — treat it like a password.

## Step 2 — Post this batch

**Easiest (dashboard composer):**

1. Open the composer, select Instagram + Pinterest.
2. Upload `reels/teaser_reel.mp4`, paste the Monday caption from
   `captions_instagram.txt`, pick "Schedule" → Mon 09:30 IST.
3. Repeat for the quote reel (Wed 12:00) and checklist reel (Fri 18:00).
4. For Pinterest, create the three pins from `captions_pinterest.txt` with the
   ebook cover / quote card / checklist card images, scheduled at 20:00 IST.
5. Use "Queue" to auto-spread future batches at your best times.

**Via the REST API (for automation):**

Their marketing pages confirm API-key auth, a single posting endpoint, and
schedule/queue support, but do not publish the exact JSON field names. Confirm
the field names in the API reference inside your dashboard, then the call looks
conceptually like:

```bash
curl https://api.zernio.com/v1/posts \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "platforms": ["instagram", "pinterest"],
    "content": "Caption text from captions_instagram.txt …",
    "mediaUrls": ["https://your-storage/teaser_reel.mp4"],
    "scheduleAt": "2026-11-16T09:30:00+05:30"
  }'
```

Field names above are indicative, not verified — copy the exact schema from your
dashboard's API docs before wiring anything.

## Step 3 — Wire the weekly task (optional)

This sandbox has no Zernio credentials, so the weekly scheduled task produces
ready-to-post kits only. If you later want the task to auto-post through Zernio:

1. Host the ebook PDF and reel MP4s at a public URL (any CDN/storage).
2. Add the posting call (with your API key) to the weekly workflow.
3. Keys should live in a secrets manager — never in plain files or chat.

## Platform notes

- **Instagram Reels**: upload MP4s directly; add a trending audio in-app for
  reach; first comment can carry extra hashtags.
- **Pinterest video pins**: reels double as video pins (up to 15 min); vertical
  9:16 performs best — already the format of these files.
- **Best posting times in IST** (starting point — refine with your analytics):
  Mon 09:30, Wed 12:00, Fri 18:00 for reels; 20:00 for pins.
