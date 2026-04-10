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
  assert.ok(html.includes('NEW PATCH'));
  assert.ok(html.includes('这版更野了，你先别急着破防'));
  assert.ok(html.includes('我们往里塞了 20 道更缺德的题，补了 4 个更稀有的隐藏人格，还把结果页改得更适合你截图发群。'));
  assert.ok(html.includes('新增 20 道狠题'));
  assert.ok(html.includes('比之前更敢问，也更像在偷看你的聊天记录。'));
  assert.ok(html.includes('新增 4 个隐藏人格'));
  assert.ok(html.includes('不是谁都能测出来，测到就赶紧截图，不然别人不信。'));
  assert.ok(html.includes('结果页更适合发群'));
  assert.ok(html.includes('现在不只是出结果，还顺手给你递刀子和配文。'));
  assert.ok(
    html.indexOf('版本升级 / 我们新增了什么') < html.indexOf('CT 程序定制工作室'),
    'expected the upgrade panel to appear before the studio promo'
  );
  assert.ok(existsSync(qrPath));
  await access(qrPath);
  assert.ok(html.includes('height: auto;'));
  assert.ok(!html.includes('aspect-ratio: 1 / 1;'));
  assert.ok(!html.includes('object-fit: cover;'));
});
