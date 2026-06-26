# Universal Video Downloader

A full-stack web application built with React, Vite, and Express, allowing users to download videos from over 1800+ supported platforms using `yt-dlp`.

## Features
- Paste links from supported platforms (YouTube, TikTok, Instagram, etc.)
- Automatic quality extraction and format options
- Support for `cookies.txt` upload for platforms that require authentication or block automated extraction
- Smart fallback strategy for direct video links (.mp4, .m3u8) when primary extraction fails
- Fully prepared for serverless deployment on Vercel

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server (runs Vite and Express API together):
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

4. Start production server:
   ```bash
   npm run start
   ```

## Deploying to Vercel

This project is pre-configured for Vercel deployment. It utilizes a zero-config-friendly layout with:
- The `api/` directory mapping Serverless Functions (`api/index.ts`).
- Vercel automatically detecting Vite and building the frontend to `dist/`.
- `vercel.json` routing rules to ensure the frontend SPA handles client-side routes and API endpoints map correctly.
- Enhanced function memory and file inclusions for `youtube-dl-exec` binaries.

### Steps to Deploy:
1. Initialize a Git repository, commit all files, and push to GitHub.
2. Import the repository into your Vercel dashboard.
3. Click **Deploy**. Vercel will automatically run `npm run build` and provision the API endpoints.
