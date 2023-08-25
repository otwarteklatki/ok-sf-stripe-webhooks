module.exports = {
    convertUnixTimestampToDate(timestamp) {
        const datetimeFromTimestamp = new Date(timestamp * 1000);
        const cetOffset = 2 * 60; // CET time offset is GTM +2 hours
        const zoneOffset = -cetOffset * 60 * 1000;
        const localDatetime = new Date(datetimeFromTimestamp - zoneOffset);
        return localDatetime;
    },
    convertUnixTimestampToDateString(timestamp) {
        const date = this.convertUnixTimestampToDate(timestamp);
        return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    },
    isCardExpiringSoon(expMonth, expYear) {
        if (this.isCardExpired(expMonth, expYear)) {
            return true;
        }
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        return this.hasDatePassedExpireDate(date, expMonth, expYear);
    },
    isCardExpired(expMonth, expYear) {
        const currentDate = new Date();
        return this.hasDatePassedExpireDate(currentDate, expMonth, expYear);
    },
    hasDatePassedExpireDate(date, expMonth, expYear) {
        let month = date.getMonth();
        month += 1; // js counts months starting from 0, jan = 0, feb = 1, etc.
        const year = date.getFullYear();
        if (expMonth <= month && expYear === year) {
            return true;
        } if (expYear < year) {
            return true;
        }
        return false;
    },
};
