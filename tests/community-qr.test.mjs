import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const qrPath = path.join(rootDir, 'image', 'community-group-qr.jpg');
const expectedSha256 = 'F8C55F52E8BD85DA9901B43FF20DF86105D52BE7A090D2B080E6BA2C8805FABF';

function sha256(filePath) {
  return createHash('sha256')
    .update(readFileSync(filePath))
    .digest('hex')
    .toUpperCase();
}

test('community QR image matches the latest supplied asset', () => {
  assert.equal(sha256(qrPath), expectedSha256);
});
