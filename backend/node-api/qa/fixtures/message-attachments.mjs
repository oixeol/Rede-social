import { deflateRawSync, crc32 } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function makeDataUrl(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])) >>> 0, 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

/** PNG RGBA 1x1, estruturalmente válido e com CRC correto. */
export function pngBuffer(paddingBytes = 0) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const idat = deflateRawSync(Buffer.from([0, 255, 0, 0, 255]));
  const chunks = [
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
  ];
  if (paddingBytes > 0) {
    chunks.push(pngChunk('tEXt', Buffer.from('Comment\\0'.padEnd(paddingBytes, 'x'))));
  }
  chunks.push(pngChunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

export function pngDataUrl() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const idat = deflateRawSync(Buffer.from([0, 255, 0, 0, 255]));
  return makeDataUrl(pngBuffer(), 'image/png');
}

/** PDF mínimo válido para classificador estrutural do backend. */
export function pdfDataUrl() {
  const head = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n';
  const tail = '\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n';
  return makeDataUrl(Buffer.from(head + ' '.repeat(32) + tail), 'application/pdf');
}

function zipEntry(filename, contents) {
  const nameBuffer = Buffer.from(filename, 'utf8');
  const data = Buffer.from(contents);
  const header = Buffer.alloc(30);
  header.write('PK\x03\x04', 0, 4, 'ascii');
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(nameBuffer.length, 26);
  const local = Buffer.concat([header, nameBuffer, data]);

  const central = Buffer.alloc(46);
  central.write('PK\x01\x02', 0, 4, 'ascii');
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc32(data) >>> 0, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuffer.length, 28);
  central.writeUInt32LE(local.length, 42);
  return { local, central: Buffer.concat([central, nameBuffer]) };
}

/** DOCX mínimo: ZIP com Content Types e document.xml. */
export function docxDataUrl() {
  const first = zipEntry(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
  );
  const second = zipEntry(
    'word/document.xml',
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>',
  );
  const offset = first.local.length + second.local.length;
  const end = Buffer.alloc(22);
  end.write('PK\x05\x06', 0, 4, 'ascii');
  end.writeUInt16LE(2, 8);
  end.writeUInt16LE(2, 10);
  end.writeUInt32LE(first.central.length + second.central.length, 12);
  end.writeUInt32LE(offset, 16);
  const zip = Buffer.concat([
    first.local,
    second.local,
    first.central,
    second.central,
    end,
  ]);
  return makeDataUrl(zip, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

/** DOC OLE mínimo com streams esperados pelo classificador. */
export function docDataUrl() {
  const doc = Buffer.alloc(512);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(doc, 0);
  Buffer.from('WordDocument', 'utf16le').copy(doc, 64);
  Buffer.from('1Table', 'utf16le').copy(doc, 128);
  return makeDataUrl(doc, 'application/msword');
}

export function rtfDataUrl() {
  return makeDataUrl(Buffer.from('{\\rtf1\\ansi test}'), 'application/rtf');
}

export function txtDataUrl(contents = 'texto simples') {
  return makeDataUrl(Buffer.from(contents, 'utf8'), 'text/plain');
}

export function csvDataUrl(contents = 'a,b,c\n1,2,3') {
  return makeDataUrl(Buffer.from(contents, 'utf8'), 'text/csv');
}
