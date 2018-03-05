const apiai = require('apiai');
const { log } = require('../config/bunyan');

const apiaiApp = apiai(process.env.DIALOG_FLOW_TOKEN);

async function textRequest(text, messengerUserId) {
  return new Promise((resolve, reject) => {
    const request = apiaiApp.textRequest(text, {
      sessionId: messengerUserId,
    });
    request.on('response', (response) => {
      resolve(response);
    });
    request.on('error', (error) => {
      log.error(error);
      reject(error);
    });
    request.end();
  });
}

async function eventRequest(eventName, sessionId) {
  return new Promise((resolve, reject) => {
    const event = {
      name: eventName,
    };
    const options = { sessionId };
    const request = apiaiApp.eventRequest(event, options);
    request.on('response', (response) => {
      resolve(response);
    });
    request.on('error', (error) => {
      log.error(error);
      reject(error);
    });
    request.end();
  });
}

module.exports = {
  textRequest,
  eventRequest,
};
