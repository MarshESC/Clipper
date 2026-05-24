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

function formatSRTTime(seconds) {
  const hr = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const min = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${hr}:${min}:${sec},${ms}`;
}

export async function POST(req) {
  let tempSrtPath = null;
  let tempTrimmedPath = null;
  let finalOutputPath = null;
  let videoPath = null; // Declare in outer scope to prevent ReferenceError in catch block

  try {
    const body = await req.json();
    videoPath = body.videoPath;
    const { start, end, cropXPercent, burnSubtitles, subtitles } = body;

    if (!videoPath) {
      return NextResponse.json({ error: 'Missing videoPath parameter.' }, { status: 400 });
    }

    // Use relative paths to avoid issues with absolute paths containing spaces (e.g. in workspace folder name)
    const tempDir = 'public/temp';
    const absoluteTempDir = path.join(process.cwd(), tempDir);
    if (!fs.existsSync(absoluteTempDir)) {
      fs.mkdirSync(absoluteTempDir, { recursive: true });
    }

    const clipId = Date.now();
    const isYoutube = videoPath.startsWith('http://') || videoPath.startsWith('https://') || videoPath.includes('youtube.com') || videoPath.includes('youtu.be');

    // Make local videoPath relative to process.cwd() to bypass workspace path spaces
    const safeVideoPath = isYoutube ? videoPath : path.relative(process.cwd(), videoPath);

    // 1. If YouTube, download the specific time segment (fast!)
    if (isYoutube) {
      console.log(`Downloading YouTube segment using yt-dlp: ${start}s to ${end}s...`);
      // Use /tmp/ directory which never has spaces on macOS/Linux to completely bypass spaces in workspace folder name
      tempTrimmedPath = `/tmp/yt-trim-${clipId}.mp4`;
      
      // -f "mp4" ensures standard MP4, --no-part prevents .part extension which breaks ffmpeg muxer, --external-downloader ffmpeg pulls only the target segment!
      const ytDownloadCmd = `yt-dlp -f "mp4" --no-part --external-downloader ffmpeg --external-downloader-args "* -ss ${start} -to ${end}" -o "${tempTrimmedPath}" --no-playlist "${safeVideoPath}"`;
      console.log('Running yt-dlp command:', ytDownloadCmd);
      await runCommand(ytDownloadCmd);

      if (!fs.existsSync(tempTrimmedPath)) {
        throw new Error('yt-dlp failed to download the target segment.');
      }
    } else {
      // Local file path
      if (!fs.existsSync(safeVideoPath)) {
        return NextResponse.json({ error: `Local file not found: ${safeVideoPath}` }, { status: 400 });
      }
      tempTrimmedPath = safeVideoPath;
    }

    // 2. Generate SRT file if burning subtitles
    if (burnSubtitles && subtitles && subtitles.length > 0) {
      console.log('Generating SRT file for captions...');
      tempSrtPath = path.join(tempDir, `sub-${clipId}.srt`);
      
      let srtContent = '';
      subtitles.forEach((sub, idx) => {
        // Subtitles starts relative to the trimmed video (0 seconds!)
        // So we subtract the start offset from the subtitle timestamp
        const relativeStart = Math.max(0, sub.start - parseFloat(start));
        const relativeEnd = Math.max(0, sub.end - parseFloat(start));

        srtContent += `${idx + 1}\n`;
        srtContent += `${formatSRTTime(relativeStart)} --> ${formatSRTTime(relativeEnd)}\n`;
        srtContent += `${sub.word}\n\n`;
      });

      await fs.promises.writeFile(tempSrtPath, srtContent);
      console.log('SRT file created:', tempSrtPath);
    }

    // 3. Build FFmpeg crop filter
    // Handles shifting crop horizontaly based on cropXPercent (-100 to +100)
    // Formula calculates left-corner coordinates: (1 + cropXPercent/100) * (iw - ih*9/16) / 2
    // We normalize to avoid division issues by executing mathematically
    const shiftMultiplier = (1 + (parseFloat(cropXPercent) || 0) / 100).toFixed(4);
    let videoFilter = `crop=ih*9/16:ih:${shiftMultiplier}*(iw-ih*9/16)/2:0`;

    if (burnSubtitles && tempSrtPath) {
      // Escape path characters for FFmpeg filter on macOS
      const escapedSrtPath = tempSrtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
      // Subtitles filter options: force Outfit/sans bold font, yellow active color
      videoFilter += `,subtitles='${escapedSrtPath}':force_style='Fontname=Outfit,Fontsize=22,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Alignment=2'`;
    }

    finalOutputPath = path.join(tempDir, `clip-final-${clipId}.mp4`);
    
    // Assemble final FFmpeg command
    let ffmpegCmd = '';
    if (isYoutube) {
      // Input is already trimmed, just apply crop/subtitles and stream copy audio
      ffmpegCmd = `/opt/homebrew/bin/ffmpeg -i "${tempTrimmedPath}" -vf "${videoFilter}" -c:a aac -y "${finalOutputPath}"`;
    } else {
      // Input is raw local file: apply both time trim (-ss, -to) and crop filter in one go
      ffmpegCmd = `/opt/homebrew/bin/ffmpeg -ss ${start} -to ${end} -i "${tempTrimmedPath}" -vf "${videoFilter}" -c:a aac -y "${finalOutputPath}"`;
    }

    console.log('Executing FFmpeg process:', ffmpegCmd);
    await runCommand(ffmpegCmd);

    if (!fs.existsSync(finalOutputPath)) {
      throw new Error('FFmpeg failed to export the cropped video file.');
    }

    console.log('Video clip successfully processed! Streaming file to client...');
    
    // Read and stream file back
    const fileBuffer = await fs.promises.readFile(finalOutputPath);

    // Clean up temporary segment files asynchronously so we don't block
    setTimeout(() => {
      try {
        if (tempSrtPath && fs.existsSync(tempSrtPath)) fs.unlinkSync(tempSrtPath);
        if (isYoutube && tempTrimmedPath && fs.existsSync(tempTrimmedPath)) fs.unlinkSync(tempTrimmedPath);
        if (finalOutputPath && fs.existsSync(finalOutputPath)) fs.unlinkSync(finalOutputPath);
        console.log('Asynchronous temp files purged.');
      } catch (err) {
        console.warn('Failed to clean up temp files:', err);
      }
    }, 10000); // 10s delay to ensure stream is completed

    // Return video binary stream
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="clip-${clipId}.mp4"`
      }
    });

  } catch (error) {
    console.error('Error during video clipping:', error);
    
    // Cleanup on error
    if (tempSrtPath && fs.existsSync(tempSrtPath)) {
      try { fs.unlinkSync(tempSrtPath); } catch (_) {}
    }
    if (tempTrimmedPath && tempTrimmedPath !== videoPath && fs.existsSync(tempTrimmedPath)) {
      try { fs.unlinkSync(tempTrimmedPath); } catch (_) {}
    }
    if (finalOutputPath && fs.existsSync(finalOutputPath)) {
      try { fs.unlinkSync(finalOutputPath); } catch (_) {}
    }

    return NextResponse.json({ error: 'Clipping operation failed: ' + error.message }, { status: 500 });
  }
}
