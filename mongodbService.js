const mongodbRepo = require('./mongodbRepository');

module.exports = {
    async getCustomerFromCardExpireCollectionIfPromptedOverTwoMonthsAgo(customerId) {
        const date = new Date();
        date.setMonth(date.getMonth() - 2);
        const unixTimestamp = date.getTime() / 1000;
        return new Promise((resolve) => {
            mongodbRepo.getCardExpiredCustomerBeforeDate(customerId, unixTimestamp).then(
                (customer) => {
                    resolve(customer);
                },
            );
        });
    },
    async getCustomerFromCardExpireCollection(customerId) {
        return new Promise((resolve) => {
            mongodbRepo.getCustomerFromCardExpireCollection(customerId).then((customer) => { resolve(customer); });
        });
    },
    async getCustomerFromExpireEmailsSentCollection(customerId) {
        return new Promise((resolve) => {
            mongodbRepo.getCustomerFromExpireEmailsSentCollection(customerId).then((customer) => { resolve(customer); });
        });
    },
    async wasCustomerSentACardExpireEmailAboutTheirCurrentCard(customer) {
        return new Promise((resolve) => {
            mongodbRepo.getCustomerFromExpireEmailsSentCollection(customer.id).then((customerRecord) => {
                if (customerRecord
                    && (customer.card.fingerprint === customerRecord.card.fingerprint
                        && customer.card.last4 === customerRecord.card.last4)) {
                    if (customerRecord.sentPromptEmailAfterTwoMonths || customerRecord.sentCardExpiringSoonEmail) {
                        resolve(true);
                    }
                }
                resolve(false);
            });
        });
    },
    async wasCustomerSentACardExpiredPromptEmailAboutTheirCurrentCard(customer) {
        return new Promise((resolve) => {
            mongodbRepo.getCustomerFromExpireEmailsSentCollection(customer.id).then((customerRecord) => {
                if (customerRecord
                    && (customer.card.fingerprint === customerRecord.card.fingerprint
                        && customer.card.last4 === customerRecord.card.last4)) {
                    if (customerRecord.sentPromptEmailAfterTwoMonths) {
                        resolve(true);
                    }
                }
                resolve(false);
            });
        });
    },
};
