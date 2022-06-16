/* eslint-disable no-else-return */
const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const salesforceService = require('./salesforceService');
const stripeService = require('./stripeService');

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const app = express();
app.use(morgan('combined'));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.json({ status: 'alive' });
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
    let subscription; let intent; let charge;
    switch (event.type) {
    case 'customer.subscription.deleted':
        console.log(`Processing event type ${event.type}`);
        subscription = event.data.object;
        await handleSubscriptionDeletion(subscription);
        break;
    case 'customer.subscription.updated':
        console.log(`Processing event type ${event.type}`);
        subscription = event.data.object;
        if (isCardUpdate(event)) {
            subscription.customer.stripeEvent = event.type;
            await handleCardUpdate(subscription);
        } else if (isAmountUpdate(event.data)) {
            await handleAmountUpdate(subscription);
        } else {
            console.log(`${event.type} not processed due to not being an amount change or card update.`);
        }
        break;
    case 'payment_intent.succeeded':
        console.log(`Processing event type ${event.type}`);
        intent = event.data.object;
        await handleSuccessfulPayment(intent);
        break;
    case 'charge.refunded':
        console.log(`Processing event type ${event.type}`);
        charge = event.data.object;
        await handleRefund(charge);
        break;
    default:
        console.log(`Unhandled event type ${event.type}`);
    }
    // Return a response to acknowledge receipt of the event
    response.json({ received: true });
});

async function handleSubscriptionDeletion(subscription) {
    try {
        await salesforceService.sendCanceledSubscriptionToSalesforce(subscription);
    } catch (error) {
        console.error(error);
    }
}

async function handleRefund(charge) {
    try {
        await salesforceService.sendRefund(charge);
    } catch (error) {
        console.error(error);
    }
}

async function handleSuccessfulPayment(intent) {
    try {
        intent.subscription_id = await stripeService.retrieveSubscriptionId(intent);
        await salesforceService.sendPaymentToSalesforce(intent);
    } catch (error) {
        console.error(error);
    }
}

async function handleAmountUpdate(subscription) {
    try {
        await salesforceService.sendUpdatedSubscriptionToSalesforce(subscription);
    } catch (error) {
        console.error(error);
    }
}

async function handleCardUpdate(subscription) {
    try {
        await salesforceService.sendUpdatedSubscriptionToSalesforce(subscription);
    } catch (error) {
        console.error(error);
    }
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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Running on port', port));
