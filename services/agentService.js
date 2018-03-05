const { log } = require('../config/bunyan');
const lodash = require('lodash');
const request = require('request-promise-native');

async function getConverationHistory(conversationId, accountId, domain, token) {
  try {
    const url = `https://${domain}/messaging_history/api/account/${accountId}/conversations/conversation/search`;
    const params = {
      method: 'POST',
      url,
      headers: { Authorization: `Bearer ${token}` },
      body: { conversationId },
      json: true,
    };
    const requestResponse = await request(params);
    return requestResponse;
  } catch (error) {
    log.error(error);
    return error;
  }
}

async function lastSeq(agentOptions, convId) {
  try {
    const { accountId, token } = agentOptions;
    const domain = 'va.msghist.liveperson.net';
    let messageHistory = await getConverationHistory(convId, accountId, domain, token);
    // log.info(messageHistory.conversationHistoryRecords);
    if (!messageHistory.conversationHistoryRecords || !messageHistory.conversationHistoryRecords[0]) {
      log.info('Retry');
      messageHistory = await getConverationHistory(convId, accountId, domain, token);
    }
    const messages = messageHistory.conversationHistoryRecords[0].messageStatuses;
    if (!messages && messages.length === 0) return 0;
    return lodash.maxBy(messages, message => message.seq).seq;
  } catch (error) {
    log.error(error);
    return error;
  }
}

module.exports = {
  lastSeq,
};
