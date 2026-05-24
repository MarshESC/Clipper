import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided in form data' }, { status: 400 });
    }

    // Ensure temp directory exists under process.cwd()/public/temp
    const tempDir = path.join(process.cwd(), 'public', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Clean and sanitize the filename
    const fileExtension = path.extname(file.name);
    const baseName = path.basename(file.name, fileExtension).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFilename = `${Date.now()}-${baseName}${fileExtension}`;
    const filePath = path.join(tempDir, safeFilename);

    // Read the file data array buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save the file to disk
    await fs.promises.writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      filename: safeFilename,
      filePath: filePath,
      url: `/temp/${safeFilename}`
    });
  } catch (error) {
    console.error('Error handling upload:', error);
    return NextResponse.json({ error: 'Failed to process file upload: ' + error.message }, { status: 500 });
  }
}
