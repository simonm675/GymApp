import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const publicDir = path.resolve(process.cwd(), 'public');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function createImage(width, height) {
  return new Uint8Array(width * height * 4);
}

function setPixel(buffer, width, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= width) {
    return;
  }
  const index = (y * width + x) * 4;
  buffer[index] = r;
  buffer[index + 1] = g;
  buffer[index + 2] = b;
  buffer[index + 3] = a;
}

function blendPixel(buffer, width, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= width) {
    return;
  }
  const index = (y * width + x) * 4;
  const existingA = buffer[index + 3] / 255;
  const alpha = a / 255;
  const outA = alpha + existingA * (1 - alpha);
  if (outA <= 0) {
    return;
  }
  const nr = (r * alpha + buffer[index] * existingA * (1 - alpha)) / outA;
  const ng = (g * alpha + buffer[index + 1] * existingA * (1 - alpha)) / outA;
  const nb = (b * alpha + buffer[index + 2] * existingA * (1 - alpha)) / outA;
  buffer[index] = Math.round(nr);
  buffer[index + 1] = Math.round(ng);
  buffer[index + 2] = Math.round(nb);
  buffer[index + 3] = Math.round(outA * 255);
}

function roundedRectMask(x, y, rect) {
  const { left, top, right, bottom, radius } = rect;
  const innerLeft = left + radius;
  const innerRight = right - radius;
  const innerTop = top + radius;
  const innerBottom = bottom - radius;

  if (x >= innerLeft && x <= innerRight && y >= top && y <= bottom) {
    return true;
  }
  if (y >= innerTop && y <= innerBottom && x >= left && x <= right) {
    return true;
  }

  const corners = [
    { cx: innerLeft, cy: innerTop },
    { cx: innerRight, cy: innerTop },
    { cx: innerLeft, cy: innerBottom },
    { cx: innerRight, cy: innerBottom }
  ];

  for (const corner of corners) {
    const dx = x - corner.cx;
    const dy = y - corner.cy;
    if (dx * dx + dy * dy <= radius * radius) {
      return true;
    }
  }
  return false;
}

function fillRoundedRect(buffer, width, height, rect, color) {
  const minX = Math.max(0, Math.floor(rect.left));
  const maxX = Math.min(width - 1, Math.ceil(rect.right));
  const minY = Math.max(0, Math.floor(rect.top));
  const maxY = Math.min(height - 1, Math.ceil(rect.bottom));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (roundedRectMask(x + 0.5, y + 0.5, rect)) {
        blendPixel(buffer, width, x, y, color.r, color.g, color.b, color.a ?? 255);
      }
    }
  }
}

function drawIcon(size) {
  const image = createImage(size, size);
  const bgA = hexToRgb('#FFB066');
  const bgB = hexToRgb('#FF6A00');

  const margin = size * 0.055;
  const rect = {
    left: margin,
    top: margin,
    right: size - margin,
    bottom: size - margin,
    radius: size * 0.22
  };

  const dx = rect.right - rect.left;
  const dy = rect.bottom - rect.top;
  const lengthSq = dx * dx + dy * dy;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!roundedRectMask(x + 0.5, y + 0.5, rect)) {
        continue;
      }
      const t = clamp((((x - rect.left) * dx) + ((y - rect.top) * dy)) / lengthSq, 0, 1);
      const r = Math.round(bgA.r + (bgB.r - bgA.r) * t);
      const g = Math.round(bgA.g + (bgB.g - bgA.g) * t);
      const b = Math.round(bgA.b + (bgB.b - bgA.b) * t);
      setPixel(image, size, x, y, r, g, b, 255);
    }
  }

  fillRoundedRect(image, size, size, rect, { r: 0, g: 0, b: 0, a: 20 });

  const white = { r: 247, g: 248, b: 250, a: 255 };
  const gray = { r: 216, g: 218, b: 223, a: 255 };

  const shapes = [
    { left: 0.197, top: 0.412, width: 0.088, height: 0.176, radius: 0.033, color: white },
    { left: 0.293, top: 0.381, width: 0.094, height: 0.238, radius: 0.033, color: white },
    { left: 0.395, top: 0.463, width: 0.211, height: 0.074, radius: 0.027, color: white },
    { left: 0.613, top: 0.381, width: 0.094, height: 0.238, radius: 0.033, color: white },
    { left: 0.715, top: 0.412, width: 0.088, height: 0.176, radius: 0.033, color: white },
    { left: 0.213, top: 0.428, width: 0.057, height: 0.145, radius: 0.023, color: gray },
    { left: 0.73, top: 0.428, width: 0.057, height: 0.145, radius: 0.023, color: gray }
  ];

  for (const shape of shapes) {
    fillRoundedRect(image, size, size, {
      left: shape.left * size,
      top: shape.top * size,
      right: (shape.left + shape.width) * size,
      bottom: (shape.top + shape.height) * size,
      radius: shape.radius * size
    }, shape.color);
  }

  return image;
}

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ -1) >>> 0;
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  const crcValue = crc32(Buffer.concat([typeBuffer, data]));
  crcBuffer.writeUInt32BE(crcValue >>> 0, 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0))
  ]);
}

function writeIcon(size, name) {
  const pixels = drawIcon(size);
  const png = encodePng(size, size, pixels);
  fs.writeFileSync(path.join(publicDir, name), png);
}

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

writeIcon(180, 'apple-touch-icon.png');
writeIcon(192, 'icon-192.png');
writeIcon(512, 'icon-512.png');