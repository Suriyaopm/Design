// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const URL = 'file:///' + path.resolve(__dirname, '..', 'college-prototype.html').replace(/\\/g, '/');
const PAGES = {
  home: 'Rooted in 1921.',
  about: 'A hundred and five years in Tambaram',
  academics: 'How study works at Marudham',
  programmes: 'Programmes offered',
  departments: 'Departments',
  faculty: 'Faculty directory',
  syllabus: 'Syllabus & regulations',
  admission: 'Admissions 2027–28',
  library: 'Centenary Library',
  placement: 'Career Development & Placement Cell',
  achievements: 'Achievements',
  gallery: 'Gallery',
  alumni: 'Marudham Alumni Association',
  helpdesk: 'Help Desk',
  contact: 'Contact & directions',
};

/** Open a page of the prototype and collect console errors. */
async function open(page, hash = 'home') {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(m.text()); });
  // Google Fonts is an external dependency that can be slow on some networks; stub it so timing stays deterministic.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.goto(URL + '#' + hash, { waitUntil: 'domcontentloaded' });
  return errors;
}
const visiblePage = page => page.locator('.page:not([hidden])');
const isMobile = testInfo => testInfo.project.name === 'mobile';

test.describe('Loading and layout', () => {
  test('home loads without script errors', async ({ page }) => {
    const errors = await open(page);
    await expect(page).toHaveTitle('Marudham College Website');
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
      // every image on the visible page has actually loaded
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
      const r = e.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(e).lineHeight) || 22;
      return { t: e.textContent.trim(), top: Math.round(r.top), h: Math.round(r.height), lines: Math.round(e.scrollHeight / lh) };
    }));
    expect(boxes.length).toBe(10);
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
    for (const hash of ['about', 'admission', 'library', 'placement', 'achievements', 'helpdesk', 'contact', 'home']) {
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
    for (const hash of ['programmes', 'departments', 'faculty', 'syllabus', 'academics']) {
      await acad.hover();
      await acad.locator(`.submenu a[href="#${hash}"]`).click();
      await expect(visiblePage(page)).toHaveAttribute('data-page', hash);
      await expect(acad.locator('button')).toHaveClass(/on/);
    }
    const camp = page.locator('.menu > li[data-group="campus"]');
    for (const hash of ['gallery', 'alumni']) {
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

  test('admissions marquee is visible, scrolling and links to Admission', async ({ page }) => {
    await open(page);
    const strip = page.locator('.admit');
    await expect(strip).toBeVisible();
    await expect(strip.locator('.tag')).toHaveText(/Admissions Open/i);
    await expect(page.locator('#admitRun span').first()).toContainText('Admissions open for 2027–28');
    const anim = await page.locator('#admitRun').evaluate(e => getComputedStyle(e).animationName);
    expect(anim).toBe('run');
    const x1 = await page.locator('#admitRun').evaluate(e => new DOMMatrix(getComputedStyle(e).transform).m41);
    await page.waitForTimeout(800);
    const x2 = await page.locator('#admitRun').evaluate(e => new DOMMatrix(getComputedStyle(e).transform).m41);
    expect(x2).toBeLessThan(x1);
  });

  test('theme toggle switches between light and dark', async ({ page }) => {
    await open(page);
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const before = await bg();
    await page.locator('#themeBtn').click();
    const t1 = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(['dark', 'light']).toContain(t1);
    expect(await bg()).not.toBe(before);
    await page.locator('#themeBtn').click();
    expect(await bg()).toBe(before);
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
    // after the wrap the track rests on a real slide, not off-screen
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

  test('all four slide photos load', async ({ page }) => {
    await open(page);
    const ok = await page.locator('#track .slide img').evaluateAll(imgs => Promise.all(imgs.map(async i => { await i.decode().catch(() => {}); return i.naturalWidth > 0; })));
    expect(ok.length).toBe(5); // 4 slides + loop clone
    expect(ok.every(Boolean)).toBe(true);
  });
});

test.describe('Gallery lightbox', () => {
  test('opens a photo, steps through it and closes with the X button', async ({ page }) => {
    await open(page, 'gallery');
    await page.locator('#galGrid .gtile').first().click();
    const lb = page.locator('#lightbox');
    await expect(lb).toBeVisible();
    await expect(page.locator('#lbCount')).toHaveText('1 / 16');
    await page.locator('#lbNext').click();
    await expect(page.locator('#lbCount')).toHaveText('2 / 16');
    await page.locator('#lbPrev').click();
    await page.locator('#lbPrev').click();
    await expect(page.locator('#lbCount')).toHaveText('16 / 16');
    expect(await page.locator('#lbImg').evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true);
    await page.locator('#lbClose').click();
    await expect(lb).toBeHidden();
  });

  test('closes with Escape and by clicking the backdrop', async ({ page }) => {
    await open(page, 'gallery');
    await page.locator('#galGrid .gtile').nth(2).click();
    await expect(page.locator('#lightbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).toBeHidden();
    await page.locator('#galGrid .gtile').nth(2).click();
    await page.mouse.click(8, 300);
    await expect(page.locator('#lightbox')).toBeHidden();
  });

  test('filters by category', async ({ page }) => {
    await open(page, 'gallery');
    await page.locator('#galSeg button[data-c="Sports"]').click();
    await expect(page.locator('#galGrid .gtile')).toHaveCount(2);
    await page.locator('#galGrid .gtile').first().click();
    await expect(page.locator('#lbCount')).toHaveText('1 / 2');
    await page.locator('#lbClose').click();
  });

  test('home gallery strip opens the same viewer', async ({ page }) => {
    await open(page);
    await page.locator('#homeGallery .gtile').first().click();
    await expect(page.locator('#lightbox')).toBeVisible();
    await expect(page.locator('#lbCount')).toHaveText('1 / 5');
    await page.locator('#lbClose').click();
    await expect(page.locator('#lightbox')).toBeHidden();
  });
});

test.describe('Academic pages', () => {
  test('programmes filter and search', async ({ page }) => {
    await open(page, 'programmes');
    const all = await page.locator('#progGrid .prog').count();
    expect(all).toBeGreaterThan(40);
    await page.locator('#progSeg button[data-l="PG"]').click();
    const pg = page.locator('#progGrid .prog');
    expect(await pg.count()).toBeLessThan(all);
    await expect(pg.locator('.chip').first()).toHaveText('PG');
    await page.locator('#progSeg button[data-l="all"]').click();
    await page.locator('#progQ').fill('chemistry');
    await expect(page.locator('#progGrid .prog')).toHaveCount(3);
    await page.locator('#progQ').fill('zzzz');
    await expect(page.locator('#progGrid')).toContainText('No programme matches');
  });

  test('departments: choose a department and filter by school', async ({ page }) => {
    await open(page, 'departments');
    await expect(page.locator('#deptName')).toHaveText('Department of Chemistry');
    await page.locator('#deptGrid [data-dept="ENG"]').click();
    await expect(page.locator('#deptName')).toHaveText('Department of English');
    await expect(page.locator('#deptGrid [data-dept="ENG"]')).toHaveClass(/sel/);
    await page.locator('#deptSeg button[data-s="Sciences"]').click();
    await expect(page.locator('#deptGrid .pcard')).toHaveCount(7);
    await page.locator('#deptBox a[data-fac]').click();
    await expect(visiblePage(page)).toHaveAttribute('data-page', 'faculty');
    await expect(page.locator('#facDept')).toHaveValue('ENG');
    await expect(page.locator('#facGrid .fac')).toHaveCount(3);
  });

  test('home department card opens that department', async ({ page }) => {
    await open(page);
    await page.locator('#homeDepts [data-dept="TAM"]').click();
    await expect(visiblePage(page)).toHaveAttribute('data-page', 'departments');
    await expect(page.locator('#deptName')).toHaveText('Department of Tamil');
  });

  test('faculty search and department filter', async ({ page }) => {
    await open(page, 'faculty');
    expect(await page.locator('#facGrid .fac').count()).toBe(27);
    await page.locator('#facQ').fill('machine learning');
    await expect(page.locator('#facGrid .fac')).toHaveCount(1);
    await expect(page.locator('#facGrid .fac h4')).toHaveText('Dr. Deepa Nathan');
    await page.locator('#facQ').fill('');
    await page.locator('#facDept').selectOption('CHE');
    await expect(page.locator('#facGrid .fac')).toHaveCount(2);
    await expect(page.locator('#facCount')).toHaveText('2 faculty members shown');
  });

  test('syllabus filter, search and View PDF message', async ({ page }) => {
    await open(page, 'syllabus');
    const total = await page.locator('#sylBody tr').count();
    await page.locator('#sylSeg button[data-l="UG"]').click();
    expect(await page.locator('#sylBody tr').count()).toBeLessThan(total);
    await page.locator('#sylQ').fill('Physics');
    await expect(page.locator('#sylBody tr')).toHaveCount(1);
    await page.locator('#sylBody .js-syl').click();
    await expect(page.locator('#toast')).toBeVisible();
    await expect(page.locator('#toast')).toContainText('B.Sc. Physics');
  });

  test('library catalogue search', async ({ page }) => {
    await open(page, 'library');
    await page.locator('#opacQ').fill('tamil');
    await expect(page.locator('#opacRes > div')).toHaveCount(1);
    await page.locator('#opacQ').fill('ecology');
    await expect(page.locator('#opacRes > div')).toHaveCount(2);
    await page.locator('#opacQ').fill('qqqq');
    await expect(page.locator('#opacRes')).toContainText('No records');
  });

  test('achievements filter', async ({ page }) => {
    await open(page, 'achievements');
    await expect(page.locator('#achGrid .pcard')).toHaveCount(12);
    await page.locator('#achSeg button[data-c="Research"]').click();
    await expect(page.locator('#achGrid .pcard')).toHaveCount(3);
  });
});

test.describe('Admission and forms', () => {
  test('admission countdown and section jump links', async ({ page }) => {
    await open(page, 'admission');
    await expect(page.locator('#countdown b').first()).toHaveText(/^\d{2,3}$/);
    await page.locator('.subnav a[data-jump="ad-fees"]').click();
    await expect(page.locator('#ad-fees')).toBeInViewport();
  });

  test('admission form validates, then confirms', async ({ page }) => {
    await open(page, 'admission');
    const form = page.locator('#admForm');
    await form.locator('button[type="submit"]').click();
    await expect(form.locator('.form-ok')).toBeHidden(); // required fields block submit
    await page.fill('#ad-name', 'Test Student');
    await page.fill('#ad-phone', '9876543210');
    await page.fill('#ad-email', 'student@example.com');
    await page.selectOption('#ad-prog', 'B.Sc. Physics');
    await form.locator('button[type="submit"]').click();
    await expect(form.locator('.form-ok')).toBeVisible();
    await expect(form.locator('.form-ok')).toContainText('Your interest is recorded');
  });

  test('help desk ticket gets a ticket number', async ({ page }) => {
    await open(page, 'helpdesk');
    await expect(page.locator('#hdGrid .hd-cat')).toHaveCount(8);
    await page.fill('#hd-name', 'Parent');
    await page.selectOption('#hd-cat', 'Scholarships');
    await page.fill('#hd-msg', 'When is the renewal deadline?');
    await page.locator('#hdForm button[type="submit"]').click();
    await expect(page.locator('#ticketId')).toHaveText(/^MCAS-HD-2026-\d{4}$/);
  });

  test('alumni and contact forms confirm', async ({ page }) => {
    await open(page, 'alumni');
    await page.fill('#al-name', 'Old Student');
    await page.fill('#al-batch', '2010');
    await page.fill('#al-email', 'alum@example.com');
    await page.locator('#alForm button[type="submit"]').click();
    await expect(page.locator('#alForm .form-ok')).toBeVisible();
    await page.goto(URL + '#contact', { waitUntil: 'domcontentloaded' });
    await page.fill('#ct-name', 'Visitor');
    await page.fill('#ct-email', 'v@example.com');
    await page.fill('#ct-msg', 'Visiting hours?');
    await page.locator('#ctForm button[type="submit"]').click();
    await expect(page.locator('#ctForm .form-ok')).toBeVisible();
  });

  test('FAQ accordions expand', async ({ page }) => {
    await open(page, 'admission');
    const d = page.locator('#ad-faq details').first();
    await expect(d).not.toHaveAttribute('open', '');
    await d.locator('summary').click();
    await expect(d).toHaveAttribute('open', '');
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
