# ok-sf-stripe-webhooks
Sends stripe data to salesforce

# Run Locally

## Node Version 
```
    $ node -v
    v16.8.0
```

## Install
```
    $ npm install
```

## Run
```
    $ npm run dev
```
This should restart upon file change.

## Environment variables

You'll need to fill these out on your local environment to run the project:
```
    ENV STRIPE_SECRET_KEY=
    ENV STRIPE_WEBHOOK_SECRET=
    ENV SALESFORCE_USERNAME=test-ivjqnxgzqkvo@example.com
    ENV SALESFORCE_PASSWORD=#4Xkeihqtsnei
    ENV SALESFORCE_CLIENT_ID=3MVG9sSN_PMn8tjRVL7I.MX.uG3ps4Dyop6ChtUw7QYpF951eoheb79Ncf8G5WQAhYRgGT8TMSnOPY1yDY1.l
    ENV SALESFORCE_CLIENT_SECRET=DDC312345A768AA96595178E8C98BDB520CD3705D5ABAA5BD3C4768944B9EADC
    ENV SALESFORCE_URL=https://efficiency-enterprise-2129-dev-ed.cs89.my.salesforce.com/services/
```

### But where do I find these environment variables?
- STRIPE_WEBHOOK_SECRET - [find this when running the stripe cli for webhooks.](#debugging-stripe-webhooks-locally)
- STRIPE_SECRET_KEY - find in the stripe dashboard
- SALESFORCE_... - set up your local salesforce environment from [here](https://github.com/otwarteklatki/ok-sf-payment-handler) and follow the instructions in the readme. 

## Lint
Messy code can lead to bugs :) 

In the root directory:
```
    eslint .
```

To autofix some things:
```
    eslint . --fix
```

## Tests
Run these before pushing or your build will break. Also add new tests for any new logic added.

In the root directory:
```
    npm run test
```

# Debugging stripe webhooks locally

In short, download the stripe CLI and run this command:
```
    stripe listen --forward-to localhost:3000/webhook
```

And then to fire off events, in a different cmd run: 
```
    stripe trigger customer.subscription.deleted
```
replace customer.subscription.deleted with your desired stripe event. 

Also if you're trying to test the receipt emails then you can just make a donation [here.](https://staging.donate.otwarteklatki.pl) with the test card details: 
```
    Card number: 4242 4242 4242 4242
    expire date: any numbers
    cvc: any numbers
    zip code: any numbers
```

Note: sometimes you may need to restart both npm and the webhook for it to pick up...

See the full documentation [here.](https://stripe.com/docs/webhooks/test)

# How to deploy to production
push to main

# Production url
https://sf-webhooks.donate.otwarteklatki.pl

# How to deploy to staging
push to staging

# Staging url
https://ok-sf-stripe-webhooks-staging-uepvew4upa-ew.a.run.app
