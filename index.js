/* eslint-disable no-else-return */
const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const emailService = require('./emails');
const mongodbRepo = require('./mongodbRepository');
const mongodbService = require('./mongodbService');
const salesforceService = require('./salesforceService');
const testObjects = require('./testObjects');
const dateChecker = require('./dateChecker');

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const salesforceEnabled = process.env.ENABLE_SALESFORCE_SENDING === 'true';

console.log(`Sending to salesforce enabled: ${salesforceEnabled}`);

const app = express();
app.use(morgan('combined'));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.json({ status: 'alive' });
});

app.get('/error-monitor', (req, res) => {
    mongodbRepo.getLatestError(res);
});

app.get('/poll/payment-intent/:paymentIntentId', (req, res) => {
    const { paymentIntentId } = req.params;
    mongodbRepo.getSuccessfulPaymentIntent(paymentIntentId, res);
});

app.get('/test/expiring-soon', async (req, res) => {
    processExpiringSoonEmail(testObjects.invoice);
    res.send('ok - test');
});

/**
 * This method requires a record in the database from the expiring soon test with a record which was created two months ago.
 *
 * I'd recommend either commenting out the line which checks the dates or going to the mongodb and manually changing the date.
 *
 * You'll also have to unfortunately comment out this method didPaymentIntentFailDueToACardExpiredError because stripe doesn't
 * let you set up a test invoice which fails due to a card expired code
 * */
app.get('/test/expired-prompt', async (req, res) => {
    processExpiredCardPromptEmail(testObjects.invoice);
    res.send('ok - test');
});

app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (request, response) => {
    const sig = request.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
        response.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    let subscription; let intent; let invoice;
    switch (event.type) {
    case 'customer.subscription.deleted':
        console.log(`Processing event type ${event.type}`);
        subscription = event.data.object;
        await handleSubscriptionDeletion(subscription, event);
        break;
    case 'customer.subscription.updated':
        console.log(`Processing event type ${event.type}`);
        subscription = event.data.object;
        if (isCardUpdate(event)) {
            subscription.customer.stripeEvent = event.type;
            await handleCardUpdate(subscription);
        } else if (isAmountUpdate(event.data)) {
            await handleAmountUpdate(subscription, event);
        } else {
            console.log(`${event.type} not processed due to not being an amount change or card update.`);
        }
        break;
    case 'invoice.upcoming':
        console.log(`Processing event type ${event.type}`);
        invoice = event.data.object;
        invoice.stripeEvent = event.type;
        try {
            processExpiringSoonEmail(invoice);
        } catch (error) {
            console.error(error);
        }
        break;
    case 'invoice.payment_failed':
        console.log(`Processing event type ${event.type}`);
        invoice = event.data.object;
        try {
            processExpiredCardPromptEmail(invoice);
        } catch (error) {
            console.error(error);
        }
        break;
    case 'payment_intent.succeeded':
        console.log(`Processing event type ${event.type}`);
        intent = event.data.object;
        await handleSuccessfulPayment(intent);
        break;
    default:
        console.log(`Unhandled event type ${event.type}`);
    }
    // Return a response to acknowledge receipt of the event
    response.json({ received: true });
});

async function handleSubscriptionDeletion(subscription, event) {
    await handleSubscriptionDeletionForSalesforce(subscription);

    try {
        subscription.customer.stripeEvent = event.type;
        processCancelEmail(subscription.customer);
    } catch (error) {
        console.error(error);
    }
}

async function handleSubscriptionDeletionForSalesforce(subscription) {
    try {
        if (salesforceEnabled) {
            await salesforceService.sendCanceledSubscriptionToSalesforce(subscription);
        } else {
            console.log(`Not sending subscription ${subscription.id} to salesforce. Salesforce sending enabled: ${salesforceEnabled}`);
        }
    } catch (error) {
        console.error(error);
    }
}

async function handleSuccessfulPayment(intent) {
    await handleSuccessfulPaymentForSalesforce(intent);
    try {
        processReceiptEmail(intent);
        mongodbRepo.logSuccessfulPaymentIntent(intent);
    } catch (error) {
        console.error(error);
    }
}

async function handleSuccessfulPaymentForSalesforce(intent) {
    try {
        if (salesforceEnabled) {
            intent.subscription_id = await retrieveSubscriptionId(intent);
            await salesforceService.sendPaymentToSalesforce(intent);
        } else {
            console.log(`Not sending payment intent ${intent.id} to salesforce. Salesforce sending enabled: ${salesforceEnabled}`);
        }
    } catch (error) {
        console.error(error);
    }
}

async function handleAmountUpdate(subscription, event) {
    await handleAmountUpdateForSalesforce(subscription);

    try {
        processAmountUpdateEmail(event.data);
    } catch (error) {
        console.error(error);
    }
}

async function handleAmountUpdateForSalesforce(subscription) {
    try {
        if (salesforceEnabled) {
            await salesforceService.sendUpdatedSubscriptionToSalesforce(subscription);
        } else {
            console.log(`Not sending subscription ${subscription.id} to salesforce. Salesforce sending enabled: ${salesforceEnabled}`);
        }
    } catch (error) {
        console.error(error);
    }
}

async function handleCardUpdate(subscription) {
    await handleCardUpdateForSalesforce(subscription);

    try {
        logCardUpdatedIfConnectedToCustomerWhoReceivedACardExpiringSoonEmail(subscription);
    } catch (error) {
        console.error(error);
    }
}

async function handleCardUpdateForSalesforce(subscription) {
    try {
        if (salesforceEnabled) {
            await salesforceService.sendUpdatedSubscriptionToSalesforce(subscription);
        } else {
            console.log(`Not sending subscription ${subscription.id} to salesforce. Salesforce sending enabled: ${salesforceEnabled}`);
        }
    } catch (error) {
        console.error(error);
    }
}

/**
 * This will only collect the user's latest card emails from the database
 */
async function processExpiredCardPromptEmail(invoice) {
    const paymentIntentId = invoice.payment_intent;
    const cardExpired = await didPaymentIntentFailDueToACardExpiredError(paymentIntentId);
    if (cardExpired) {
        const subscriptionId = invoice.subscription;
        const customerId = invoice.customer;
        if (customerId && subscriptionId) {
            const customer = await mongodbService.getCustomerFromCardExpireCollectionIfPromptedOverTwoMonthsAgo(customerId);
            const ShouldCustomerBeSentPromptEmail = customer
                && !customer.sentPromptEmailAfterTwoMonths
                && !customer.updatedTheirCardDetails
                && subscriptionId === customer.subscriptionId;
            if (ShouldCustomerBeSentPromptEmail) {
                processCustomerCardExpiredPromptEmail(customer);
                mongodbRepo.markCustomerAsContactedForCardExpire(customer);
            } else {
                logCustomerNotPrompted(customer, subscriptionId, customerId);
            }
        }
    } else {
        console.log(`${paymentIntentId} did not fail due to the donor's card expiring`);
    }
}

function logCustomerNotPrompted(customer, subscriptionId, customerId) {
    if (customer) {
        const didSubscriptionIdsMatch = subscriptionId === customer.subscriptionId;
        console.log(`${customerId} not prompted.
            Sent prompt already: ${customer.sentPromptEmailAfterTwoMonths}.
            Already updated their card details: ${customer.updatedTheirCardDetails}.
            Did the subscription ids match: ${didSubscriptionIdsMatch}.`);
    } else {
        console.log(`${customerId} not prompted. Unable to find a match in the database over two months old.`);
    }
}

async function processReceiptEmail(intent) {
    let { customer } = intent;
    if (!customer.id) {
        // if the customer field hasn't been expanded to the object then it is the id
        // use that id to expand the object.
        customer = await stripe.customers.retrieve(
            customer,
        );
    }
    customer.donationDescription = 'Darowizna na OK';
    customer.donationDate = dateChecker.convertUnixTimestampToDateString(intent.created);
    customer.donationAmount = convertStripeAmountToMatchHowItIsDisplayedInTheDonationForm(intent.amount);
    return sendEmailAndLogResult(customer, emailService.sendReceiptEmail);
}

/**
 * @param {*} event
 * @returns true if the event is triggered by the user updating the amount on their subscription, false if not
 */
function isAmountUpdate(event) {
    if (event.previous_attributes
        && event.object
        && event.previous_attributes.items
        && event.object.items
        && event.previous_attributes.items.data[0]
        && event.object.items.data[0]) {
        const oldPlan = event.previous_attributes.items.data[0].plan;
        const newPlan = event.object.items.data[0].plan;
        if (oldPlan && newPlan) {
            if (oldPlan.amount !== newPlan.amount) {
                return true;
            }
        }
    }

    return false;
}

/**
 * @param {*} event
 * @returns true if the event is triggered by the user updating their card, false if not
 */
function isCardUpdate(event) {
    return event.data
        && event.data.previous_attributes
        && event.data.previous_attributes.default_payment_method;
}

async function processAmountUpdateEmail(event) {
    const customer = await stripe.customers.retrieve(
        event.object.customer,
    );
    customer.newDonationAmount = convertStripeAmountToMatchHowItIsDisplayedInTheDonationForm(
        event.object.items.data[0].plan.amount,
    );
    customer.oldDonationAmount = convertStripeAmountToMatchHowItIsDisplayedInTheDonationForm(
        event.previous_attributes.items.data[0].plan.amount,
    );
    return sendEmailAndLogResult(customer, emailService.sendAmountUpdatedEmail);
}

async function processCancelEmail(customerId) {
    const customer = await stripe.customers.retrieve(
        customerId,
    );
    return sendEmailAndLogResult(customer, emailService.sendCancelledEmail);
}

async function processCustomerCardExpiredPromptEmail(customer) {
    return sendEmailAndLogResult(customer, emailService.sendExpiredPromptEmail);
}

async function logCardUpdatedIfConnectedToCustomerWhoReceivedACardExpiringSoonEmail(subscription) {
    const subscriptionId = subscription.id;
    const customerId = subscription.customer;
    if (customerId && subscriptionId) {
        mongodbService.getCustomerFromCardExpireCollection(customerId).then((customer) => {
            if (customer) {
                if (customerId === customer.id && subscriptionId === customer.subscriptionId) {
                    mongodbRepo.markCustomerAsUpdatedTheirCard(customer);
                    console.log(`${customerId} marked as updating their card`);
                } else {
                    console.log(`${customerId} not marked as updating their card, subscription id doesn't match`);
                }
            } else {
                console.log(`${customerId} not marked as updating their card, Mongo returned: ${customer}`);
            }
        });
    } else {
        console.log(`${customerId} not marked as updating their card, invalid ids: ${customerId}, ${subscriptionId}`);
    }
}

async function processExpiringSoonEmail(invoice) {
    const customerBeenEmailedBefore = await hasCustomerBeenEmailedBefore(invoice);
    if (customerBeenEmailedBefore) {
        console.log(`${invoice.customer} has already been emailed about that expiring card.`);
        return false;
    }
    return new Promise((resolve, reject) => {
        getCustomerWithSubscriptionDetails(invoice).then((customer) => {
            if (customer.subscriptionStartDate === undefined) {
                customer.webhookTriggerInvoice = invoice;
                customer.error = "Can't find an active subscription which matches the invoice.";
                customer.notified = false;
                mongodbRepo.logEmailError(customer);
                console.log(customer.error);
                reject(customer);
            }
            if (dateChecker.isCardExpired(customer.card.exp_month, customer.card.exp_year)) {
                console.log(`${customer.id} should be sent a card expired email rather than an expiring soon email.`);
                reject(customer);
            }
            if (dateChecker.isCardExpiringSoon(customer.card.exp_month, customer.card.exp_year)) {
                customer.invoice = invoice;
                mongodbRepo.logCustomerWithCardExpiring(customer);
                resolve(sendEmailAndLogResult(customer, emailService.sendExpiringSoonEmail));
            } else {
                console.log(`${customer.id} card not expiring soon.`);
                reject(customer);
            }
        });
    });
}

async function hasCustomerBeenEmailedBefore(invoice) {
    return new Promise((resolve) => {
        getCustomerWithSubscriptionDetails(invoice).then((customer) => {
            mongodbService.wasCustomerSentACardExpireEmailAboutTheirCurrentCard(customer).then((result) => {
                resolve(result);
            });
        });
    });
}

async function getCustomerWithSubscriptionDetails(invoice) {
    const customer = await stripe.customers.retrieve(
        invoice.customer,
        {
            expand: ['subscriptions.data.default_payment_method'],
        },
    );
    return setSubscriptionDetailsOnCustomerObject(customer, invoice);
}

async function didPaymentIntentFailDueToACardExpiredError(paymentIntentId) {
    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(
            paymentIntentId,
        );
        if (paymentIntent && paymentIntent.last_payment_error) {
            console.log(`${paymentIntentId} failed with decline code ${paymentIntent.last_payment_error.decline_code}`);
            if (paymentIntent.last_payment_error.decline_code === 'expired_card') {
                return true;
            }
        }
    } catch (error) {
        console.log(
            `${error.message} -> Error during collecting payment intent to work out if a card invoice failed due to a card expire error.`,
        );
        return false;
    }
    return false;
}

function setSubscriptionDetailsOnCustomerObject(customer, invoice) {
    /**
     * The webhook which called this method will fire for every
     * customer who's card is expiring (even the non subscription ones).
     *
     * This loop below attempts to find a subscription start date for the
     * card which is expiring. If one doesn't exist then we shouldn't send
     * an email because it could be a one off donor's card who's expiring.
     */
    const updatedCustomer = customer;
    customer.subscriptions.data.forEach((subscription) => {
        if (invoice.subscription === subscription.id && (subscription.status === 'active' || subscription.status === 'past_due')) {
            updatedCustomer.subscriptionStartDate = dateChecker.convertUnixTimestampToDateString(subscription.start_date);
            const subscriptionItem = subscription.items.data[0];
            if (subscriptionItem) {
                updatedCustomer.subscriptionAmount = convertStripeAmountToMatchHowItIsDisplayedInTheDonationForm(subscriptionItem.price.unit_amount);
            }
            updatedCustomer.subscriptionId = subscription.id;
            if (subscription.default_payment_method && subscription.default_payment_method.card) {
                updatedCustomer.card = subscription.default_payment_method.card;
            }
        }
    });
    return updatedCustomer;
}

async function sendEmailAndLogResult(customer, emailFunction) {
    const alteredCustomer = customer;
    emailFunction(alteredCustomer).then((result) => {
        alteredCustomer.emailLogs = result;
        alteredCustomer.notified = result.successful;
        if (result.successful) {
            mongodbRepo.logEmailSuccess(alteredCustomer);
        } else {
            mongodbRepo.logEmailError(alteredCustomer);
        }
    });
    return alteredCustomer;
}

/**
 * Stripe stores donation amounts in grosz/cents/pennies.
 * So 5 zloties/dollars/pounds will be stored as 500 because of the grosz/cents.
 * We remove these extra zeroes because our donation form only takes zloties/dollars/pounds
 * @param {int} amount = amount in grosz/cents/pennies
 * @returns {int} convertedAmount = amount in zloties/dollars/pennies
 */
function convertStripeAmountToMatchHowItIsDisplayedInTheDonationForm(amount) {
    const convertedAmount = amount / 100;
    return convertedAmount;
}

async function retrieveSubscriptionId(intent) {
    let subscriptionId = '';

    if (intent.invoice) {
        const invoice = await stripe.invoices.retrieve(intent.invoice);
        const customer = await getCustomerWithSubscriptionDetails(invoice);
        subscriptionId = customer.subscriptionId;
    }

    return subscriptionId;
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Running on port', port));
