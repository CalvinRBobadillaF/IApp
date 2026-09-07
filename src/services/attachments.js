export const MAX_FILES = 4;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set('txt md csv tsv json jsonl js jsx ts tsx py css scss html xml yaml yml sql sh ps1 c cpp h cs java rs go rb php swift kt r log toml ini'.split(' '));
const MIME_BY_EXTENSION = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
export const ACCEPTED_FILE_TYPES = [...Object.keys(MIME_BY_EXTENSION), ...TEXT_EXTENSIONS].map(ext => `.${ext}`).join(',');

export function validateFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (!file.size) throw new Error(`${file.name} is empty.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} exceeds the 5 MB limit.`);
  if (file.name.length > 180) throw new Error('Use a filename of 180 characters or less.');
  const mime = MIME_BY_EXTENSION[extension] || (TEXT_EXTENSIONS.has(extension) ? 'text/plain' : null);
  if (!mime) throw new Error(`${file.name}: use PDF, PNG, JPEG, WEBP, or a UTF-8 text/code file. Export Word as PDF and spreadsheets as CSV.`);
  return mime;
}

export async function readAttachment(file) {
  const mime_type = validateFile(file);
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return { id: crypto.randomUUID(), name: file.name, mime_type, size: file.size, data };
}
