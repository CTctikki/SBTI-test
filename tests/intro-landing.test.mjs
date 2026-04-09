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

function expectLinkMarkup(href) {
  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(
    html,
    new RegExp(`<a[^>]*href="${escapedHref}"[^>]*target="_blank"[^>]*rel="noreferrer"`),
  );
}

test('intro landing keeps the hero CTA and adds the CT promo block', async () => {
  assert.ok(html.includes('MBTI已经过时，SBTI来了。'));
  assert.ok(html.includes('<button id="startBtn" class="btn-primary">开始测试</button>'));
  assert.ok(html.includes('B站@蛆肉儿串儿'));
  assert.ok(!html.includes('托管：'));
  assert.ok(!html.includes('域名：'));
  assert.ok(html.includes('CT 程序定制工作室'));
  assert.ok(html.includes('产品福利交流群'));
  assert.ok(html.includes('image/community-group-qr.jpg'));
  assert.ok(html.includes('扫码失效时请前往'));
  assert.ok(html.includes('https://ctikki.com'));
  expectLinkMarkup('https://ctikki.com');
  expectLinkMarkup('https://bazi.ctikki.com');
  expectLinkMarkup('https://resume.ctikki.com');
  expectLinkMarkup('https://github.com/CTctikki/SBTI-test');
  assert.ok(html.includes('intro-github-link'));
  assert.ok(existsSync(qrPath));
  await access(qrPath);
  assert.ok(html.includes('height: auto;'));
  assert.ok(!html.includes('aspect-ratio: 1 / 1;'));
  assert.ok(!html.includes('object-fit: cover;'));
});
