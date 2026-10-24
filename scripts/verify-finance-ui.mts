/**
 * Drives the finance suite in a real browser: loads every tab, edits values
 * inline, and confirms the derived totals actually move. Catches what a type
 * check and an API test can't — client-side crashes, broken commit-on-blur, and
 * totals that don't refresh.
 *
 * Run against a dev server with a seeded database:
 *   BASE=http://10.0.0.253:3399 ADMIN_PASSWORD=testpw npx tsx scripts/verify-finance-ui.mts
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://10.0.0.253:3399';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'testpw';

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
// A dev server compiles each route on first hit, which can take a while after an
// edit. Generous default so the suite isn't flaky for a reason that isn't a bug.
page.setDefaultTimeout(90_000);

const consoleErrors: string[] = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
// Deletes go through window.confirm; Playwright dismisses dialogs by default,
// which would silently turn every delete into a no-op.
page.on('dialog', (d) => d.accept());

// --- log in ---
await page.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
await page.fill('input[type="password"]', PASSWORD);
// Wait on the auth response rather than the client-side redirect that follows
// it — the redirect fires no `load` event, so waiting for navigation is flaky.
await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.status() === 200),
    page.click('button[type="submit"]'),
]);
await page.waitForTimeout(500);

// --- overview ---
await page.goto(`${BASE}/admin/finances`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector("text=Общий бюджет", { timeout: 20_000 });
const body = async () => (await page.textContent('body')) ?? '';
/** Editable names live in <input value=...>, which textContent never sees. */
const inputValues = async () =>
    page.locator('input').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
/** The grid row that owns a given delete button. */
const rowFor = (name: string) =>
    page.locator('div.grid').filter({ has: page.locator(`button[aria-label="Удалить ${name}"]`) }).first();

console.log('\n--- Overview ---');
let text = await body();
check('budget total shown', text.includes("$33 046,26"), 'expected seeded total');
check('paid-toward-budget shown', text.includes("$20 893,00"), 'budgeted 14,693 + gift 6,200');
check('own budgeted spend shown', text.includes("$14 693,00"));
check('bill still owed shown', text.includes("$12 153,26"),
    'must equal the sum of the section remainders');
check('off-budget spending called out', text.includes("расходов не привязано к бюджету"));
check('gift money shown', text.includes("$6 880,00"));
check('both payers listed', text.includes('Austin') && text.includes('Heaven'));
check('category breakdown', text.includes('Venue Cost') && text.includes('Staff And Extras'));
check('section progress shown', text.includes("Оплата по разделам") && text.includes("% оплачено"));
check('venue section payments counted', text.includes("3 частичных платежа"), '2 own + Rob gift');
check('gift money badged on section', text.includes("🎁 $5 000,00"));
check('no bogus venue line overrun', !text.includes("+$5 180,00"),
    'installments belong to the section, not the $4,500 line');

// Scenario toggle must change the figures.
await page.click("text=С учётом обещаний");
await page.waitForTimeout(200);
const pledgedText = await body();
check('scenario toggle changes numbers', pledgedText !== text && pledgedText.includes("$17 880,00"));
await page.click("text=Полученные деньги");

console.log('\n--- Budget tab ---');
await page.click("button:has-text(\"Бюджет\")");
await page.waitForSelector("text=Добавить статью", { timeout: 10_000 });
text = await body();
let values = await inputValues();
check('all three sections render',
    ['Venue Cost', 'Staff And Extras', 'Other'].every((s) => values.includes(s)),
    `sections found: ${values.filter((v) => ['Venue Cost', 'Staff And Extras', 'Other'].includes(v)).join(', ')}`);
check('line item names render',
    ['Venue', 'Appetizers', 'Dinner', 'Photographer', 'Rehearsal Dinner'].every((n) => values.includes(n)));
check('27 line items present', (await page.locator('button[aria-label^="Удалить "]').count()) >= 27,
    `${await page.locator('button[aria-label^="Удалить "]').count()} delete buttons`);
check('appetizers shows "from parts"', text.includes("из составляющих"));
check('derived qty renders 124', text.includes('124'));

// Section-level paid-vs-budgeted controls.
check('section footer present', text.includes("Оплачено по разделу"));
check('section budgeted figure', text.includes("$18 358,90"));
check('section paid includes gift money', text.includes("$14 680,00"), 'Rob 5,000 counted');
check('section still owed', text.includes("$3 678,90"));
check('own vs gift split shown', text.includes("$9 680,00 ваши средства и $5 000,00 денежные подарки"));
check('installments listed', values.includes('Venue 2/4') && values.includes('Venue Payment'));
check('gift payment listed in section', values.includes('Venue 1/4'));
check('payments subtotal', text.includes("Итого платежей"));
check('log installment control', text.includes("Добавить частичный платёж"));

// --- drag and drop: the only way to reorder a line ---
// Driven through real pointer events rather than a synthetic drop, because what
// is being tested is the sensor wiring: a handle that does not respond to a
// press-move-release is a handle that does not work, however correct the
// arithmetic behind it.
{
    const handles = page.locator("button[aria-label^=\"Изменить порядок: \"]");
    check('every line has a drag handle', (await handles.count()) >= 27,
        `${await handles.count()} handles`);

    /** The line names of the first section, in the order they are drawn. */
    const firstSectionNames = async () =>
        (await page.locator("button[aria-label^=\"Изменить порядок: \"]").evaluateAll(
            (els) => els.map((e) => (e.getAttribute('aria-label') ?? '').replace("Изменить порядок: ", '')),
        )).slice(0, 7);

    const before = await firstSectionNames();
    const from = handles.nth(0);
    const to = handles.nth(2);
    const a = await from.boundingBox();
    const b = await to.boundingBox();
    if (!a || !b) {
        check('drag handles are on screen', false, 'no bounding box');
    } else {
        await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
        await page.mouse.down();
        // Past the 6px activation threshold first, then to the target in steps —
        // dnd-kit tracks movement, so a single jump registers as no drag at all.
        await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 10, { steps: 4 });
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 4, { steps: 12 });
        await page.mouse.up();
        await page.waitForTimeout(1200);

        const after = await firstSectionNames();
        check('dragging a line changes the order', after.join() !== before.join(),
            `before ${before.slice(0, 3).join(', ')} / after ${after.slice(0, 3).join(', ')}`);
        check('the dragged line moved down the section',
            after.indexOf(before[0]) > 0,
            `${before[0]} is now at ${after.indexOf(before[0])}`);
        check('no line was lost or duplicated',
            new Set(after).size === new Set(before).size && after.length === before.length,
            `${before.length} -> ${after.length}`);

        // And it must survive a reload, or the optimistic redraw is lying.
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.click("button:has-text(\"Бюджет\")");
        await page.waitForSelector("text=Добавить статью", { timeout: 20_000 });
        const reloaded = await firstSectionNames();
        check('the new order was actually saved', reloaded.join() === after.join(),
            `after ${after.slice(0, 3).join(', ')} / reloaded ${reloaded.slice(0, 3).join(', ')}`);

        // Put the section back the way it was found. Everything below this reads
        // rows by position, and a suite whose later checks depend on which test
        // ran first is a suite that reports the wrong thing.
        const back = page.locator("button[aria-label^=\"Изменить порядок: \"]");
        const c = await back.nth(2).boundingBox();
        const d = await back.nth(0).boundingBox();
        if (c && d) {
            await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
            await page.mouse.down();
            await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2 - 10, { steps: 4 });
            await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2 - 4, { steps: 12 });
            await page.mouse.up();
            await page.waitForTimeout(1200);
        }
        check('the section was restored for the checks below',
            (await firstSectionNames()).join() === before.join(),
            `wanted ${before.slice(0, 3).join(', ')} / got ${(await firstSectionNames()).slice(0, 3).join(', ')}`);
    }
    text = await body();
    values = await inputValues();
}

// A new installment must move the section's paid total.
const beforeInstall = await page.locator("button:has-text(\"+ Добавить частичный платёж\")").count();
check('an installment control per section', beforeInstall === 3, `${beforeInstall} controls`);
await page.locator("button:has-text(\"+ Добавить частичный платёж\")").first().click();
await page.waitForTimeout(1400);
const newRow = rowFor('Venue Cost платёж');
check('new installment row appeared', await newRow.count() > 0);
const newAmt = newRow.locator('input[inputmode="decimal"]').first();
await newAmt.fill('1320');
await newAmt.blur();
await page.waitForTimeout(1400);
text = await body();
check('section paid total moved', text.includes("$16 000,00"), '14,680 + 1,320');
check('section still owed moved', text.includes("$2 358,90"));
await page.locator("button[aria-label=\"Удалить Venue Cost платёж\"]").first().click();
await page.waitForTimeout(1400);
check('removing installment restored total', (await body()).includes("$14 680,00"));

// Inline edit: change Dessert's unit cost and confirm the grand total moves.
const dessertRow = rowFor('Dessert');
const costInput = dessertRow.locator('input[inputmode="decimal"]').first();
await costInput.fill('500');
await costInput.blur();
await page.waitForTimeout(1200);
text = await body();
check('inline cost edit updated grand total', text.includes("$33 246,26"),
    'dessert 300 -> 500 should add 200');

// Put it back.
await costInput.fill('300');
await costInput.blur();
await page.waitForTimeout(1200);
check('revert restored total', (await body()).includes("$33 046,26"));

// Paid toggle persists.
await page.locator("button[aria-label=\"Отметить Dessert оплаченным\"]").first().click();
await page.waitForTimeout(1000);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector("text=Общий бюджет", { timeout: 20_000 });
await page.click("button:has-text(\"Бюджет\")");
await page.waitForSelector("text=Добавить статью", { timeout: 10_000 });
check('paid flag persisted across reload',
    (await page.locator("button[aria-label=\"Отметить Dessert оплаченным\"][aria-pressed=\"true\"]").count()) === 1);

console.log('\n--- Purchases tab ---');
await page.click("button:has-text(\"Покупки\")");
await page.waitForSelector("text=Добавить покупку", { timeout: 10_000 });
text = await body();
values = await inputValues();
check('purchases listed', values.includes('Venue Payment') && values.includes('Aust Ring'));
check('untracked spend flagged', text.includes("$1 957,00"));
// Earmarked gift money must appear here as a payment, badged, not hidden away.
check('gift payments listed in purchases', values.includes('Venue 1/4') && values.includes('Dress'),
    'Rob and Kim earmarked payments');
check('gift filter pill present', text.includes("🎁 Денежные подарки"));
check('gift total tile', text.includes("$6 200,00"));
check('unapplied gift called out', text.includes("$680,00"));
await page.click("button:has-text(\"🎁 Денежные подарки\")");
await page.waitForTimeout(400);
const giftOnly = await inputValues();
check('gift filter shows only gift rows',
    giftOnly.includes('Venue 1/4') && !giftOnly.includes('Venue Payment'));
await page.click("button:has-text(\"Все\")");
await page.waitForTimeout(300);
values = await inputValues();
const options = await page.locator('select option').evaluateAll(
    (els) => els.map((e) => (e as HTMLOptionElement).textContent ?? ''));
check('section option offered in dropdown',
    options.some((o) => o.includes("Venue Cost — весь раздел")),
    options.filter((o) => o.includes("весь раздел")).join(' | '));
check('per-payer cash totals shown', text.includes("$5 756,00") && text.includes("$10 894,00"));
check('off-budget flagged as not in the budget', text.includes("Вне бюджета"));

// Filter by payer.
await page.click('button:has-text("Austin")');
await page.waitForTimeout(300);
const filteredValues = await inputValues();
check('payer filter narrows list', !filteredValues.includes('Venue Payment'),
    "Heaven's purchase should be hidden");
await page.click("button:has-text(\"Все\")");

console.log('\n--- Gift Money tab ---');
await page.click("button:has-text(\"Денежные подарки\")");
await page.waitForSelector("text=Добавить участника", { timeout: 10_000 });
text = await body();
values = await inputValues();
check('contributors listed',
    ['Karie & Dave', 'Kim', 'Rob', 'A Gram'].every((n) => values.includes(n)),
    `found: ${values.filter((v) => ['Karie & Dave', 'Kim', 'Rob', 'A Gram'].includes(v)).join(', ')}`);
check('pledged total', text.includes("$17 880,00"));
check('received total', text.includes("$6 880,00"));
check('over-delivery called out', text.includes("сверх обещанной суммы"));
check('links to registry for guest gifts', text.includes("Подарки"));

console.log('\n--- Settings tab ---');
await page.click("button:has-text(\"Настройки\")");
await page.waitForSelector("text=Кто платит", { timeout: 10_000 });
text = await body();
check('headcount fields', text.includes("Количество гостей") && text.includes("135 гостей"));
check('payers with shares', text.includes("Кто платит"));
check('payment plan section', text.includes("План оплаты"));
check('paycheck interval hint', text.includes("зарплат осталось"));

// Changing the split must flow through to the overview.
const shareInputs = page.locator('input[inputmode="decimal"]');
await shareInputs.nth(2).fill('75');
await shareInputs.nth(2).blur();
await page.waitForTimeout(1200);
await page.click("button:has-text(\"Обзор\")");
await page.waitForSelector("text=Общий бюджет", { timeout: 10_000 });
check('split change reached overview', (await body()).includes("75% доля"));

// Restore 50/50.
await page.click("button:has-text(\"Настройки\")");
await page.waitForSelector("text=Кто платит", { timeout: 10_000 });
await shareInputs.nth(2).fill('50');
await shareInputs.nth(2).blur();
await page.waitForTimeout(1200);

console.log('\n--- Cost per guest + mistake detection ---');
await page.click("button:has-text(\"Обзор\")");
await page.waitForSelector("text=Общий бюджет", { timeout: 20_000 });
text = await body();
check('per-guest cost shown', text.includes("$244,79"), '33,046.26 / 135');
check('marginal guest cost shown', text.includes("$72,00"), 'dinner 35 + bar 37');
check('table of ten shown', text.includes("$720,00"));
check('duplicate suit flagged', text.includes("имеют одинаковую сумму $300,00"));
check('ring overrun flagged', /Austin.s Ring: \$1\u00a0284,00 оплачено/.test(text));

console.log('\n--- Trend + what-if ---');
check('trend card present', text.includes("Динамика"));
check('what-if present', text.includes("Что, если"));
const guestInput = page.locator('input[type="number"]').first();
await guestInput.fill('160');
await page.waitForTimeout(500);
const whatIfText = await body();
// 36 more adults x (35 dinner + 37 bar) = 2,592 on top of 33,046.26.
check('what-if recomputes the budget', whatIfText.includes("$35 638,26"),
    '160 adults instead of 124');
check('what-if shows the delta', whatIfText.includes("+$2 592,00"));
await guestInput.fill('124');
await page.waitForTimeout(400);
check('what-if never wrote to the database',
    (await body()).includes("$33 046,26"), 'real total untouched');

console.log('\n--- Derived paid state ---');
await page.click("button:has-text(\"Бюджет\")");
await page.waitForSelector("text=Добавить статью", { timeout: 10_000 });
text = await body();
check('paid states rendered', text.includes("Частично оплачено") && text.includes("Переплата"));
check('conflict hint shown', text.includes("Полностью оплачено"));
check('fully-paid count shown', /\d+ полностью оплачено/.test(text));

console.log('\n--- Schedule: split a bill ---');
await page.click("button:has-text(\"График платежей\")");
await page.waitForSelector("text=Разбить на платежи", { timeout: 10_000 });
check('empty schedule explains itself', (await body()).includes("Платежи ещё не запланированы"));
await page.click("button:has-text(\"Разбить на платежи\")");
await page.waitForSelector("text=Выберите счёт", { timeout: 10_000 });
const numbers = page.locator('input[type="number"]');
await numbers.nth(0).fill('5000');   // deposit
await numbers.nth(1).fill('3');      // instalments
await page.waitForTimeout(300);
const preview = await body();
check('split preview totals the whole bill', preview.includes("Итоги $18 358,90"),
    'deposit + instalments must add back up');
check('split preview absorbs rounding', preview.includes("с учётом округления"));
await page.click("button:has-text(\"Создать график\")");
await page.waitForTimeout(2500);
text = await body();
values = await inputValues();
check('schedule rows created',
    values.includes('Venue Cost аванс') && values.includes('Venue Cost 3/3'),
    values.filter((v) => v.startsWith('Venue Cost')).join(', '));
check('scheduled total matches the bill', text.includes("$18 358,90"),
    'deposit + 3 instalments == the section budget');
// The stat tile is always labelled "Overdue", so assert its value rather than
// looking for the word anywhere on the page.
const overdueBadges = await page.locator('span:text-is("Overdue")').count();
check('nothing overdue yet', overdueBadges === 0, `${overdueBadges} overdue badges`);
check('rounding lands on the final payment', values.includes('4452.98'),
    values.filter((v) => v.startsWith('4452')).join(', '));

console.log('\n--- Untracked spend can be adopted ---');
await page.click("button:has-text(\"Покупки\")");
await page.waitForSelector("text=Добавить покупку", { timeout: 10_000 });
check('untracked payment called out', (await body()).includes("вне бюджета"));
await page.click("button:has-text(\"+ Добавить в бюджет\")");
await page.waitForTimeout(3000);
text = await body();
check('adopting clears the untracked warning', !text.includes("1 платёж вне бюджета"),
    'AirBnb should now have a line');
check('budget grew by the adopted amount', text.includes("$35 003,26"),
    '33,046.26 + 1,957');

console.log('\n--- Bulk edit ---');
// Bulk selection has to work on desktop too, not just the mobile layout.
const rowBoxes = page.locator("input[type=\"checkbox\"][aria-label^=\"Выбрать \"]");
check('per-row checkboxes are reachable', await rowBoxes.first().isVisible(),
    'they were md:hidden, making bulk edit desktop-only broken');
await rowBoxes.first().check();
await page.waitForTimeout(300);
check('bulk bar appears on selection', (await body()).includes("1 выбрано"));
await page.click("button:has-text(\"Изменить выбранное\")");
await page.waitForSelector("text=Не менять", { timeout: 10_000 });
check('bulk modal defaults to leaving fields alone',
    (await body()).includes('останутся без изменений'));
await page.click("button:has-text(\"Отмена\")");
await page.waitForTimeout(300);

console.log('\n--- Undo a delete, archive a contributor ---');
await page.click("button:has-text(\"Денежные подарки\")");
await page.waitForSelector("text=Добавить участника", { timeout: 10_000 });

// A receipt is a leaf row, so deleting it can genuinely be undone.
const beforeReceipts = (await inputValues()).filter((v) => v === 'Venue 1/4').length;
check('receipt present before delete', beforeReceipts === 1);
await page.locator("button[aria-label^=\"Удалить платёж Venue 1/4\"]").first().click();
await page.waitForTimeout(1800);
check('undo bar offered after delete', (await body()).includes("Отменить"));
await page.click("button:has-text(\"Отменить\")");
await page.waitForTimeout(2500);
check('undo restored the receipt',
    (await inputValues()).filter((v) => v === 'Venue 1/4').length === 1);

// A contributor cascades its receipts, so it archives instead — undo couldn't
// rebuild the history.
await page.locator("button[aria-label=\"В архив: A Gram\"]").first().click();
await page.waitForTimeout(2000);
check('archived contributor leaves the list',
    !(await inputValues()).includes('A Gram'));

console.log('\n--- Thank-you tracking ---');
text = await body();
check('thank-you control present', text.includes("Благодарность?"));
check('thanked counter present', /\d+\/\d+/.test(text) && text.includes("благодарности отправлены"));
await page.locator("button:has-text(\"Благодарность?\")").first().click();
await page.waitForTimeout(1600);
check('thank-you marks as sent', (await body()).includes("✓ Поблагодарили"));

console.log('\n--- Templates + archive ---');
await page.click("button:has-text(\"Бюджет\")");
await page.waitForSelector("text=Добавить типовые расходы", { timeout: 10_000 });
await page.click("button:has-text(\"Добавить типовые расходы\")");
await page.waitForSelector("text=Добавить в раздел", { timeout: 10_000 });
check('template lists line items', (await body()).includes("Букет невесты")
    || (await body()).includes("Аренда зала"));
await page.click("button:has-text(\"Отмена\")");
await page.waitForTimeout(400);
await page.click("button:has-text(\"Настройки\")");
await page.waitForSelector("text=Кто платит", { timeout: 10_000 });
check('archive count reported', (await body()).includes("запись в архиве"));
await page.click("button:has-text(\"Показать архив\")");
await page.waitForTimeout(1200);
check('archived contributor listed with a way back',
    (await body()).includes('A Gram') && (await body()).includes("Восстановить"));
await page.click("button:has-text(\"Восстановить\")");
await page.waitForTimeout(2000);
await page.click("button:has-text(\"Денежные подарки\")");
await page.waitForSelector("text=Добавить участника", { timeout: 10_000 });
check('restored contributor is back', (await inputValues()).includes('A Gram'));

console.log('\n--- Mobile layout (390px) ---');
await page.setViewportSize({ width: 390, height: 900 });
await page.click("button:has-text(\"Бюджет\")");
await page.waitForTimeout(700);
const overflowX = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('no horizontal overflow at 390px', overflowX <= 1, `${overflowX}px overflow`);

// Rows collapse to name + total so a 27-line budget stays scannable; the
// editable fields are behind the expander.
const collapsedText = await body();
check('collapsed row shows the line total', collapsedText.includes("$4 500,00"));
// textContent includes display:none nodes (the desktop header row), so this has
// to test what is actually rendered.
const visibleLabels = async (label: string) => page.evaluate((text) => {
    const root = document.querySelector('[data-finance-suite]')!;
    return [...root.querySelectorAll('span, div')]
        .filter((el) => el.textContent?.trim() === text
            && (el as HTMLElement).offsetParent !== null).length;
}, label);
check('collapsed rows hide the editing labels', (await visibleLabels('Цена за единицу')) === 0,
    'unit cost should only be visible once a row is expanded');
await page.locator("button[aria-label^=\"Развернуть Venue\"]").first().click();
await page.waitForTimeout(500);
check('expanding reveals labelled fields', (await visibleLabels('Цена за единицу')) === 1,
    'every field needs a label once the header row is hidden');
check('expanded row labels the quantity source', (await visibleLabels('Источник количества')) === 1);
await page.locator("button[aria-label^=\"Свернуть Venue\"]").first().click();
await page.waitForTimeout(400);

// iOS Safari zooms the viewport on focusing any input under 16px.
const tooSmallFont = await page.evaluate(() => {
    const out: string[] = [];
    const root = document.querySelector('[data-finance-suite]')!;
    root.querySelectorAll('input, select, textarea').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && parseFloat(getComputedStyle(el).fontSize) < 16) {
            out.push((el as HTMLInputElement).placeholder
                || el.getAttribute('aria-label') || el.tagName);
        }
    });
    return out;
});
check('no sub-16px inputs (iOS would zoom)', tooSmallFont.length === 0, tooSmallFont.join(', '));

// Touch targets, scoped to this feature — the site's own nav chrome predates it.
const tinyTargets = await page.evaluate(() => {
    const out: string[] = [];
    const root = document.querySelector('[data-finance-suite]')!;
    root.querySelectorAll('button, select, input, a').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.height < 32) {
            out.push(`${el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 16)} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
    });
    return out;
});
check('no under-32px touch targets', tinyTargets.length === 0, tinyTargets.slice(0, 4).join(' | '));

for (const tab of ['График платежей', 'Покупки', 'Денежные подарки', 'Настройки', 'Обзор']) {
    await page.click(`button:has-text("${tab}")`);
    await page.waitForTimeout(600);
    const ov = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${tab} fits 390px`, ov <= 1, `${ov}px overflow`);
}

// A narrow Android viewport is the real floor, not the iPhone width.
await page.setViewportSize({ width: 360, height: 800 });
for (const tab of ['Бюджет', 'График платежей', 'Покупки', 'Денежные подарки']) {
    await page.click(`button:has-text("${tab}")`);
    await page.waitForTimeout(600);
    const ov = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${tab} fits 360px`, ov <= 1, `${ov}px overflow`);
}
await page.setViewportSize({ width: 1280, height: 1400 });

console.log('\n--- Console cleanliness ---');
// Reloading mid-flight aborts pending fetches; that is an artifact of this
// script navigating, not something a user would ever trigger.
const realErrors = consoleErrors.filter((e) =>
    !e.includes('favicon')
    && !/Download the React DevTools/.test(e)
    && !/Failed to fetch/.test(e));
check('no console errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${failures === 0 ? 'ALL UI CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
