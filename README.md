# stripe-webhooks (previously known as stripe-card-expire-notify and stripe-email-webhooks)
Sends an emails to a donors for a variety of donation related reasons, it also manages the results of webhooks for BLIK recurring donations.

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
    ENV MONGO_DB_URI=
    ENV NOTIFY_EMAIL_ADDRESS=donations@opencages.org
    ENV GOOGLE_CLIENT_ID=749689316963-b7c93fvlqtk94d371mart7i8ipml1qkd.apps.googleusercontent.com
    ENV GOOGLE_CLIENT_SECRET=rdkvG5u6xAlyR0jatZWriQW_
    ENV GOOGLE_0AUTH_REFRESH_TOKEN=1//0fU67qireiPJ1CgYIARAAGA8SNwF-L9IrLCvkbEQUfREDU6ebFpbSGZuyHHfGI4YAC7Foe_ZmPGv_XSjJIhMMSt9Vthe0kAyEHgg
    ENV SALESFORCE_USERNAME=test-ivjqnxgzqkvo@example.com
    ENV SALESFORCE_PASSWORD=#4Xkeihqtsnei
    ENV SALESFORCE_CLIENT_ID=3MVG9sSN_PMn8tjRVL7I.MX.uG3ps4Dyop6ChtUw7QYpF951eoheb79Ncf8G5WQAhYRgGT8TMSnOPY1yDY1.l
    ENV SALESFORCE_CLIENT_SECRET=DDC312345A768AA96595178E8C98BDB520CD3705D5ABAA5BD3C4768944B9EADC
    ENV SALESFORCE_URL=https://efficiency-enterprise-2129-dev-ed.cs89.my.salesforce.com/services/
    ENV ENABLE_SALESFORCE_SENDING=false // This is used to disable salesforce sending on environments which aren't linked to a salesforce environment
```

### But where do I find these environment variables?
- STRIPE_WEBHOOK_SECRET - [find this when running the stripe cli for webhooks.](#debugging-stripe-webhooks-locally)
- STRIPE_SECRET_KEY - find in the stripe dashboard
- MONGO_DB_URI - run your own mongodb locally or get a free one using mongo atlas.
- SALESFORCE_... - set up your local salesforce environment from [here](https://github.com/otwarteklatki/ok-sf-payment-handler-stripe) and follow the instructions in the readme. 

All the other env vars are pre filled out to use a development Open Cages email. Please don't share these credentials publically. 

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

# Image hosting for emails

We use Anima DK's digital ocean space for image hosting in the emails. Under image-repository-public/email-images-otwarteklatki in their spaces. You can gain access to this to upload/delete images by contacting Joh Vinding or Max Harris on slack.

If you are unable to access it though these images just need to be hosted somewhere so you can stick them in any old S3 bucket / Google cloud storage if it comes to it.

# Inlining HTML

Email clients suck so we need to inline emails. You can do that here: https://htmlemail.io/inline/

I would recommend change expired.html if you need to and then copy and paste it into the website and then get the result and plonk it into the expired-inline.html

# How to deploy to production
push to master

# Production url
https://webhooks.donate.otwarteklatki.pl

# How to get Auth credentials to test on a new email address: 

Follow this amazing guide on medium to get all the Google client environment variables:
https://medium.com/@nickroach_50526/sending-emails-with-node-js-using-smtp-gmail-and-oauth2-316fe9c790a1
