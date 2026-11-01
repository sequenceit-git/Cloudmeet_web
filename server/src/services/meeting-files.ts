import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

// Use an OS temp directory or configured directory that is ALWAYS writable by any user (including 'node' in Docker)
const root = process.env.MEETING_FILES_DIR 
  ? path.resolve(process.env.MEETING_FILES_DIR) 
  : path.join(os.tmpdir(), 'meeting-files');

export function safeMeetingCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9-]/g, '');
}

export function meetingFileDir(code: string): string {
  const dir = path.join(root, safeMeetingCode(code));
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    // Fallback to /tmp directly if os.tmpdir() had any issue
    const fallback = path.join('/tmp', 'meeting-files', safeMeetingCode(code));
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
  return dir;
}

export function removeMeetingFiles(code: string) {
  const safe = safeMeetingCode(code);
  const dirs = [
    path.join(root, safe),
    path.join('/tmp', 'meeting-files', safe),
  ];
  for (const dir of dirs) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (_) {}
  }
}

export function newFileId(originalName: string): { id: string; storedName: string } {
  const ext = path.extname(originalName).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10);
  const id = crypto.randomBytes(12).toString('hex');
  return { id, storedName: `${id}${ext}` };
}

export function resolveMeetingFile(code: string, fileId: string): string | null {
  const safeId = fileId.replace(/[^a-zA-Z0-9]/g, '');
  const safe = safeMeetingCode(code);
  const dirs = [
    path.join(root, safe),
    path.join('/tmp', 'meeting-files', safe),
  ];
  for (const dir of dirs) {
    try {
      if (fs.existsSync(dir)) {
        const match = fs.readdirSync(dir).find((name) => name.startsWith(safeId));
        if (match) return path.resolve(dir, match);
      }
    } catch (_) {}
  }
  return null;
}
