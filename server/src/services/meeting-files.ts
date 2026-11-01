import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const root = path.join(process.cwd(), 'meeting-files');

export function safeMeetingCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9-]/g, '');
}

export function meetingFileDir(code: string): string {
  return path.join(root, safeMeetingCode(code));
}

export function removeMeetingFiles(code: string) {
  fs.rmSync(meetingFileDir(code), { recursive: true, force: true });
}

export function newFileId(originalName: string): { id: string; storedName: string } {
  const ext = path.extname(originalName).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10);
  const id = crypto.randomBytes(12).toString('hex');
  return { id, storedName: `${id}${ext}` };
}

export function resolveMeetingFile(code: string, fileId: string): string | null {
  const dir = meetingFileDir(code);
  if (!fs.existsSync(dir)) return null;
  const safeId = fileId.replace(/[^a-zA-Z0-9]/g, '');
  const match = fs.readdirSync(dir).find((name) => name.startsWith(safeId));
  if (!match) return null;
  return path.join(dir, match);
}
