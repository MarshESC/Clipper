import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Agent, setGlobalDispatcher } from 'undici';

// Apply global undici agent dispatcher configuration to prevent fetch timeout (Headers Timeout Error) 
// for long generative AI workloads.
setGlobalDispatcher(
  new Agent({
    headersTimeout: 15 * 60 * 1000, // 15 minutes
    bodyTimeout: 15 * 60 * 1000,    // 15 minutes
    keepAliveTimeout: 60 * 1000,
  })
);

// Instantiated dynamically inside the request handler to prevent build-time static evaluation warnings/errors.

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

export async function POST(req) {
  let tempAudioPath = null;
  let uploadResult = null;

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ 
      error: 'GEMINI_API_KEY is not configured in .env.local. Please create it.' 
    }, { status: 500 });
  }

  const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      timeout: 15 * 60 * 1000, // 15 minutes request timeout
    }
  });

  try {
    const { videoUrl, filePath, query } = await req.json();

    const tempDir = path.join(process.cwd(), 'public', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let sourceTitle = 'Uploaded Video';
    let localVideoPath = null;

    if (videoUrl) {
      console.log('Fetching YouTube info and audio using yt-dlp...');
      const videoId = Date.now();
      
      // Get title
      try {
        sourceTitle = await runCommand(`yt-dlp --get-title --no-playlist "${videoUrl}"`);
      } catch (err) {
        console.warn('Failed to fetch youtube title:', err);
        sourceTitle = 'YouTube Video';
      }

      // Download audio only (fastest & highly compressed)
      const outputTemplate = path.join(tempDir, `yt-${videoId}.%(ext)s`);
      // -f "ba" downloads best audio, -x extracts it, --audio-format mp3 converts it to mp3
      const downloadCmd = `yt-dlp -f "ba" -x --audio-format mp3 --audio-quality 5 -o "${outputTemplate}" --no-playlist "${videoUrl}"`;
      
      console.log('Executing download:', downloadCmd);
      await runCommand(downloadCmd);

      // Find the created file
      tempAudioPath = path.join(tempDir, `yt-${videoId}.mp3`);
      if (!fs.existsSync(tempAudioPath)) {
        throw new Error('Downloaded audio file not found.');
      }
      
      // We will save the videoUrl reference for clipping later
      localVideoPath = videoUrl;
      console.log('YouTube audio successfully prepared:', tempAudioPath);

    } else if (filePath) {
      console.log('Processing uploaded local video:', filePath);
      
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Local video file not found on server.' }, { status: 400 });
      }

      sourceTitle = path.basename(filePath);
      localVideoPath = filePath;

      // Extract audio to MP3 using FFmpeg to make the upload to Gemini 40x smaller/faster
      const audioFilename = `audio-${Date.now()}.mp3`;
      tempAudioPath = path.join(tempDir, audioFilename);

      console.log('Extracting audio from local video using FFmpeg...');
      // -vn = disable video, -y = overwrite, -q:a 5 = medium quality VBR MP3 (perfect for speech/timing)
      const extractCmd = `/opt/homebrew/bin/ffmpeg -i "${filePath}" -vn -acodec libmp3lame -q:a 5 -y "${tempAudioPath}"`;
      await runCommand(extractCmd);

      if (!fs.existsSync(tempAudioPath)) {
        throw new Error('Failed to extract audio file.');
      }
      console.log('Local video audio extracted:', tempAudioPath);
    } else {
      return NextResponse.json({ error: 'Either videoUrl or filePath must be provided.' }, { status: 400 });
    }

    // 2. Upload audio to Gemini File API
    console.log('Uploading audio to Gemini File API...');
    uploadResult = await ai.files.upload({
      file: tempAudioPath,
      mimeType: 'audio/mp3',
    });
    console.log('File successfully uploaded to Gemini. URI:', uploadResult.uri);

    // 3. Formulate the prompt
    let searchCriteria = 'Extract the top 3 to 5 most engaging, high-energy, funny, or key highlights that would make viral short vertical clips (TikTok/Reels/Shorts).';
    if (query) {
      searchCriteria = `Instead of default viral hooks, locate and extract highlights matching this specific request: "${query}". Find up to 4 segments.`;
    }

    const systemPrompt = `You are a professional social media video editor and hook generator.
Your goal is to parse the audio stream and identify key sections (between 15 and 50 seconds long) that are extremely engaging.
For each segment, you must provide:
1. "title": A super clickbaity, catchy viral title with emojis.
2. "hook_description": Explanation of why this makes a great hook.
3. "start_time": The start timestamp in seconds (decimal).
4. "end_time": The end timestamp in seconds (decimal).
5. "subtitles": A chronological list of word-level timestamps covering the entire duration from start_time to end_time.
   Inside subtitles, every single word spoken MUST be represented as an object:
   { "word": "word", "start": decimal_seconds, "end": decimal_seconds }
   Ensure "start" and "end" are highly accurate to the audio!

You MUST return a JSON response matching this schema:
{
  "clips": [
    {
      "title": "...",
      "hook_description": "...",
      "start_time": 10.5,
      "end_time": 35.2,
      "subtitles": [
        { "word": "Hello", "start": 10.5, "end": 10.8 },
        { "word": "everyone", "start": 10.8, "end": 11.2 }
      ]
    }
  ]
}`;

    console.log('Invoking Gemini model generateContent...');
    const chatResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              fileData: {
                fileUri: uploadResult.uri,
                mimeType: uploadResult.mimeType,
              }
            },
            { text: `${searchCriteria}\nAnalyze the audio and generate highlights according to the schema.` }
          ]
        }
      ],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      }
    });

    const rawJsonText = chatResponse.text;
    console.log('Gemini raw response received.');
    
    // Parse response
    let parsedData = {};
    try {
      parsedData = JSON.parse(rawJsonText);
    } catch (e) {
      console.error('Failed to parse JSON from Gemini:', rawJsonText);
      throw new Error('Gemini API did not return valid JSON.');
    }

    // Clean up files
    try {
      console.log('Cleaning up Gemini File API storage...');
      await ai.files.delete({ name: uploadResult.name });
      console.log('Gemini file deleted.');
    } catch (err) {
      console.warn('Failed to delete file from Gemini storage:', err);
    }

    if (fs.existsSync(tempAudioPath)) {
      fs.unlinkSync(tempAudioPath);
      console.log('Removed temporary local audio file:', tempAudioPath);
    }

    return NextResponse.json({
      success: true,
      title: sourceTitle,
      videoPath: localVideoPath,
      clips: parsedData.clips || []
    });

  } catch (error) {
    console.error('Error during video analysis:', error);
    
    // Attempt clean up in case of error
    if (ai && uploadResult) {
      try {
        await ai.files.delete({ name: uploadResult.name });
      } catch (_) {}
    }
    if (tempAudioPath && fs.existsSync(tempAudioPath)) {
      try {
        fs.unlinkSync(tempAudioPath);
      } catch (_) {}
    }

    return NextResponse.json({ error: 'Video analysis failed: ' + error.message }, { status: 500 });
  }
}
