// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const URL = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const MAP_LINK = 'https://maps.app.goo.gl/oxEk7jyK31JKqSwg8';
const PAGES = {
  home: 'St. Mary’s College of Education & Research Institute',
  about: 'About St. Mary’s',
  academics: 'Academics at St. Mary’s',
  programmes: 'Course offered',
  departments: 'Departments',
  faculty: 'Faculty',
  syllabus: 'B.Ed. syllabus',
  admission: 'Admission & fee',
  library: 'Library',
  placement: 'Guidance & Placement Cell',
  achievements: 'Achievements',
  gallery: 'Gallery',
  alumni: 'Alumni Association',
  helpdesk: 'Help Desk',
  contact: 'Contact us',
};

/** Open a page of the prototype and collect console errors. */
async function open(page, hash = 'home') {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|maps\.google/.test(m.text())) errors.push(m.text()); });
  // Google Fonts and the embedded Google Map are external; stub them so timing stays deterministic.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route(/maps\.google\.com/, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>map</p>' }));
  await page.goto(URL + '#' + hash, { waitUntil: 'domcontentloaded' });
  return errors;
}
const visiblePage = page => page.locator('.page:not([hidden])');
const isMobile = testInfo => testInfo.project.name === 'mobile';

test.describe('Loading and layout', () => {
  test('home loads without script errors', async ({ page }) => {
    const errors = await open(page);
    await expect(page).toHaveTitle("St. Mary's College of Education and Research Institute");
    await expect(visiblePage(page).locator('h1').first()).toContainText(PAGES.home);
    expect(errors).toEqual([]);
  });

  test('only one page is visible at a time and overlays start hidden', async ({ page }) => {
    await open(page);
    await expect(page.locator('.page:not([hidden])')).toHaveCount(1);
    await expect(page.locator('#lightbox')).toBeHidden();
    await expect(page.locator('#drawer')).toBeHidden();
    await expect(page.locator('#toast')).toBeHidden();
  });

  for (const [hash, heading] of Object.entries(PAGES)) {
    test(`page "${hash}" renders, has loaded photos and no horizontal scroll`, async ({ page }) => {
      const errors = await open(page, hash);
      const vp = visiblePage(page);
      await expect(vp).toHaveAttribute('data-page', hash);
      await expect(vp.locator('h1').first()).toContainText(heading);
      const broken = await vp.locator('img').evaluateAll(imgs => Promise.all(imgs.map(async i => {
        await i.decode().catch(() => {});
        return i.naturalWidth > 0 ? null : i.getAttribute('src');
      })).then(r => r.filter(Boolean)));
      expect(broken).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      expect(errors).toEqual([]);
    });
  }
});

test.describe('Header and navigation', () => {
  test('desktop menu items sit on one line and share the same height', async ({ page }, ti) => {
    test.skip(isMobile(ti), 'desktop menu only');
    await open(page);
    const boxes = await page.locator('.menu > li > a, .menu > li > button').evaluateAll(els => els.map(e => {
      const r = e.getBoundingClientRect();
      return { t: e.textContent.trim(), top: Math.round(r.top), h: Math.round(r.height) };
    }));
    expect(boxes.length).toBe(8);
    expect(new Set(boxes.map(b => b.top)).size).toBe(1);
    expect(new Set(boxes.map(b => b.h)).size).toBe(1);
    const wrapped = await page.locator('.menu > li > a, .menu > li > button').evaluateAll(els => els.filter(e => {
      const range = document.createRange(); range.selectNodeContents(e); return range.getClientRects().length > 2;
    }).map(e => e.textContent.trim()));
    expect(wrapped).toEqual([]);
  });

  test('every desktop menu link opens its page', async ({ page }, ti) => {
    test.skip(isMobile(ti), 'desktop menu only');
    await open(page);
    for (const hash of ['about', 'admission', 'placement', 'helpdesk', 'contact', 'home']) {
      await page.locator(`.menu a[data-nav="${hash}"]`).click();
      await expect(visiblePage(page)).toHaveAttribute('data-page', hash);
      await expect(page.locator(`.menu a[data-nav="${hash}"]`)).toHaveClass(/on/);
    }
  });

  test('Academics and Campus Life dropdowns open on hover and navigate', async ({ page }, ti) => {
    test.skip(isMobile(ti), 'desktop menu only');
    await open(page);
    const acad = page.locator('.menu > li[data-group="academics"]');
    await acad.hover();
    await expect(acad.locator('.submenu')).toBeVisible();
    for (const hash of ['programmes', 'departments', 'faculty', 'syllabus', 'library', 'academics']) {
      await acad.hover();
      await acad.locator(`.submenu a[href="#${hash}"]`).click();
      await expect(visiblePage(page)).toHaveAttribute('data-page', hash);
      await expect(acad.locator('button')).toHaveClass(/on/);
    }
    const camp = page.locator('.menu > li[data-group="campus"]');
    for (const hash of ['achievements', 'gallery', 'alumni']) {
      await camp.hover();
      await camp.locator(`.submenu a[href="#${hash}"]`).click();
      await expect(visiblePage(page)).toHaveAttribute('data-page', hash);
    }
  });

  test('mobile menu opens, navigates and closes', async ({ page }, ti) => {
    test.skip(!isMobile(ti), 'mobile only');
    await open(page);
    await expect(page.locator('.menu')).toBeHidden();
    await page.locator('#burger').click();
    await expect(page.locator('#drawer')).toBeVisible();
    await page.locator('#drawerClose').click();
    await expect(page.locator('#drawer')).toBeHidden();
    await page.locator('#burger').click();
    await page.locator('#drawer a[data-nav="library"]').click();
    await expect(page.locator('#drawer')).toBeHidden();
    await expect(visiblePage(page)).toHaveAttribute('data-page', 'library');
    await expect(page.locator('#mobTitle')).toHaveText('Library');
  });

  test('home is minimal: maroon slider band and Latest News strip carry the admission notice', async ({ page }) => {
    await open(page);
    await expect(page.locator('.admit')).toBeHidden();
    await expect(page.locator('.hero-band')).toBeVisible();
    await expect(page.locator('.newsbar .tag')).toHaveText(/Latest News/i);
    await expect(page.locator('#newsRun span').first()).toContainText('Admissions open for the B.Ed. programme');
    const band = await page.locator('.hero-band').evaluate(e => getComputedStyle(e).backgroundColor);
    expect(band).toBe('rgb(123, 28, 42)');
    expect(await page.locator('.newsbar').evaluate(e => getComputedStyle(e).backgroundColor)).toBe(band);
    expect(await page.locator('.topbar').evaluate(e => getComputedStyle(e).backgroundColor)).toBe(band);
  });

  test('admissions marquee is visible, scrolling and links to Admission', async ({ page }) => {
    await open(page, 'about');
    const strip = page.locator('.admit');
    await expect(strip).toBeVisible();
    await expect(strip.locator('.tag')).toHaveText(/Admissions Open/i);
    await expect(page.locator('#admitRun span').first()).toContainText('Admissions open for the B.Ed. programme');
    expect(await page.locator('#admitRun').evaluate(e => getComputedStyle(e).animationName)).toBe('run');
    const x1 = await page.locator('#admitRun').evaluate(e => new DOMMatrix(getComputedStyle(e).transform).m41);
    await page.waitForTimeout(800);
    const x2 = await page.locator('#admitRun').evaluate(e => new DOMMatrix(getComputedStyle(e).transform).m41);
    expect(x2).toBeLessThan(x1);
  });

  test('maroon is the default theme; the picker switches to teal and back, and remembers the choice', async ({ page }) => {
    await open(page);
    const band = () => page.locator('.hero-band').evaluate(e => getComputedStyle(e).backgroundColor);
    const teal = page.locator('.sw[data-palette="teal"]'), maroon = page.locator('.sw[data-palette="maroon"]');
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'maroon');
    await expect(maroon).toHaveAttribute('aria-pressed', 'true');
    await expect(teal).toHaveAttribute('aria-pressed', 'false');
    expect(await band()).toBe('rgb(123, 28, 42)');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 253, 249)');
    await teal.click();
    await expect(teal).toHaveAttribute('aria-pressed', 'true');
    expect(await band()).toBe('rgb(12, 140, 142)');
    expect(await page.locator('.topbar').evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(12, 140, 142)');
    // the visitor's choice survives a reload and applies to inner pages
    await page.goto(URL + '#about', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).not.toHaveAttribute('data-palette', /.+/);
    expect(await visiblePage(page).locator('.phead').evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(8, 106, 108)');
    await page.locator('.sw[data-palette="maroon"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'maroon');
    await expect.poll(() => page.locator('.btn-brand').first().evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(123, 28, 42)');
  });

  test('light theme only, even when the system prefers dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await open(page);
    await expect(page.locator('#themeBtn')).toHaveCount(0);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 253, 249)');
  });

  test('college name, logo and real contact details are shown', async ({ page }) => {
    await open(page);
    await expect(page.locator('.brandmark .nm')).toHaveText('St. Mary’s');
    await expect(page.locator('.brandmark .sub')).toContainText('College of Education & Research Institute');
    await expect(page.locator('.brandmark .sub')).toContainText('Chengalpattu');
    expect(await page.locator('.brandmark img.logo').evaluate(i => i.decode().then(() => i.naturalWidth > 0))).toBe(true);
    const f = page.locator('footer .fcontact');
    await expect(f).toContainText('G.S.T. Road, J.C.K. Nagar, Chengalpattu, Tamil Nadu – 603002');
    await expect(f).toContainText('044-2742 3507');
    await expect(f).toContainText('+91 90476 96006');
    await expect(f).toContainText('st.maryscoed.cpt@gmail.com');
    await expect(page.locator('.topbar')).toContainText('st.maryscoed.cpt@gmail.com');
    await expect(page.locator('footer')).toContainText('Love and Serve');
  });

  test('no private staff details are published', async ({ page }) => {
    await open(page);
    const html = await page.content();
    // Aadhaar numbers, dates of birth, approval order numbers and personal email ids from the source document
    for (const secret of ['646177487259', '522297712977', '781493677276', '836677079721', '21-01-1983', '13-02-1988', '06-11-2020', 'TNTEU/R/', 'sundarilayaathur', 'prem.navisjuly2', 'kppoorani', 'suriya.edu']) {
      expect(html).not.toContain(secret);
    }
    const emails = [...new Set(html.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}(?:\.[a-z]{2,})*/gi) || [])].filter(e => !/example\.com$/.test(e));
    expect(emails).toEqual(['st.maryscoed.cpt@gmail.com']);
  });
});

test.describe('Hero slider', () => {
  test('shows 01 / 04 and the arrows move between slides', async ({ page }) => {
    await open(page);
    await expect(page.locator('#slNow')).toHaveText('01');
    await expect(page.locator('#slTotal')).toHaveText('04');
    await page.locator('#slNext').click();
    await expect(page.locator('#slNow')).toHaveText('02');
    await page.locator('#slNext').click();
    await expect(page.locator('#slNow')).toHaveText('03');
    await page.locator('#slPrev').click();
    await expect(page.locator('#slNow')).toHaveText('02');
  });

  test('wraps from 04 to 01 and from 01 back to 04', async ({ page }) => {
    await open(page);
    await page.locator('#slPrev').click();
    await expect(page.locator('#slNow')).toHaveText('04');
    await page.waitForTimeout(1600);
    await page.locator('#slNext').click();
    await expect(page.locator('#slNow')).toHaveText('01');
    await page.waitForTimeout(1600);
    const tx = await page.locator('#track').evaluate(e => e.style.transform);
    expect(['translateX(0%)', 'translateX(-0%)', 'translateX(-400%)']).toContain(tx);
    await expect(page.locator('#track .slide.on img').first()).toBeVisible();
  });

  test('dots jump straight to a slide', async ({ page }, ti) => {
    test.skip(isMobile(ti), 'dots are hidden on phones');
    await open(page);
    await page.locator('#slDots button').nth(3).click();
    await expect(page.locator('#slNow')).toHaveText('04');
    await expect(page.locator('#slDots button').nth(3)).toHaveClass(/on/);
  });

  test('advances on its own every 5 seconds', async ({ page }) => {
    await open(page);
    await page.mouse.move(5, 5);
    await expect(page.locator('#slNow')).toHaveText('01');
    await expect(page.locator('#slNow')).toHaveText('02', { timeout: 8_000 });
    const t0 = Date.now();
    await expect(page.locator('#slNow')).toHaveText('03', { timeout: 8_000 });
    const gap = Date.now() - t0;
    expect(gap).toBeGreaterThan(4_300);
    expect(gap).toBeLessThan(6_000);
  });

  test('slider: college photo first, then three college photos, no text on them', async ({ page }) => {
    await open(page);
    const srcs = await page.locator('#track .slide:not([aria-hidden]) img.photo').evaluateAll(l => l.map(i => i.getAttribute('src')));
    expect(srcs).toEqual(['assets/img/college-front-sym.webp', 'assets/img/slide-convocation.webp', 'assets/img/slide-convocation-13.webp', 'assets/img/slide-classroom.webp']);
    const sizes = await page.locator('#track img.photo').evaluateAll(l => Promise.all(l.map(async i => { await i.decode().catch(() => {}); return i.naturalWidth; })));
    expect(sizes.every(w => w >= 1900)).toBe(true);
    // no visible caption text over the photos (the page heading is kept for screen readers only)
    const visibleText = await page.locator('#track .slide').evaluateAll(l => l.map(f => { const c = f.cloneNode(true); c.querySelectorAll('.sr-only').forEach(x => x.remove()); return c.textContent.trim(); }).filter(Boolean));
    expect(visibleText).toEqual([]);
    const ratio = await page.locator('#track .slide').first().evaluate(e => e.getBoundingClientRect().width / e.getBoundingClientRect().height);
    const want = page.viewportSize().width > 640 ? 3 : 1; // full 3:1 photo on desktop, square on phones
    expect(Math.abs(ratio - want)).toBeLessThan(0.05);
    await expect(page.locator('.hero .count')).toBeHidden(); // no 01 / 04 counter on screen
    const hb = await page.locator('#hero').evaluate(e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; });
    expect(hb).toEqual([0, page.viewportSize().width]); // slider runs edge to edge, no frame
    await expect(page.locator('#slNext')).toBeVisible();
  });
});

test.describe('Home page layout', () => {
  test('home flows: slider, news, welcome, counters, motto, message, life, gallery, admission call band', async ({ page }) => {
    await open(page);
    await expect(page.locator('.quick')).toHaveCount(0); // quick-link box removed
    const order = await visiblePage(page).evaluate(p => [...p.children].map(c => c.id || c.className));
    expect(order).toEqual(['hero-band', 'newsbar', 'section', 'home-stats', 'mottoband', 'section alt', 'home-features', 'home-gallery', 'home-admit']);
    const f3 = page.locator('#home-features .f3');
    await expect(f3).toHaveCount(3);
    await expect(f3.locator('.f3-h')).toHaveText(['Life at St. Mary’s', 'Library & Learning', 'Faculty & Mentoring']);
    await f3.nth(1).click();
    await expect(visiblePage(page)).toHaveAttribute('data-page', 'library');
    await page.goto(URL + '#academics', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#lifeGrid .hd-cat')).toHaveCount(6); // the six activity cards now live on Academics
    await page.goto(URL + '#home', { waitUntil: 'domcontentloaded' });
    const cta = page.locator('#home-admit');
    await expect(cta).toContainText('st.maryscoed.cpt@gmail.com');
    await expect(cta).toContainText('Admissions open');
    await expect(cta.locator('a[href="tel:+919047696006"]')).toBeVisible();
  });
});

test.describe('Principal and admission photos', () => {
  test('principal shows a placeholder photo; admission banner uses the college corridor photo', async ({ page }) => {
    await open(page);
    const pr = page.locator('img.portrait-img');
    await expect(pr).toHaveAttribute('src', 'assets/img/principal-placeholder.svg');
    expect(await pr.evaluate(i => i.decode().then(() => i.naturalWidth > 0))).toBe(true);
    const box = await pr.evaluate(e => { const r = e.getBoundingClientRect(); return r.height / r.width; });
    expect(Math.abs(box - (page.viewportSize().width > 640 ? 1.25 : 1))).toBeLessThan(0.05); // 4:5 on desktop, round on phones; never stretched
    const wel = page.locator('.collage img').first();
    await expect(wel).toHaveAttribute('src', 'assets/img/welcome-classroom.webp');
    const wr = await wel.evaluate(e => { const r = e.getBoundingClientRect(); return r.width / r.height; });
    expect(Math.abs(wr - 4 / 3)).toBeLessThan(0.05);
    const ad = page.locator('#home-admit .as-photo img');
    await expect(ad).toHaveAttribute('src', 'assets/img/admit-campus.webp');
    expect(await ad.evaluate(i => i.decode().then(() => i.naturalWidth))).toBe(1800);
  });
});

test.describe('Animated counters', () => {
  test('numbers start at 0 and count up to the real figures when the band scrolls into view', async ({ page }) => {
    await open(page);
    const band = page.locator('#home-stats');
    const nums = band.locator('.num');
    await expect(nums).toHaveCount(4);
    const seen = await band.evaluate(e => { const r = e.getBoundingClientRect(); return Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top)) / r.height; });
    expect(seen).toBeLessThan(0.4); // counting starts only once 40% of the band is on screen
    expect(await nums.allTextContents()).toEqual(['0', '0', '0', '0']); // nothing counted before the visitor arrives
    await band.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const mid = (await nums.allTextContents()).map(Number);
    expect(mid.some(v => v > 0)).toBe(true); // counting has started
    const t0 = Date.now();
    await expect(band).toHaveAttribute('data-done', '1', { timeout: 6000 });
    expect(Date.now() - t0).toBeGreaterThan(1200); // the count runs for about 2 seconds
    const years = String(new Date().getFullYear() - 2008);
    expect(await nums.allTextContents()).toEqual([years, '8', '20', '16']);
    const shown = await band.locator('.cnt strong').allTextContents();
    expect(shown).toEqual([years + '+', '8', '20+', '16']);
    await expect(band.locator('.lbl')).toHaveText(['Years of Service', 'Departments', 'Staff Members', 'Committees']);
    expect(await band.locator('img.sp-bg').evaluate(i => i.decode().then(() => i.naturalWidth))).toBe(2880); // college photo behind the numbers
  });

  test('counters show final values straight away for visitors who prefer reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    expect(await page.locator('#home-stats .num').allTextContents()).toEqual([String(new Date().getFullYear() - 2008), '8', '20', '16']);
  });
});

test.describe('Gallery albums', () => {
  const ALBUMS = { convocation: 56, celebrations: 8, inspection: 12, 'group-photos': 3, library: 11, campus: 6, teaching: 6 };

  test('gallery page lists all seven albums with their cover photos', async ({ page }) => {
    await open(page, 'gallery');
    const tiles = page.locator('#galGrid [data-album]');
    await expect(tiles).toHaveCount(7);
    expect(await tiles.evaluateAll(l => l.map(t => t.dataset.album))).toEqual(Object.keys(ALBUMS));
    await expect(page.locator('#galTotal')).toHaveText('7 albums · 102 photos');
    const ok = await tiles.locator('img').evaluateAll(l => Promise.all(l.map(i => i.decode().then(() => i.naturalWidth > 0, () => false))));
    expect(ok.every(Boolean)).toBe(true);
    await expect(page.locator('#galGrid [data-album="convocation"] .ov')).toContainText('56 photos');
  });

  test('album names appear only on hover, over a blurred photo', async ({ page }, ti) => {
    test.skip(isMobile(ti), 'hover is a desktop interaction');
    await open(page, 'gallery');
    const tile = page.locator('#galGrid [data-album="celebrations"]');
    await page.mouse.move(2, 2);
    expect(await tile.locator('.ov').evaluate(e => +getComputedStyle(e).opacity)).toBe(0);
    await tile.hover();
    await expect.poll(() => tile.locator('.ov').evaluate(e => +getComputedStyle(e).opacity)).toBe(1);
    await expect.poll(() => tile.locator('img').evaluate(e => getComputedStyle(e).filter)).toContain('blur');
    await expect(tile.locator('.ov b')).toHaveText('Celebrations');
  });

  test('opening an album shows every photo in it, and Back returns to the albums', async ({ page }) => {
    await open(page, 'gallery');
    for (const [id, n] of Object.entries(ALBUMS)) {
      await page.locator(`#galGrid [data-album="${id}"]`).click();
      await expect(page.locator('#galAlbum')).toBeVisible();
      await expect(page.locator('#albGrid .ph-t')).toHaveCount(n);
      await page.locator('#albBack').click();
      await expect(page.locator('#galAlbums')).toBeVisible();
    }
  });

  test('convocation album filters by 11th, 12th and 13th convocation', async ({ page }) => {
    await open(page, 'gallery');
    await page.locator('#galGrid [data-album="convocation"]').click();
    const tabs = page.locator('#albTabs button');
    await expect(tabs).toHaveText(['All', '11th Convocation', '12th Convocation', '13th Convocation']);
    for (const [sub, n] of [['11th', 4], ['12th', 23], ['13th', 26]]) {
      await page.locator(`#albTabs [data-sub="${sub}"]`).click();
      await expect(page.locator('#albGrid .ph-t')).toHaveCount(n);
      await expect(page.locator('#albTitle')).toHaveText(`Convocation · ${sub} Convocation`);
    }
    await page.locator('#albTabs [data-sub=""]').click();
    await expect(page.locator('#albGrid .ph-t')).toHaveCount(56);
    // albums without sub-sets have no tabs
    await page.locator('#albBack').click();
    await page.locator('#galGrid [data-album="library"]').click();
    await expect(page.locator('#albTabs')).toBeHidden();
  });

  test('a photo opens full size with caption and counter; arrows, X, Escape and backdrop work', async ({ page }) => {
    await open(page, 'gallery');
    expect(await page.locator('#galGrid [data-album="celebrations"] img').getAttribute('src')).toBe('assets/img/gallery/celebrations/celebrations-02-t.webp'); // Christmas stage photo is the cover
    await page.locator('#galGrid [data-album="celebrations"]').click();
    await page.locator('#albGrid .ph-t').first().click();
    const lb = page.locator('#lightbox');
    await expect(lb).toBeVisible();
    await expect(page.locator('#lbCount')).toHaveText('1 / 8');
    await expect(page.locator('#lbCap')).toHaveText('Christmas celebration');
    expect(await page.locator('#lbImg').evaluate(i => i.decode().then(() => i.naturalWidth >= 1000))).toBe(true); // full-size image, not the thumbnail
    await page.locator('#lbNext').click();
    await expect(page.locator('#lbCount')).toHaveText('2 / 8');
    await page.locator('#lbPrev').click();
    await page.locator('#lbPrev').click();
    await expect(page.locator('#lbCount')).toHaveText('8 / 8');
    await page.locator('#lbClose').click();
    await expect(lb).toBeHidden();
    await page.locator('#albGrid .ph-t').nth(2).click();
    await page.keyboard.press('Escape');
    await expect(lb).toBeHidden();
    await page.locator('#albGrid .ph-t').nth(2).click();
    await page.mouse.click(8, 300);
    await expect(lb).toBeHidden();
  });

  test('home shows five album covers; clicking one opens that album on the Gallery page', async ({ page }) => {
    await open(page);
    const sec = page.locator('#home-gallery');
    await expect(sec.locator('h2')).toHaveText(/Events Gallery/i);
    await expect(sec.locator('[data-album]')).toHaveCount(5);
    if (page.viewportSize().width > 900) {
      const w = await sec.locator('.ev').evaluateAll(l => l.map(e => Math.round(e.getBoundingClientRect().width)));
      expect(w[0]).toBe(w[1]);
      expect(w[0]).toBeGreaterThan(w[2] * 1.4);
    }
    await sec.locator('[data-album="inspection"]').click();
    await expect(visiblePage(page)).toHaveAttribute('data-page', 'gallery');
    await expect(page.locator('#galAlbum')).toBeVisible();
    await expect(page.locator('#albTitle')).toHaveText('Inspection');
    await expect(page.locator('#albGrid .ph-t')).toHaveCount(12);
    await page.goto(URL + '#home', { waitUntil: 'domcontentloaded' });
    await page.locator('#galMore').click();
    await expect(page.locator('#galAlbums')).toBeVisible();
  });

  test('no stock event photos are left in the gallery', async ({ page }) => {
    await open(page, 'gallery');
    const html = await page.content();
    expect(html).not.toContain('ev-graduation');
    expect(html).not.toContain('Graduation Day');
  });
});

test.describe('Academic pages', () => {
  test('course page shows the B.Ed. programme and its pedagogy subjects', async ({ page }) => {
    await open(page, 'programmes');
    await expect(page.locator('#bedCard h2')).toHaveText('Bachelor of Education (B.Ed.)');
    await expect(page.locator('#bedCard')).toContainText('2 years · 4 semesters');
    await expect(page.locator('#bedCard')).toContainText('Tamil Nadu Teachers Education University');
    await expect(page.locator('#pedagogy .chip')).toHaveText(['Tamil', 'English', 'Mathematics', 'Physical Science', 'Biological Science', 'Computer Science', 'History', 'Commerce']);
  });

  test('departments: eight departments, each with its own faculty', async ({ page }) => {
    await open(page, 'departments');
    await expect(page.locator('#deptGrid [data-dept]')).toHaveCount(8);
    await expect(page.locator('#deptName')).toHaveText('Department of Tamil');
    await expect(page.locator('#deptBox')).toContainText('Mrs. Josephine Kavitha. I');
    await page.locator('#deptGrid [data-dept="HIS"]').click();
    await expect(page.locator('#deptName')).toHaveText('Department of History');
    await expect(page.locator('#deptGrid [data-dept="HIS"]')).toHaveClass(/sel/);
    await expect(page.locator('#deptBox .fac')).toHaveCount(3);
    await page.locator('#deptBox a[data-fac]').click();
    await expect(visiblePage(page)).toHaveAttribute('data-page', 'faculty');
    await expect(page.locator('#facDept')).toHaveValue('History');
    await expect(page.locator('#facGrid .fac')).toHaveCount(3);
  });

  test('departments live on their own page, not on home', async ({ page }) => {
    await open(page);
    await expect(visiblePage(page).locator('[data-dept]')).toHaveCount(0);
    await page.goto(URL + '#departments', { waitUntil: 'domcontentloaded' });
    await expect(visiblePage(page)).toHaveAttribute('data-page', 'departments');
    await expect(page.locator('#deptGrid [data-dept]').first()).toBeVisible();
  });

  test('faculty: all 16 teachers with search, subject filter and non-teaching staff', async ({ page }) => {
    await open(page, 'faculty');
    await expect(page.locator('#facGrid .fac')).toHaveCount(16);
    await expect(page.locator('#facGrid .fac').first()).toContainText('Dr. Sundar. L');
    await expect(page.locator('#facGrid .fac').first()).toContainText('Principal');
    await page.locator('#facQ').fill('music');
    await expect(page.locator('#facGrid .fac')).toHaveCount(1);
    await expect(page.locator('#facGrid .fac h4')).toHaveText('Mrs. Selva Malar. A. G');
    await page.locator('#facQ').fill('');
    await page.locator('#facDept').selectOption('History');
    await expect(page.locator('#facGrid .fac')).toHaveCount(3);
    await expect(page.locator('#facCount')).toHaveText('3 teaching staff shown');
    await expect(page.locator('#staffGrid .fac')).toHaveCount(6);
    await expect(page.locator('#staffGrid')).toContainText('Rev. Sr. Sagaya Cruz');
  });

  test('syllabus shows all four semesters and filters by semester', async ({ page }) => {
    await open(page, 'syllabus');
    await expect(page.locator('#sylGrid .sem')).toHaveCount(4);
    await page.locator('#sylSeg button[data-s="1"]').click();
    await expect(page.locator('#sylGrid .sem')).toHaveCount(1);
    await expect(page.locator('#sylGrid .courses li')).toHaveCount(5);
    await expect(page.locator('#sylGrid')).toContainText('Educational Psychology');
    await page.locator('#sylSeg button[data-s="3"]').click();
    await expect(page.locator('#sylGrid')).toContainText('A2 – Micro Teaching Record');
    await expect(page.locator('#sylGrid')).toContainText('SWAYAM');
    await expect(page.locator('#sylGrid')).toContainText('Total marks: 500');
    await page.locator('#sylSeg button[data-s="4"]').click();
    await expect(page.locator('#sylGrid')).toContainText('Value and Peace Education');
  });

  test('library rules and college rules are listed', async ({ page }) => {
    await open(page, 'library');
    await expect(page.locator('#libRules li')).toHaveCount(6);
    await expect(page.locator('#libRules')).toContainText('three books');
    await page.goto(URL + '#academics', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#rules li')).toHaveCount(12);
    await expect(page.locator('#rules li').first()).toContainText('9.30 am');
  });

  test('about page carries the real vision, mission, leadership and committees', async ({ page }) => {
    await open(page, 'about');
    await expect(visiblePage(page)).toContainText('founded in 2008');
    await expect(page.locator('#ab-vision')).toContainText('Love and Serve');
    await expect(page.locator('#ab-vision')).toContainText('Spiritually oriented');
    await expect(page.locator('#ab-lead')).toContainText('Congregation of Sisters of St. Ann of Providence');
    await expect(page.locator('#ab-lead')).toContainText('Rev. Sr. Sagaya Cruz');
    await expect(page.locator('#committees .committee')).toHaveCount(16);
    await page.locator('.subnav a[data-jump="ab-emblem"]').click();
    await expect(page.locator('#ab-emblem')).toBeInViewport();
  });
});

test.describe('Admission, contact and forms', () => {
  test('admission shows real eligibility rules and minimum marks', async ({ page }) => {
    await open(page, 'admission');
    await expect(page.locator('#eligGrid .card')).toHaveCount(4);
    await expect(page.locator('#ad-marks tbody tr')).toHaveCount(4);
    await expect(page.locator('#ad-marks')).toContainText('MBC / DNC');
    await expect(page.locator('#ad-marks')).toContainText('43%');
    await page.locator('.subnav a[data-jump="ad-fees"]').click();
    await expect(page.locator('#ad-fees')).toBeInViewport();
  });

  test('there are no forms anywhere; visitors are pointed to phone and email instead', async ({ page }) => {
    await open(page);
    await expect(page.locator('form')).toHaveCount(0);
    await expect(page.locator('textarea')).toHaveCount(0);
    await expect(page.locator('input:not(#facQ)')).toHaveCount(0); // only the faculty search box remains
    await expect(page.locator('body')).not.toContainText('Register interest');
    await expect(page.locator('body')).not.toContainText('Online Application Form');
    for (const hash of ['admission', 'helpdesk']) {
      await page.goto(URL + '#' + hash, { waitUntil: 'domcontentloaded' });
      const tiles = visiblePage(page).locator('.reach-tile');
      await expect(tiles).toHaveCount(3);
      await expect(tiles.nth(0)).toHaveAttribute('href', 'tel:+914427423507');
      await expect(tiles.nth(1)).toHaveAttribute('href', 'tel:+919047696006');
      await expect(tiles.nth(2)).toHaveAttribute('href', 'mailto:st.maryscoed.cpt@gmail.com');
      await expect(tiles.nth(1)).toContainText('+91 90476 96006');
    }
    await page.goto(URL + '#contact', { waitUntil: 'domcontentloaded' });
    await expect(visiblePage(page).locator('a.tel[href="tel:+919047696006"]')).toHaveText('+91 90476 96006');
    await expect(visiblePage(page).locator('.reach-tile')).toHaveCount(0); // no duplicate tiles on Contact
    await page.goto(URL + '#alumni', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#al-join')).toContainText('Call or email the college office');
  });

  test('admission strip and header point to a phone call, not an online form', async ({ page }) => {
    await open(page, 'about');
    await expect(page.locator('.admit .btn')).toHaveAttribute('href', 'tel:+919047696006');
    await expect(page.locator('.admit .btn')).toHaveText('Call 90476 96006');
    await page.goto(URL + '#admission', { waitUntil: 'domcontentloaded' });
    await expect(visiblePage(page).locator('.phead a[href="tel:+919047696006"]')).toBeVisible();
    await page.locator('.subnav a[data-jump="ad-contact"]').click();
    await expect(page.locator('#ad-contact')).toBeInViewport();
  });

  test('the Google Map lives only on the Contact page', async ({ page }) => {
    await open(page);
    await expect(page.locator('#home-map')).toHaveCount(0);
    await expect(visiblePage(page).locator('iframe')).toHaveCount(0);
    await page.goto(URL + '#contact', { waitUntil: 'domcontentloaded' });
    const map = visiblePage(page).locator('iframe.mapframe');
    await expect(map).toBeVisible();
    expect(await map.getAttribute('src')).toContain('Chengalpattu');
    await expect(visiblePage(page).locator(`a[href="${MAP_LINK}"]`)).toBeVisible();
    await expect(page.locator('iframe.mapframe')).toHaveCount(1);
  });

  test('footer shows a small satellite map that opens Google Maps', async ({ page }) => {
    await open(page);
    const fm = page.locator('footer a.footmap');
    await expect(fm).toHaveAttribute('href', MAP_LINK);
    const src = await fm.locator('iframe').getAttribute('src');
    expect(src).toContain('t=k'); // satellite view
    expect(src).toContain('Chengalpattu');
    const h = await fm.evaluate(e => e.getBoundingClientRect().height);
    expect(h).toBeLessThan(200); // kept small
  });

  test('phones: counters over the campus photo are white', async ({ page }, ti) => {
    test.skip(!isMobile(ti), 'mobile only');
    await open(page);
    const c = await page.locator('#home-stats .cnt').evaluateAll(l => l.map(e => getComputedStyle(e.querySelector('strong')).color));
    expect(c[2]).toBe('rgb(255, 255, 255)');
    expect(c[3]).toBe('rgb(255, 255, 255)');
    expect(c[0]).not.toBe('rgb(255, 255, 255)'); // the top row sits on the light background
  });

  test('back-to-top button appears after scrolling and works', async ({ page }) => {
    await open(page);
    await expect(page.locator('#toTop')).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 2000));
    await expect(page.locator('#toTop')).toBeVisible();
    await page.locator('#toTop').click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(50);
  });
});
