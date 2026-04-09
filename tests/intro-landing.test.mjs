import { readFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(rootDir, 'index.html');
const qrPath = path.join(rootDir, 'image', 'community-group-qr.jpg');

const html = await readFile(htmlPath, 'utf8');

test('intro landing keeps the hero CTA and adds the CT promo block', async () => {
  assert.ok(html.includes('MBTI已经过时，SBTI来了。'));
  assert.ok(html.includes('<button id="startBtn" class="btn-primary">开始测试</button>'));
  assert.ok(html.includes('B站@蛆肉儿串儿'));
  assert.ok(!html.includes('托管：'));
  assert.ok(!html.includes('域名：'));
  assert.ok(html.includes('CT 程序定制工作室'));
  assert.ok(html.includes('https://ctikki.com'));
  assert.ok(html.includes('https://bazi.ctikki.com'));
  assert.ok(html.includes('https://resume.ctikki.com'));
  assert.ok(html.includes('产品福利交流群'));
  assert.ok(html.includes('community-group-qr.jpg'));
  assert.ok(existsSync(qrPath));
  await access(qrPath);
});
