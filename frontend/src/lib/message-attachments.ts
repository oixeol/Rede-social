export const MAX_MESSAGE_ATTACHMENTS = 4;
export const MAX_MESSAGE_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_MESSAGE_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const MAX_MESSAGE_TOTAL_BYTES = 25 * 1024 * 1024;

export type MessageAttachmentKind = 'image' | 'file';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'rtf', 'txt', 'csv']);
const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/rtf',
  'text/plain',
  'text/csv',
]);

interface AttachmentFileLike {
  name: string;
  size: number;
  type: string;
}

function extensionOf(name: string): string {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? parts.at(-1) || '' : '';
}

/** Classifica arquivo pela extensão/MIME. Backend valida assinatura real. */
export function classifyMessageAttachment(file: AttachmentFileLike): MessageAttachmentKind | null {
  const mimeType = file.type.toLowerCase();
  const extension = extensionOf(file.name);

  if (mimeType === 'image/gif' || extension === 'gif') return null;
  if (IMAGE_MIME_TYPES.has(mimeType) || IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (DOCUMENT_MIME_TYPES.has(mimeType) || DOCUMENT_EXTENSIONS.has(extension)) return 'file';
  return null;
}

/** Valida limites de quantidade, tamanho individual e total. */
export function validateMessageAttachment(
  file: AttachmentFileLike,
  existing: ReadonlyArray<{ sizeBytes: number }> = [],
): string | null {
  const kind = classifyMessageAttachment(file);
  if (!kind) {
    return 'Formato não suportado. Use PNG, JPG, WEBP, PDF, DOC, DOCX, RTF, TXT ou CSV.';
  }
  if (existing.length >= MAX_MESSAGE_ATTACHMENTS) {
    return `Envie no máximo ${MAX_MESSAGE_ATTACHMENTS} anexos por mensagem.`;
  }
  const limit = kind === 'image' ? MAX_MESSAGE_IMAGE_BYTES : MAX_MESSAGE_DOCUMENT_BYTES;
  if (file.size > limit) {
    return kind === 'image'
      ? 'Imagem muito grande (limite de 8 MB).'
      : 'Documento muito grande (limite de 25 MB).';
  }
  const total = existing.reduce((sum, attachment) => sum + attachment.sizeBytes, 0) + file.size;
  if (total > MAX_MESSAGE_TOTAL_BYTES) {
    return 'Anexos grandes demais (limite total de 25 MB).';
  }
  return null;
}

/** Converte arquivo para payload JSON base64. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Não foi possível ler o arquivo.'));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
