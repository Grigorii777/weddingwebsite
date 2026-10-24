import assert from 'node:assert/strict';
import { counted, formatWeddingDate, formatWeddingTime, plural } from '../src/lib/locale';
import { parseDateParts, weddingDateTime } from '../src/lib/weddingDate';
import { formatPerNight, formatPrice, priceValue } from '../src/lib/honeymoon';

for (const [n, expected] of [
    [0, 'гостей'], [1, 'гость'], [2, 'гостя'], [4, 'гостя'], [5, 'гостей'],
    [11, 'гостей'], [14, 'гостей'], [21, 'гость'], [22, 'гостя'], [25, 'гостей'],
    [101, 'гость'], [111, 'гостей'], [-2, 'гостя'], [1.5, 'гостя'],
] as const) assert.equal(plural(n, 'гость', 'гостя', 'гостей'), expected);

assert.equal(counted(22, 'ночь', 'ночи', 'ночей'), '22 ночи');
for (const input of ['15 июня 2027', '15 ИЮНЯ 2027 г.', '15.06.2027', '2027-06-15', 'June 15, 2027']) {
    assert.deepEqual(parseDateParts(input), { year: 2027, month: 5, day: 15 }, input);
    assert.equal(formatWeddingDate(input), '15 июня 2027 г.', input);
    const date = weddingDateTime(input, '16:30');
    assert.ok(date);
    assert.equal(date.getMonth(), 5);
    assert.equal(date.getDate(), 15);
    assert.equal(date.getHours(), 16);
}
for (const [month, name] of ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'].entries()) {
    assert.deepEqual(parseDateParts(`3 ${name} 2027`), { year: 2027, month, day: 3 });
}
assert.equal(formatWeddingDate('Дата будет объявлена'), 'Дата будет объявлена');
assert.equal(formatWeddingDate('2027-02-30'), '2027-02-30');
assert.equal(formatWeddingDate(undefined), '');
assert.equal(formatWeddingTime('4:30 PM'), '16:30');
assert.equal(formatWeddingTime('09:05'), '09:05');
assert.equal(formatWeddingTime('после церемонии'), 'после церемонии');
for (const value of ['1200.50', '1,200.50', '1 200,50', '1\u00a0200,50', '1.200,50']) {
    assert.equal(formatPerNight(value), '$1\u00a0200,50 за ночь', value);
    assert.equal(priceValue(formatPerNight(value)), 1200.5, value);
    assert.equal(formatPerNight(formatPerNight(value)), formatPerNight(value), value);
    assert.equal(formatPrice(formatPrice(value)), formatPrice(value), value);
}
assert.equal(priceValue('2 bed villa $300'), 300);
console.log('Russian plural forms, all months, legacy dates and 24-hour times: passed.');
