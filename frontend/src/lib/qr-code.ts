/**
 * Gerador de QR Code em modo byte, sem dependências externas.
 *
 * Implementação mínima do padrão ISO/IEC 18004 para links de login.
 * Retorna um traçador SVG numérico; nenhum dado do usuário entra no HTML.
 */

const TOTAL_CODEWORDS = [
  0,
  26, 44, 70, 100, 134, 172, 196, 242, 292, 346,
  404, 466, 532, 581, 655, 733, 815, 901, 991, 1085,
  1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185,
  2323, 2465, 2611, 2761, 2876, 3034, 3196, 3362, 3532, 3706,
] as const;

const EC_BLOCKS = [
  1, 1, 1, 1,
  1, 1, 1, 1,
  1, 1, 2, 2,
  1, 2, 2, 4,
  1, 2, 4, 4,
  2, 4, 4, 4,
  2, 4, 6, 5,
  2, 4, 6, 6,
  2, 5, 8, 8,
  4, 5, 8, 8,
  4, 5, 8, 11,
  4, 8, 10, 11,
  4, 9, 12, 16,
  4, 9, 16, 16,
  6, 10, 12, 18,
  6, 10, 17, 16,
  6, 11, 16, 19,
  6, 13, 18, 21,
  7, 14, 21, 25,
  8, 16, 20, 25,
  8, 17, 23, 25,
  9, 17, 23, 34,
  9, 18, 25, 30,
  10, 20, 27, 32,
  12, 21, 29, 35,
  12, 23, 34, 37,
  12, 25, 34, 40,
  13, 26, 35, 42,
  14, 28, 38, 45,
  15, 29, 40, 48,
  16, 31, 43, 51,
  17, 33, 45, 54,
  18, 35, 48, 57,
  19, 37, 51, 60,
  19, 38, 53, 63,
  20, 40, 56, 66,
  21, 43, 59, 70,
  22, 45, 62, 74,
  24, 47, 65, 77,
  25, 49, 68, 81,
] as const;

const EC_CODEWORDS = [
  7, 10, 13, 17,
  10, 16, 22, 28,
  15, 26, 36, 44,
  20, 36, 52, 64,
  26, 48, 72, 88,
  36, 64, 96, 112,
  40, 72, 108, 130,
  48, 88, 132, 156,
  60, 110, 160, 192,
  72, 130, 192, 224,
  80, 150, 224, 264,
  96, 176, 260, 308,
  104, 198, 288, 352,
  120, 216, 320, 384,
  132, 240, 360, 432,
  144, 280, 408, 480,
  168, 308, 448, 532,
  180, 338, 504, 588,
  196, 364, 546, 650,
  224, 416, 600, 700,
  224, 442, 644, 750,
  252, 476, 690, 816,
  270, 504, 750, 900,
  300, 560, 810, 960,
  312, 588, 870, 1050,
  336, 644, 952, 1110,
  360, 700, 1020, 1200,
  390, 728, 1050, 1260,
  420, 784, 1140, 1350,
  450, 812, 1200, 1440,
  480, 868, 1290, 1530,
  510, 924, 1350, 1620,
  540, 980, 1440, 1710,
  570, 1036, 1530, 1800,
  570, 1064, 1590, 1890,
  600, 1120, 1680, 1980,
  630, 1204, 1770, 2100,
  660, 1260, 1860, 2220,
  720, 1316, 1950, 2310,
  750, 1372, 2040, 2430,
] as const;

const FORMAT_INFO_GENERATOR = 0b101_0011_0111;
const FORMAT_INFO_MASK = 0b101_0100_0001_0010;
const VERSION_INFO_GENERATOR = 0b1_1111_0010_0101;
const EC_FORMAT_BITS = 0b10;
const BYTE_MODE_BITS = 0b0100;
const DATA_MASK = 0;

interface QrCode {
  readonly path: string;
  readonly size: number;
}

interface BitBuffer {
  readonly bits: number[];
}

function createBitBuffer(): BitBuffer {
  return { bits: [] };
}

function putBits(buffer: BitBuffer, value: number, length: number): void {
  for (let index = length - 1; index >= 0; index -= 1) {
    buffer.bits.push((value >>> index) & 1);
  }
}

function padToByte(buffer: BitBuffer): void {
  while (buffer.bits.length % 8 !== 0) buffer.bits.push(0);
}

function bitsToBytes(buffer: BitBuffer): number[] {
  const bytes: number[] = [];

  for (let index = 0; index < buffer.bits.length; index += 8) {
    let value = 0;
    for (let offset = 0; offset < 8; offset += 1) {
      value = (value << 1) | buffer.bits[index + offset];
    }
    bytes.push(value);
  }

  return bytes;
}

function bitLength(value: number): number {
  let length = 0;
  let current = value >>> 0;
  while (current !== 0) {
    length += 1;
    current >>>= 1;
  }
  return length;
}

function bchRemainder(value: number, generator: number): number {
  let remainder = value >>> 0;
  const generatorLength = bitLength(generator);

  while (bitLength(remainder) >= generatorLength) {
    remainder ^= generator << (bitLength(remainder) - generatorLength);
  }

  return remainder >>> 0;
}

function formatInfo(mask: number): number {
  const data = (EC_FORMAT_BITS << 3) | mask;
  const remainder = bchRemainder(data << 10, FORMAT_INFO_GENERATOR);
  return ((data << 10) | remainder) ^ FORMAT_INFO_MASK;
}

function versionInfo(version: number): number {
  const data = version << 12;
  return data | bchRemainder(data, VERSION_INFO_GENERATOR);
}

function alignmentCoordinates(version: number): number[] {
  if (version === 1) return [];

  const count = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const interval =
    size === 145
      ? 26
      : Math.ceil((size - 13) / (2 * count - 2)) * 2;
  const positions = [size - 7];

  for (let index = 1; index < count - 1; index += 1) {
    positions[index] = positions[index - 1] - interval;
  }

  positions.push(6);
  return positions.reverse();
}

function errorCodewordCount(version: number): number {
  return EC_CODEWORDS[(version - 1) * 4 + 3];
}

function errorBlockCount(version: number): number {
  return EC_BLOCKS[(version - 1) * 4 + 3];
}

function byteCapacity(version: number): number {
  const dataCodewords =
    TOTAL_CODEWORDS[version] - errorCodewordCount(version);
  const countBits = version < 10 ? 8 : 16;
  return Math.floor((dataCodewords * 8 - 4 - countBits) / 8);
}

function selectVersion(byteLength: number): number {
  for (let version = 1; version <= 40; version += 1) {
    if (byteLength <= byteCapacity(version)) return version;
  }
  throw new Error('Conteúdo excede o limite do QR Code.');
}

function createGaloisField(): {
  readonly exp: (value: number) => number;
  readonly multiply: (left: number, right: number) => number;
} {
  const exponent = new Uint8Array(512);
  const logarithm = new Uint8Array(256);
  let value = 1;

  for (let index = 0; index < 255; index += 1) {
    exponent[index] = value;
    logarithm[value] = index;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }

  for (let index = 255; index < exponent.length; index += 1) {
    exponent[index] = exponent[index - 255];
  }

  return {
    exp: (power) => exponent[power],
    multiply: (left, right) => {
      if (left === 0 || right === 0) return 0;
      return exponent[logarithm[left] + logarithm[right]];
    },
  };
}

const galoisField = createGaloisField();

function multiplyPolynomials(
  left: readonly number[],
  right: readonly number[],
): number[] {
  const result = new Array<number>(left.length + right.length - 1).fill(0);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      result[leftIndex + rightIndex] ^=
        galoisField.multiply(left[leftIndex], right[rightIndex]);
    }
  }

  return result;
}

function reedSolomon(data: readonly number[], degree: number): number[] {
  let generator = [1];

  for (let index = 0; index < degree; index += 1) {
    generator = multiplyPolynomials(generator, [1, galoisField.exp(index)]);
  }

  const remainder = new Array<number>(degree).fill(0);

  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);

    for (let index = 0; index < degree; index += 1) {
      remainder[index] ^=
        galoisField.multiply(generator[index + 1], factor);
    }
  }

  return remainder;
}

function encodeData(text: string, version: number): number[] {
  const bytes = Array.from(new TextEncoder().encode(text));
  const dataCodewords = TOTAL_CODEWORDS[version] - errorCodewordCount(version);
  const buffer = createBitBuffer();

  putBits(buffer, BYTE_MODE_BITS, 4);
  putBits(buffer, bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) putBits(buffer, byte, 8);

  const capacity = dataCodewords * 8;
  if (buffer.bits.length + 4 <= capacity) putBits(buffer, 0, 4);
  padToByte(buffer);

  const data = bitsToBytes(buffer);
  let padIndex = 0;
  while (data.length < dataCodewords) {
    data.push(padIndex % 2 === 0 ? 0xec : 0x11);
    padIndex += 1;
  }

  return createCodewords(data, version);
}

function createCodewords(data: readonly number[], version: number): number[] {
  const totalCodewords = TOTAL_CODEWORDS[version];
  const totalErrorCodewords = errorCodewordCount(version);
  const dataCodewords = totalCodewords - totalErrorCodewords;
  const blockCount = errorBlockCount(version);
  const groupTwoCount = totalCodewords % blockCount;
  const groupOneCount = blockCount - groupTwoCount;
  const groupOneDataSize = Math.floor(dataCodewords / blockCount);
  const groupTwoDataSize = groupOneDataSize + 1;
  const errorCodewordsPerBlock =
    Math.floor(totalCodewords / blockCount) - groupOneDataSize;

  const dataBlocks: number[][] = [];
  const errorBlocks: number[][] = [];
  let offset = 0;

  for (let block = 0; block < blockCount; block += 1) {
    const size = block < groupOneCount ? groupOneDataSize : groupTwoDataSize;
    const blockData = data.slice(offset, offset + size);
    dataBlocks.push(blockData);
    errorBlocks.push(reedSolomon(blockData, errorCodewordsPerBlock));
    offset += size;
  }

  const result: number[] = [];
  const maxDataSize = Math.max(...dataBlocks.map((block) => block.length));

  for (let index = 0; index < maxDataSize; index += 1) {
    for (const block of dataBlocks) {
      if (index < block.length) result.push(block[index]);
    }
  }

  for (let index = 0; index < errorCodewordsPerBlock; index += 1) {
    for (const block of errorBlocks) result.push(block[index]);
  }

  return result;
}

function createMatrix(version: number, codewords: readonly number[]): {
  readonly modules: boolean[][];
  readonly reserved: boolean[][];
  readonly size: number;
} {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false),
  );
  const reserved = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false),
  );

  const set = (row: number, column: number, dark: boolean, isReserved = true) => {
    modules[row][column] = dark;
    if (isReserved) reserved[row][column] = true;
  };

  for (const [row, column] of [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ]) {
    for (let vertical = -1; vertical <= 7; vertical += 1) {
      for (let horizontal = -1; horizontal <= 7; horizontal += 1) {
        const targetRow = row + vertical;
        const targetColumn = column + horizontal;
        if (
          targetRow < 0 ||
          targetRow >= size ||
          targetColumn < 0 ||
          targetColumn >= size
        ) {
          continue;
        }

        const inFinder =
          vertical >= 0 &&
          vertical <= 6 &&
          horizontal >= 0 &&
          horizontal <= 6;
        const isDark =
          inFinder &&
          ((horizontal === 0 || horizontal === 6) ||
            (vertical === 0 || vertical === 6) ||
            (vertical >= 2 && vertical <= 4 && horizontal >= 2 && horizontal <= 4));
        set(targetRow, targetColumn, isDark);
      }
    }
  }

  for (let index = 8; index < size - 8; index += 1) {
    set(index, 6, index % 2 === 0);
    set(6, index, index % 2 === 0);
  }

  const alignment = alignmentCoordinates(version);
  for (let rowIndex = 0; rowIndex < alignment.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < alignment.length; columnIndex += 1) {
      if (
        (rowIndex === 0 && columnIndex === 0) ||
        (rowIndex === 0 && columnIndex === alignment.length - 1) ||
        (rowIndex === alignment.length - 1 && columnIndex === 0)
      ) {
        continue;
      }

      const centerRow = alignment[rowIndex];
      const centerColumn = alignment[columnIndex];
      for (let vertical = -2; vertical <= 2; vertical += 1) {
        for (let horizontal = -2; horizontal <= 2; horizontal += 1) {
          const isDark =
            vertical === -2 ||
            vertical === 2 ||
            horizontal === -2 ||
            horizontal === 2 ||
            (vertical === 0 && horizontal === 0);
          set(centerRow + vertical, centerColumn + horizontal, isDark);
        }
      }
    }
  }

  const writeFormatInfo = (mask: number) => {
    const bits = formatInfo(mask);
    for (let index = 0; index < 15; index += 1) {
      const dark = ((bits >>> index) & 1) === 1;

      if (index < 6) set(index, 8, dark);
      else if (index < 8) set(index + 1, 8, dark);
      else set(size - 15 + index, 8, dark);

      if (index < 8) set(8, size - index - 1, dark);
      else if (index < 9) set(8, 15 - index, dark);
      else set(8, 14 - index, dark);
    }
    set(size - 8, 8, true);
  };

  writeFormatInfo(DATA_MASK);

  if (version >= 7) {
    const bits = versionInfo(version);
    for (let index = 0; index < 18; index += 1) {
      const row = Math.floor(index / 3);
      const column = (index % 3) + size - 11;
      const dark = ((bits >>> index) & 1) === 1;
      set(row, column, dark);
      set(column, row, dark);
    }
  }

  let row = size - 1;
  let direction = -1;
  let byteIndex = 0;
  let bitIndex = 7;

  for (let column = size - 1; column > 0; column -= 2) {
    if (column === 6) column -= 1;

    while (true) {
      for (let offset = 0; offset < 2; offset += 1) {
        const targetColumn = column - offset;
        if (reserved[row][targetColumn]) continue;

        const dark =
          byteIndex < codewords.length &&
          (((codewords[byteIndex] >>> bitIndex) & 1) === 1);
        modules[row][targetColumn] = dark;

        bitIndex -= 1;
        if (bitIndex === -1) {
          byteIndex += 1;
          bitIndex = 7;
        }
      }

      row += direction;
      if (row < 0 || row >= size) {
        row -= direction;
        direction = -direction;
        break;
      }
    }
  }

  for (let maskRow = 0; maskRow < size; maskRow += 1) {
    for (let maskColumn = 0; maskColumn < size; maskColumn += 1) {
      if (!reserved[maskRow][maskColumn] && (maskRow + maskColumn) % 2 === 0) {
        modules[maskRow][maskColumn] = !modules[maskRow][maskColumn];
      }
    }
  }

  writeFormatInfo(DATA_MASK);

  return { modules, reserved, size };
}

function createPath(modules: readonly (readonly boolean[])[]): string {
  const commands: string[] = [];

  for (let row = 0; row < modules.length; row += 1) {
    for (let column = 0; column < modules[row].length; column += 1) {
      if (!modules[row][column]) continue;
      commands.push(`M${column} ${row}h1v1h-1z`);
    }
  }

  return commands.join('');
}

/** Cria QR Code seguro para renderização SVG inline. */
export function createQrCode(text: string): QrCode {
  if (!text) throw new Error('Conteúdo do QR Code vazio.');

  const bytes = new TextEncoder().encode(text).length;
  const version = selectVersion(bytes);
  const codewords = encodeData(text, version);
  const matrix = createMatrix(version, codewords);

  return {
    path: createPath(matrix.modules),
    size: matrix.size,
  };
}
