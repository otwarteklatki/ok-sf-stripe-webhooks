/**
 * Uses test naming strategy of [UnitOfWork_ExpectedBehavior_StateUnderTest]
 * */

const index = require('./dateChecker');

// dateChecker.convertUnixTimestampToDateString
test('unix time stamp converter converts to a the correct date when given a valid timestamp', () => {
    expect(index.convertUnixTimestampToDateString('1692879426')).toBe('24/8/2023');
});

// dateChecker.convertUnixTimestampToDate
test('unix time stamp converter should return correctly set date when given a valid timestamp', () => {
    expect(index.convertUnixTimestampToDate('1692879426').toISOString()).toBe('2023-08-24T14:17:06.000Z');
});

test('unix time stamp converter should correctly set CET locale time zone when given a valid GTM timestamp', () => {
    const date = new Date('2023-08-24T12:17:06.000Z');
    const timestamp = Math.floor(date / 1000);

    expect(index.convertUnixTimestampToDate(timestamp).toISOString()).toBe('2023-08-24T14:17:06.000Z');
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
