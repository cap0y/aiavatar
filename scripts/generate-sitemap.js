// ?숈쟻 ?ъ씠?몃㏊ ?앹꽦 ?ㅽ겕由쏀듃
// ?곗씠?곕쿋?댁뒪???곹뭹怨??щ━?먯씠?곕? 媛?몄???sitemap.xml ?앹꽦

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ?ъ씠??湲곕낯 URL (?섍꼍???곕씪 蹂寃?
const BASE_URL = process.env.SITE_URL || 'https://aiavatar.decomsoft.com';

// ?ㅻ뒛 ?좎쭨 (YYYY-MM-DD ?뺤떇)
const today = new Date().toISOString().split('T')[0];

// ?뺤쟻 ?섏씠吏 紐⑸줉
const staticPages = [
  { url: '/', priority: 1.0, changefreq: 'daily' },
  { url: '/chat', priority: 0.9, changefreq: 'weekly' },
  { url: '/shop', priority: 0.9, changefreq: 'daily' },
  { url: '/avatar-studio', priority: 0.8, changefreq: 'weekly' },
  { url: '/notices', priority: 0.7, changefreq: 'weekly' },
  { url: '/search', priority: 0.6, changefreq: 'monthly' },
  { url: '/support', priority: 0.6, changefreq: 'monthly' },
  { url: '/privacy', priority: 0.5, changefreq: 'monthly' },
  { url: '/profile', priority: 0.7, changefreq: 'weekly' },
  { url: '/cart', priority: 0.6, changefreq: 'daily' },
  { url: '/orders', priority: 0.6, changefreq: 'weekly' },
  { url: '/bookings', priority: 0.6, changefreq: 'weekly' },
  { url: '/favorites', priority: 0.5, changefreq: 'weekly' },
  { url: '/my-reviews', priority: 0.5, changefreq: 'weekly' },
  { url: '/my-inquiries', priority: 0.5, changefreq: 'weekly' },
  { url: '/payment-history', priority: 0.5, changefreq: 'weekly' },
  { url: '/notifications', priority: 0.5, changefreq: 'daily' },
];

// XML URL ?뷀듃由??앹꽦
function createUrlEntry(url, lastmod = today, changefreq = 'weekly', priority = 0.5) {
  return `  <url>
    <loc>${BASE_URL}${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

// ?숈쟻 ?섏씠吏 媛?몄삤湲?(?덉떆 - ?ㅼ젣濡쒕뒗 DB?먯꽌 媛?몄?????
async function getDynamicPages() {
  const dynamicPages = [];

  try {
    // TODO: ?ㅼ젣 援ы쁽 ???곗씠?곕쿋?댁뒪?먯꽌 媛?몄삤湲?    // ?덉떆: ?곹뭹 紐⑸줉
    const products = [
      { id: 1, updated_at: '2025-01-14' },
      { id: 2, updated_at: '2025-01-13' },
      { id: 3, updated_at: '2025-01-12' },
    ];

    products.forEach(product => {
      dynamicPages.push({
        url: `/product/${product.id}`,
        lastmod: product.updated_at,
        changefreq: 'weekly',
        priority: 0.8,
      });
    });

    // ?덉떆: ?щ━?먯씠??紐⑸줉
    const careManagers = [
      { id: 1, updated_at: '2025-01-14' },
      { id: 2, updated_at: '2025-01-13' },
    ];

    careManagers.forEach(manager => {
      dynamicPages.push({
        url: `/care-manager/${manager.id}`,
        lastmod: manager.updated_at,
        changefreq: 'weekly',
        priority: 0.8,
      });
    });
  } catch (error) {
    console.error('?숈쟻 ?섏씠吏 媛?몄삤湲??ㅽ뙣:', error);
  }

  return dynamicPages;
}

// ?ъ씠?몃㏊ XML ?앹꽦
async function generateSitemap() {
  console.log('?ъ씠?몃㏊ ?앹꽦 ?쒖옉...');

  // ?숈쟻 ?섏씠吏 媛?몄삤湲?  const dynamicPages = await getDynamicPages();
  
  // 紐⑤뱺 ?섏씠吏 ?⑹튂湲?  const allPages = [...staticPages, ...dynamicPages];

  // XML ?ㅻ뜑
  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

  // XML 蹂몃Ц
  const xmlBody = allPages
    .map(page => createUrlEntry(page.url, page.lastmod, page.changefreq, page.priority))
    .join('\n\n');

  // XML ?명꽣
  const xmlFooter = '\n</urlset>';

  // ?꾩꽦??XML
  const sitemap = xmlHeader + xmlBody + xmlFooter;

  // ?뚯씪濡????  const outputPath = path.join(__dirname, '../public/sitemap.xml');
  fs.writeFileSync(outputPath, sitemap, 'utf8');

  console.log(`???ъ씠?몃㏊ ?앹꽦 ?꾨즺: ${outputPath}`);
  console.log(`?뱤 珥?${allPages.length}媛??섏씠吏 ?ы븿`);
}

// ?ㅽ겕由쏀듃 ?ㅽ뻾
generateSitemap().catch(error => {
  console.error('???ъ씠?몃㏊ ?앹꽦 ?ㅽ뙣:', error);
  process.exit(1);
});
