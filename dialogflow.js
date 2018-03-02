require('dotenv').config();
const apiai = require('apiai');

const apiaiApp = apiai(process.env.DIALOG_FLOW_TOKEN);

async function textRequest(text, messengerUserId) {
    return new Promise((resolve, reject) => {
        const request = apiaiApp.textRequest(text, {
            sessionId: messengerUserId
        });
        request.on('response', (response) => {
            resolve(response);
        });
        request.on('error', (error) => {
            console.log(error);
            reject(error);
        });
        request.end();
    });
}

async function eventRequest(eventName, sessionId) {
    return new Promise((resolve, reject) => {
        const event = {
            name: eventName,
            // data: {
            //     // param1: "param1 value",
            // }
        };
        const options = {
            sessionId: sessionId,
        };
        const request = apiaiApp.eventRequest(event, options);
        request.on('response', function(response) {
            resolve(response);
        });
        request.on('error', function(error) {
            console.log(error);
            reject(error);
        });
        request.end();
    });
}

module.exports = {
    textRequest,
    eventRequest,
}
