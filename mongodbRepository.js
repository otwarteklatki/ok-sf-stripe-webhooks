const { MongoClient } = require('mongodb');

const URI = process.env.MONGO_DB_URI;
const DATABASE_NAME = 'oc-stripe-pl';
const ERROR_COLLECTION_NAME = 'emailErrors';
const SUCCESS_COLLECTION_NAME = 'emailSuccessfulSends';
const SUCCESS_CARD_EXPIRE_COLLECTION_NAME = 'emailSuccessfulCardExpireSends';
const SUCCESSFUL_PAYMENT_INTENT_COLLECTION_NAME = 'successfulPaymentIntents';
const CUSTOMER_WITH_CARD_EXPIRING_COLLECTION = 'customersWithCardExpiring';
const CHECK_FOR_ERROR_IN_LAST_X_MINUTES = 30;

module.exports = {
    log(collection, object) {
        object.recordCreatedDate = new Date();
        const client = new MongoClient(URI, { useNewUrlParser: true, useUnifiedTopology: true });
        client.connect(() => {
            client.db(DATABASE_NAME).collection(collection).insertOne(object, () => {
                client.close();
            });
        });
    },
    logEmailSuccess(emailDetails) {
        if (emailDetails.emailType === 'cardExpiringSoon' || emailDetails.emailType === 'cardExpired') {
            this.log(SUCCESS_CARD_EXPIRE_COLLECTION_NAME, emailDetails);
        } else {
            this.log(SUCCESS_COLLECTION_NAME, emailDetails);
        }
    },
    logEmailError(error) {
        this.log(ERROR_COLLECTION_NAME, error);
    },
    logSuccessfulPaymentIntent(emailDetails) {
        this.log(SUCCESSFUL_PAYMENT_INTENT_COLLECTION_NAME, emailDetails);
    },
    logCustomerWithCardExpiring(customer) {
        this.log(CUSTOMER_WITH_CARD_EXPIRING_COLLECTION, customer);
    },
    async getLatestError(res) {
        const client = new MongoClient(URI, { useNewUrlParser: true, useUnifiedTopology: true });
        return client.connect(() => {
            client.db(DATABASE_NAME).collection(ERROR_COLLECTION_NAME).findOne(
                {},
                { sort: { $natural: -1 } },
                (err, record) => {
                    if (err) {
                        console.log('ERROR CONNECTING TO MONGO');
                        console.log(err);
                        res.status(500);
                        res.json({ status: err });
                        client.close();
                        return;
                    }
                    if (record && record.recordCreatedDate) {
                        console.log(`last email error date: ${record.recordCreatedDate}`);
                    } else {
                        console.log('No email errors found in db');
                    }
                    if (record && record.recordCreatedDate && errorOccuredInLastXMins(record.recordCreatedDate)) {
                        console.log(`Error occured in the last ${CHECK_FOR_ERROR_IN_LAST_X_MINUTES}mins`);
                        client.close();
                        res.status(500);
                        res.json({
                            status: `Error within the last ${CHECK_FOR_ERROR_IN_LAST_X_MINUTES} 
                                minutes! Check the mongodb for error more logs.`,
                            logs: record.emailLogs,
                        });
                    } else {
                        client.close();
                        res.json({ status: `No error within the last ${CHECK_FOR_ERROR_IN_LAST_X_MINUTES} minutes` });
                    }
                },
            );
        });
    },
    async getSuccessfulPaymentIntent(paymentIntentId, res) {
        const client = new MongoClient(URI, { useNewUrlParser: true, useUnifiedTopology: true });
        return client.connect(() => {
            client.db(DATABASE_NAME).collection(SUCCESSFUL_PAYMENT_INTENT_COLLECTION_NAME).findOne(
                { id: paymentIntentId },
                (err, record) => {
                    if (err) {
                        console.log('ERROR CONNECTING TO MONGO');
                        console.log(err);
                        res.status(500);
                        res.json({ status: err });
                        client.close();
                        return;
                    }
                    client.close();
                    if (record && record.status === 'succeeded') {
                        res.json({ successful: true, found: true });
                    } else if (record) {
                        res.json({ successful: false, found: true });
                    } else {
                        res.json({ successful: false, found: false });
                    }
                },
            );
        });
    },
    async getCardExpiredCustomerBeforeDate(customerId, date) {
        const client = new MongoClient(URI, { useNewUrlParser: true, useUnifiedTopology: true });
        return new Promise((resolve, reject) => {
            client.connect(() => {
                client.db(DATABASE_NAME).collection(CUSTOMER_WITH_CARD_EXPIRING_COLLECTION).findOne(
                    { id: customerId, created: { $lte: date } },
                    (err, record) => {
                        if (err) {
                            console.log('ERROR CONNECTING TO MONGO');
                            console.log(err);
                            client.close();
                            reject(err);
                        }
                        client.close();
                        resolve(record);
                    },
                );
            });
        });
    },
    async getCustomerFromCardExpireCollection(customerId) {
        return new Promise((resolve) => {
            this.getObjectFromCollectionById(customerId, CUSTOMER_WITH_CARD_EXPIRING_COLLECTION).then((customer) => { resolve(customer); });
        });
    },
    async getCustomerFromExpireEmailsSentCollection(customerId) {
        return new Promise((resolve) => {
            this.getObjectFromCollectionById(customerId, SUCCESS_CARD_EXPIRE_COLLECTION_NAME).then((customer) => { resolve(customer); });
        });
    },
    async getObjectFromCollectionById(id, collection) {
        const client = new MongoClient(URI, { useNewUrlParser: true, useUnifiedTopology: true });
        return new Promise((resolve, reject) => {
            client.connect(() => {
                client.db(DATABASE_NAME).collection(collection).findOne(
                    { id },
                    { sort: { $natural: -1 } },
                    (err, record) => {
                        if (err) {
                            console.log('ERROR CONNECTING TO MONGO');
                            console.log(err);
                            client.close();
                            reject(err);
                        }
                        client.close();
                        resolve(record);
                    },
                );
            });
        });
    },
    async setCustomerAsContactedForCardExpire(customer) {
        const markedCustomer = customer;
        markedCustomer.sentPromptEmailAfterTwoMonths = true;
        this.log(CUSTOMER_WITH_CARD_EXPIRING_COLLECTION, markedCustomer);
    },
    async markCustomerAsContactedForCardExpire(customer) {
        const markedCustomer = customer;
        markedCustomer.sentPromptEmailAfterTwoMonths = true;
        const client = new MongoClient(URI, { useNewUrlParser: true, useUnifiedTopology: true });
        client.connect(() => {
            client.db(DATABASE_NAME).collection(CUSTOMER_WITH_CARD_EXPIRING_COLLECTION).update({ _id: markedCustomer._id }, markedCustomer).then(
                () => {
                    client.close();
                },
            );
        });
    },
    async markCustomerAsUpdatedTheirCard(customer) {
        const markedCustomer = customer;
        markedCustomer.updatedTheirCardDetails = true;
        const client = new MongoClient(URI, { useNewUrlParser: true, useUnifiedTopology: true });
        client.connect(() => {
            client.db(DATABASE_NAME).collection(CUSTOMER_WITH_CARD_EXPIRING_COLLECTION).update({ _id: markedCustomer._id }, markedCustomer).then(
                () => {
                    client.close();
                },
            );
        });
    },
};

function errorOccuredInLastXMins(errorDate) {
    return doesAddingXMinutesToDatePutItInTheFuture(errorDate);
}

function doesAddingXMinutesToDatePutItInTheFuture(errorDate) {
    const date = new Date();
    errorDate.setMinutes(errorDate.getMinutes() + CHECK_FOR_ERROR_IN_LAST_X_MINUTES);
    return date < errorDate;
}
