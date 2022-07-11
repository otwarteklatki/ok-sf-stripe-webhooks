const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');
const qs = require('qs');

const CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;
const USERNAME = process.env.SALESFORCE_USERNAME;
const PASSWORD = process.env.SALESFORCE_PASSWORD;
const URL = process.env.SALESFORCE_URL ? process.env.SALESFORCE_URL : 'https://otwarteklatki--staging.my.salesforce.com/services/';
const AUTH_URL = `${URL}oauth2/token`;
const PAYMENT_HANDLER_URL = `${URL}apexrest/payments/stripe/`;
const SUBSCRIPTION_HANDLER_URL = `${URL}apexrest/subscriptions/stripe/`;
const REFUND_HANDLER_URL = `${URL}apexrest/refund/stripe/`;
const dateChecker = require('./dateChecker');

module.exports = {
    async sendPaymentToSalesforce(paymentIntent) {
        console.log(`Sending payment intent ${paymentIntent.id} to salesforce at ${URL}`);
        await attachCustomerToPaymentIntent(paymentIntent);
        attachCardDetailsToPaymentIntent(paymentIntent);
        attachErrorDetailsToPaymentIntent(paymentIntent);

        const paymentData = {
            payment: {
                id: paymentIntent.id,
                name: paymentIntent.customer.name,
                email: paymentIntent.customer.email,
                created: dateChecker.convertUnixTimestampToDate(paymentIntent.created),
                amount: convertAmountToDecimal(paymentIntent.amount),
                status: paymentIntent.status,
                payment_method_types: paymentIntent.payment_method_types,
                statement_descriptor: paymentIntent.statement_descriptor,
                payment_currency: paymentIntent.currency,
                metadata: {
                    campaign: paymentIntent.metadata.campaign,
                    paymentInitiatedDomain: paymentIntent.metadata.paymentInitiatedDomain,
                    paymentInitiatedWidgetDomain: paymentIntent.metadata.paymentInitiatedDomain,
                    recurring: convertStringBooleanToSalesforceBoolean(paymentIntent.metadata.recurring),
                    recurringAmount: paymentIntent.metadata.recurringAmount,
                    abTestInfo: paymentIntent.metadata['a-b-testInfo'],
                    clubMember: convertStringBooleanToSalesforceBoolean(paymentIntent.metadata.clubMember),
                    newsletterSignUp: convertStringBooleanToSalesforceBoolean(paymentIntent.metadata.newsletterSignUp),
                },
                description: paymentIntent.description,
                invoice_id: paymentIntent.invoice,
                card: {
                    brand: paymentIntent.cardBrand,
                    expireMonth: paymentIntent.cardExpireMonth,
                    expireYear: paymentIntent.cardExpireYear,
                    last4Digits: paymentIntent.cardLast4Digits,
                },
                subscription_id: paymentIntent.subscription_id,
                error: paymentIntent.errorCode,
            },
        };

        sendToSalesforce(paymentData, PAYMENT_HANDLER_URL);
    },

    async sendCanceledSubscriptionToSalesforce(subscription) {
        this.sendSubscriptionToSalesforce(subscription, 'cancel');
    },

    async sendUpdatedSubscriptionToSalesforce(subscription) {
        this.sendSubscriptionToSalesforce(subscription, 'update');
    },

    async sendSubscriptionToSalesforce(subscription, endpoint) {
        console.log(`Sending subscription ${subscription.id} to salesforce at ${URL}`);
        await attachPaymentDetailsToSubscription(subscription);

        const subscriptionData = {
            subscription: {
                id: subscription.id,
                created: dateChecker.convertUnixTimestampToDate(subscription.created),
                status: subscription.status,
                amount: convertAmountToDecimal(subscription.amount),
                card: {
                    brand: subscription.cardBrand,
                    expireMonth: subscription.cardExpireMonth,
                    expireYear: subscription.cardExpireYear,
                    last4Digits: subscription.cardLast4Digits,
                },
            },
        };

        sendToSalesforce(subscriptionData, SUBSCRIPTION_HANDLER_URL + endpoint);
    },

    async sendRefund(charge) {
        console.log(`Sending refund for ${charge.payment_intent} to salesforce at ${REFUND_HANDLER_URL}`);
        let refundReason = null;

        if (charge.refunds && charge.refunds.data && charge.refunds.data[0]) {
            refundReason = charge.refunds.data[0].reason;
        }

        const refundData = {
            refund: {
                id: charge.id,
                paymentIntentId: charge.payment_intent,
                created: dateChecker.convertUnixTimestampToDate(charge.created),
                amount: convertAmountToDecimal(charge.amount_refunded),
                status: charge.status,
                reason: refundReason,
            },
        };

        sendToSalesforce(refundData, REFUND_HANDLER_URL);
    },
};

function attachCardDetailsToPaymentIntent(paymentIntent) {
    // salesforce must have all the variables present
    paymentIntent.cardBrand = null;
    paymentIntent.cardLast4Digits = null;
    paymentIntent.cardExpireMonth = null;
    paymentIntent.cardExpireYear = null;

    if (paymentIntent.charges && paymentIntent.charges.data && paymentIntent.charges.data[0]) {
        const charge = paymentIntent.charges.data[0];
        if (charge.payment_method_details && charge.payment_method_details.card) {
            paymentIntent.cardBrand = charge.payment_method_details.card.brand;
            paymentIntent.cardLast4Digits = charge.payment_method_details.card.last4;
            paymentIntent.cardExpireMonth = charge.payment_method_details.card.exp_month;
            paymentIntent.cardExpireYear = charge.payment_method_details.card.exp_year;
        }
    }
}

async function attachCustomerToPaymentIntent(paymentIntent) {
    const customer = await stripe.customers.retrieve(
        paymentIntent.customer,
        {
            expand: ['subscriptions.data.default_payment_method'],
        },
    );
    if (customer) {
        paymentIntent.customer = customer;
    } else {
        paymentIntent.customer = null;
    }
}

async function attachErrorDetailsToPaymentIntent(paymentIntent) {
    const paymentError = paymentIntent.last_payment_error;
    paymentIntent.errorCode = null;

    if (paymentError) {
        paymentIntent.errorCode = paymentError.code;
    }
}

async function attachPaymentDetailsToSubscription(subscription) {
    // salesforce must have all the variables present
    subscription.amount = null;
    subscription.cardBrand = null;
    subscription.cardLast4Digits = null;
    subscription.cardExpireMonth = null;
    subscription.cardExpireYear = null;

    const payment = await stripe.subscriptions.retrieve(
        subscription.id,
        {
            expand: ['default_payment_method'],
        },
    );

    if (payment.plan && payment.plan.amount) {
        subscription.amount = payment.plan.amount;
    }

    if (payment.default_payment_method && payment.default_payment_method.card) {
        const { card } = payment.default_payment_method;
        subscription.cardBrand = card.brand;
        subscription.cardLast4Digits = card.last4;
        subscription.cardExpireMonth = card.exp_month;
        subscription.cardExpireYear = card.exp_year;
    }
}

async function getSalesforceAccessToken() {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'post',
            headers: {
                'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
            },
            data: qs.stringify({
                grant_type: 'password',
                username: USERNAME,
                password: PASSWORD,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
            }),
            url: AUTH_URL,
        };
        axios(options).then((response) => {
            resolve(response.data.access_token);
        }).catch((error) => {
            console.log('ERROR: ');
            console.log(error);
            reject(error);
        });
    });
}

async function sendToSalesforce(data, url) {
    const accessToken = await getSalesforceAccessToken();
    const options = {
        method: 'post',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json;charset=UTF-8',
        },
        data: JSON.stringify(data),
        url,
    };
    axios(options).then((response) => {
        console.log('Sent data to salesforce, recieved response:');
        console.log(response.data);
    }).catch((error) => {
        console.log('Sent data to salesforce failed, recieved response:');
        console.log(error.toJSON());
        console.log(error.response);
    });
}

// Stripe stores 50.00zl as 5000, so it needs conversion
function convertAmountToDecimal(amount) {
    if (Number.isInteger(amount)) {
        return amount / 100;
    }
    return amount;
}

function convertStringBooleanToSalesforceBoolean(value) {
    if (value?.toLowerCase() === 'true') {
        return true;
    }
    return false;
}
