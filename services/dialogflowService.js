const apiai = require('apiai');
const { log } = require('../config/bunyan');

const apiaiApp = apiai(process.env.DIALOG_FLOW_TOKEN);

async function textRequest(text, sessionId) {
  return new Promise((resolve, reject) => {
    const request = apiaiApp.textRequest(text, { sessionId });
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

async function eventRequest(name, sessionId) {
  return new Promise((resolve, reject) => {
    const request = apiaiApp.eventRequest({ name }, { sessionId });
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
