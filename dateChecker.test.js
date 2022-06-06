/**
 * Uses test naming strategy of [UnitOfWork_ExpectedBehavior_StateUnderTest]
 * */

const index = require('./dateChecker');

// dateChecker.convertUnixTimestampToDateString
test('unix time stamp converter converts to a the correct date when given a valid timestamp', () => {
    expect(index.convertUnixTimestampToDateString('1637583673')).toBe('22/11/2021');
});

// dateChecker.convertUnixTimestampToIsoDateString
test('unix time stamp converter should return correctly set date when given a valid timestamp', () => {
    expect(index.convertUnixTimestampToDate('1637583673').toISOString()).toBe('2021-11-22T12:21:13.000Z');
});

// dateChecker.hasDatePassedExpireDate
test('date expire calculator should return true when given a date which is after the expire month and year', () => {
    const expMonth = 2;
    const expYear = 2003;
    const date = new Date(2016, 11, 17, 0, 0, 0, 0);

    expect(index.hasDatePassedExpireDate(date, expMonth, expYear)).toBe(true);
});

test('date expire calculator should return false when given a date which is before the expire month and year', () => {
    const expMonth = 2;
    const expYear = 2023;
    const date = new Date(2016, 11, 17, 0, 0, 0, 0);

    expect(index.hasDatePassedExpireDate(date, expMonth, expYear)).toBe(false);
});

test('date expire calculator should return true when given a date which is the same as the expire month and year', () => {
    const expMonth = 2;
    const expYear = 2023;
    const date = new Date(2023, 2, 25, 0, 0, 0, 0);

    expect(index.hasDatePassedExpireDate(date, expMonth, expYear)).toBe(true);
});
