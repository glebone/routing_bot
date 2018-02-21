FROM node:8.9.4

WORKDIR /src
ADD package.json /src/package.json
RUN npm install --only=prod

COPY . .
