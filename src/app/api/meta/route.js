import { NextResponse } from 'next/server';
import { exec } from 'child_process';

function runCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 10 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve(stdout.trim());
    });
  });
}

export async function POST(req) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const raw = await runCommand(`yt-dlp --dump-json --no-playlist "${url}"`);
    const info = JSON.parse(raw);

    return NextResponse.json({
      title: info.title || 'Unknown Title',
      thumbnail: info.thumbnail || info.thumbnails?.[info.thumbnails.length - 1]?.url || '',
      duration: info.duration || 0,
      channel: info.channel || info.uploader || 'Unknown',
      viewCount: info.view_count || 0,
      uploadDate: info.upload_date || '',
    });
  } catch (error) {
    console.error('Error fetching video metadata:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch video metadata: ' + error.message 
    }, { status: 500 });
  }
}
