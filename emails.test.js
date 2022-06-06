/**
 * Uses test naming strategy of [UnitOfWork_ExpectedBehavior_StateUnderTest]
 * */

const emails = require('./emails');

// emails.getFirstName
test('first name getter returns the first name from a full name', () => {
    expect(emails.getFirstName('Eleanor Rigby')).toBe('Eleanor');
});

test('first name getter returns the first name from a fullname when the fullname only contains a first name', () => {
    expect(emails.getFirstName('Tupac')).toBe('Tupac');
});

test('first name getter returns the first name from a fullname when the fullname only contains a firstname and has a space after', () => {
    expect(emails.getFirstName('Tupac ')).toBe('Tupac');
});

test('first name getter returns the first name from a full name when there are spaces either side of the name', () => {
    expect(emails.getFirstName(' Eleanor Rigby ')).toBe('Eleanor');
});

// emails.formatDateString
test('date string formatter converts an xx/xx/xxxx date to xx.xx.xxxx when given xx/xx/xxxx', () => {
    expect(emails.formatDateString('03/10/1994')).toBe('03.10.1994');
});

test('date string formatter returns the same date when the date doesn\'nt need to be converted when given xx.xx.xxxx', () => {
    expect(emails.formatDateString('03.10.1994')).toBe('03.10.1994');
});
