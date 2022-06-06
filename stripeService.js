const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const dateChecker = require('./dateChecker');

module.exports = {
    async retrieveSubscriptionId(intent) {
        let subscriptionId = '';

        if (intent.invoice) {
            const invoice = await stripe.invoices.retrieve(intent.invoice);
            const customer = await getCustomerWithSubscriptionDetails(invoice);
            subscriptionId = customer.subscriptionId;
        }

        return subscriptionId;
    },
};

async function getCustomerWithSubscriptionDetails(invoice) {
    const customer = await stripe.customers.retrieve(
        invoice.customer,
        {
            expand: ['subscriptions.data.default_payment_method'],
        },
    );
    return setSubscriptionDetailsOnCustomerObject(customer, invoice);
}

/**
 * The webhook which called this method will fire for every
 * customer who's card is expiring (even the non subscription ones).
 *
 * This loop below attempts to find a subscription start date for the
 * card which is expiring. If one doesn't exist then we shouldn't send
 * an email because it could be a one off donor's card who's expiring.
 */
function setSubscriptionDetailsOnCustomerObject(customer, invoice) {
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
