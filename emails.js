const nodemailer = require('nodemailer');
const fs = require('fs');
const { google } = require('googleapis');

const { GOOGLE_CLIENT_ID } = process.env;
const { GOOGLE_CLIENT_SECRET } = process.env;
const { GOOGLE_0AUTH_REFRESH_TOKEN } = process.env;
const { OAuth2 } = google.auth;
const oauth2Client = new OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground',
);
oauth2Client.setCredentials({
    refresh_token: GOOGLE_0AUTH_REFRESH_TOKEN,
});

module.exports = {
    async sendCancelledEmail(recipient) {
        recipient.emailType = 'subscriptionCancelled';
        const mailOptions = getAdminCancelledMailOptions(recipient);
        return sendEmail(recipient, mailOptions);
    },
    async sendExpiringSoonEmail(recipient) {
        recipient.emailType = 'cardExpiringSoon';
        recipient.sentCardExpiringSoonEmail = true;
        const mailOptions = getExpiringSoonMailOptions(recipient);
        return sendEmail(recipient, mailOptions);
    },
    async sendExpiredPromptEmail(recipient) {
        recipient.emailType = 'cardExpired';
        recipient.sentPromptEmailAfterTwoMonths = true;
        const mailOptions = getExpiredPromptMailOptions(recipient);
        return sendEmail(recipient, mailOptions);
    },
    async sendReceiptEmail(recipient) {
        recipient.emailType = 'receipt';
        const mailOptions = getReceiptMailOptions(recipient);
        return sendEmail(recipient, mailOptions);
    },
    async sendAmountUpdatedEmail(recipient) {
        recipient.emailType = 'subscriptionAmountUpdated';
        const mailOptions = getAmountUpdatedMailOptions(recipient);
        return sendEmail(recipient, mailOptions);
    },
    formatDateString,
    getFirstName,
};

async function sendEmail(recipient, mailOptions) {
    try {
        const transporter = getTransporter();
        let error; const
            info = await transporter.sendMail(mailOptions);
        if (error) {
            console.error(`Email error: ${error}`);
            return { successful: false, details: error };
        }
        console.log(`Email sent to ${recipient.email}: ${info.response}`);
        return { successful: true, details: info };
    } catch (exception) {
        console.error(`Email exception: ${exception}`);
        return { successful: false, details: `${exception}`, exceptionObject: exception };
    }
}

function getTransporter() {
    const accessToken = oauth2Client.getAccessToken();
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: process.env.NOTIFY_EMAIL_ADDRESS,
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            refreshToken: GOOGLE_0AUTH_REFRESH_TOKEN,
            accessToken,
        },
    });
}

function getAdminCancelledMailOptions(recipient) {
    return {
        from: `"Olka - Otwarte Klatki" ${process.env.NOTIFY_EMAIL_ADDRESS}`,
        to: recipient.email,
        subject: `${getFirstName(recipient.name)}, Twoja karta płatności została odłączona.`,
        html: getCancelledRecurringDonationEmail(recipient),
    };
}

function getExpiringSoonMailOptions(recipient) {
    return {
        from: `"Olka - Otwarte Klatki" ${process.env.NOTIFY_EMAIL_ADDRESS}`,
        to: recipient.email,
        subject: `${getFirstName(recipient.name)}, Twoja karta niedługo straci ważność - poświęć chwilę i odnów swoje dane.`,
        html: getExpiringSoonEmail(recipient),
    };
}

function getExpiredPromptMailOptions(recipient) {
    return {
        from: `"Olka - Otwarte Klatki" ${process.env.NOTIFY_EMAIL_ADDRESS}`,
        to: recipient.email,
        subject: `${getFirstName(recipient.name)}, Twoja karta straciła ważność - poświęć chwilę i odnów swoje dane.`,
        html: getExpiringPromptEmail(recipient),
    };
}

function getAmountUpdatedMailOptions(recipient) {
    return {
        from: `"Olka - Otwarte Klatki" ${process.env.NOTIFY_EMAIL_ADDRESS}`,
        to: recipient.email,
        subject: `${getFirstName(recipient.name)}, kwota Twojej darowizny dla zwierząt została zmieniona.`,
        html: getAmountUpdatedEmail(recipient),
    };
}

function getReceiptMailOptions(recipient) {
    return {
        from: `"Olka - Otwarte Klatki" ${process.env.NOTIFY_EMAIL_ADDRESS}`,
        to: recipient.email,
        subject: `${getFirstName(recipient.name)}, przesyłamy potwierdzenie Twojej darowizny razem z serdecznymi podziękowaniami!`,
        html: getReceiptEmail(recipient),
    };
}

function getReceiptEmail(recipient) {
    let html = fs.readFileSync('./emailContent/receipt-inline.html', 'utf8').toString();
    html = html.replace('$Name', getFirstName(recipient.name));
    html = html.replace('$Date', formatDateString(recipient.donationDate));
    html = html.replace('$Description', recipient.donationDescription);
    html = html.replace('$Amount', recipient.donationAmount);
    return html;
}

function getAmountUpdatedEmail(recipient) {
    let html = fs.readFileSync('./emailContent/amount-updated-inline.html', 'utf8').toString();
    html = html.replace('$Name', getFirstName(recipient.name));
    html = html.replace('$Name', getFirstName(recipient.name));
    html = html.replace('$OldPrice', recipient.oldDonationAmount);
    html = html.replace('$NewPrice', recipient.newDonationAmount);
    return html;
}

function getCancelledRecurringDonationEmail(recipient) {
    let html = fs.readFileSync('./emailContent/recurring-donation-cancelled-inline.html', 'utf8').toString();
    html = html.replace('$Name', getFirstName(recipient.name));
    return html;
}

function getExpiringSoonEmail(recipient) {
    let html = fs.readFileSync('./emailContent/expiringSoon-inline.html', 'utf8').toString();
    html = html.replace('$Name', getFirstName(recipient.name));
    html = html.replace('$DateOfSubscription', formatDateString(recipient.subscriptionStartDate));
    html = html.replace('$CardBrand', recipient.card.brand);
    html = html.replace('$CardLast4', recipient.card.last4);
    html = html.replace('$CardExpMonth', recipient.card.exp_month);
    html = html.replace('$CardExpYear', recipient.card.exp_year.toString().substr(recipient.card.exp_year.length - 2));
    const subscriptionUpdateUrl = `https://donate.otwarteklatki.pl/subscription/update?name=${recipient.name}`
        + `&subscriptionId=${recipient.subscriptionId}`
        + `&customerId=${recipient.id}`
        + `&amount=${recipient.subscriptionAmount}`
        + `&email=${recipient.email}`;
    html = html.replace('$SubscriptionUpdateLink', subscriptionUpdateUrl);
    return html;
}

function getExpiringPromptEmail(recipient) {
    let html = fs.readFileSync('./emailContent/card-expired-prompt-inline.html', 'utf8').toString();
    html = html.replace('$Name', getFirstName(recipient.name));
    html = html.replace('$DateOfSubscription', formatDateString(recipient.subscriptionStartDate));
    html = html.replace('$CardBrand', recipient.card.brand);
    html = html.replace('$CardLast4', recipient.card.last4);
    html = html.replace('$CardExpMonth', recipient.card.exp_month);
    html = html.replace('$CardExpYear', recipient.card.exp_year.toString().substr(recipient.card.exp_year.length - 2));
    const subscriptionUpdateUrl = `https://donate.otwarteklatki.pl/subscription/update?name=${recipient.name}`
        + `&subscriptionId=${recipient.subscriptionId}`
        + `&customerId=${recipient.id}`
        + `&amount=${recipient.subscriptionAmount}`
        + `&email=${recipient.email}`;
    html = html.replace('$SubscriptionUpdateLink', subscriptionUpdateUrl);
    return html;
}

function formatDateString(date) {
    // one replace for each / in a date string 05/05/2005 -> 05.05.2005
    return date.replace('/', '.').replace('/', '.');
}

function getFirstName(fullName) {
    return fullName.trim().split(' ')[0];
}
