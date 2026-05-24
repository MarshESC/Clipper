import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

export async function GET(req) {
  let thumbPath = null;
  try {
    const { searchParams } = new URL(req.url);
    const videoPath = searchParams.get('videoPath');
    const time = parseFloat(searchParams.get('time') || '0');

    if (!videoPath) {
      return NextResponse.json({ error: 'Missing videoPath parameter.' }, { status: 400 });
    }

    const tempDir = 'public/temp';
    const absoluteTempDir = path.join(process.cwd(), tempDir);
    if (!fs.existsSync(absoluteTempDir)) {
      fs.mkdirSync(absoluteTempDir, { recursive: true });
    }

    const thumbFilename = `thumb-${Date.now()}-${Math.floor(time)}.jpg`;
    thumbPath = path.join(absoluteTempDir, thumbFilename);

    const isYoutube = videoPath.startsWith('http://') || videoPath.startsWith('https://') || videoPath.includes('youtube.com') || videoPath.includes('youtu.be');

    let inputUrl = videoPath;
    if (isYoutube) {
      console.log(`Extracting direct stream URL for YouTube using yt-dlp...`);
      // -g gets the direct streaming video URL
      inputUrl = await runCommand(`yt-dlp -f "mp4/best" -g "${videoPath}"`);
    } else {
      // For local files, resolve relative to process.cwd()
      inputUrl = path.relative(process.cwd(), videoPath);
      if (!fs.existsSync(path.join(process.cwd(), inputUrl))) {
        return NextResponse.json({ error: `File not found: ${inputUrl}` }, { status: 400 });
      }
    }

    console.log(`Extracting frame at ${time}s using FFmpeg from stream...`);
    // -ss before -i ensures extremely fast seeking, -vframes 1 grabs one frame, -q:v 2 is high quality JPEG
    const ffmpegCmd = `ffmpeg -ss ${time} -i "${inputUrl}" -vframes 1 -q:v 2 -y "${thumbPath}"`;
    await runCommand(ffmpegCmd);

    if (!fs.existsSync(thumbPath)) {
      throw new Error('FFmpeg failed to extract frame.');
    }

    // Read image file buffer
    const imageBuffer = await fs.promises.readFile(thumbPath);

    // Clean up file asynchronously
    setTimeout(() => {
      try {
        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
      } catch (_) {}
    }, 5000);

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000'
      }
    });

  } catch (error) {
    console.error('Error during thumbnail extraction:', error);
    if (thumbPath && fs.existsSync(thumbPath)) {
      try { fs.unlinkSync(thumbPath); } catch (_) {}
    }
    return NextResponse.json({ error: 'Thumbnail extraction failed: ' + error.message }, { status: 500 });
  }
}
