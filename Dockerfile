# Use the official lightweight Node.js 12 image.
# https://hub.docker.com/_/node
FROM node:16.15.0-slim

# dev environment variables
ENV STRIPE_SECRET_KEY=
ENV STRIPE_WEBHOOK_SECRET=
ENV SALESFORCE_USERNAME=test-ivjqnxgzqkvo@example.com
ENV SALESFORCE_PASSWORD=#4Xkeihqtsnei
ENV SALESFORCE_CLIENT_ID=3MVG9sSN_PMn8tjRVL7I.MX.uG3ps4Dyop6ChtUw7QYpF951eoheb79Ncf8G5WQAhYRgGT8TMSnOPY1yDY1.l
ENV SALESFORCE_CLIENT_SECRET=DDC312345A768AA96595178E8C98BDB520CD3705D5ABAA5BD3C4768944B9EADC
ENV SALESFORCE_URL=https://efficiency-enterprise-2129-dev-ed.cs89.my.salesforce.com/services/

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
# Copying this separately prevents re-running npm install on every code change.
COPY package*.json ./

# Install production dependencies.
RUN npm install

# Copy local code to the container image.
COPY . ./

# Make sure tests pass before a successful build
RUN npm run test

# Make sure the linter passes before a successful build
RUN npm -g i eslint-cli
RUN eslint .

# Run the web service on container startup.
CMD [ "npm", "start" ]
