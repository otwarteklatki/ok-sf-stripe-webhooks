module.exports = {
    convertUnixTimestampToDate(timestamp) {
        return new Date(timestamp * 1000);
    },
    convertUnixTimestampToDateString(timestamp) {
        const date = new Date(timestamp * 1000);
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
