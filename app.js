require('dotenv').config();
const { log } = require('./config/bunyan');
const lodash = require('lodash');
const Agent = require('./megaAgent');
const tendernessBots = require('./config/tendernesBots');
const apiai = require('apiai');

const megaAgent = new Agent({
  accountId: process.env.LP_ACCOUNT_ID,
  username: process.env.LP_USER_NAME,
  appKey: process.env.LP_AGENT_APP_KEY,
  secret: process.env.LP_AGENT_SECRET,
  accessToken: process.env.LP_AGENT_ACCESS_TOKEN,
  accessTokenSecret: process.env.LP_AGENT_ACCESS_TOKEN_SECRET,
});

async function dialogFlowRequest(text, messengerUserId) {
  return new Promise((resolve, reject) => {
    const apiaiApp = apiai(process.env.DIALOG_FLOW_TOKEN);
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

function updateConversation(dialogId, updates) {
  megaAgent.updateConversationField({
    conversationId: dialogId,
    conversationField: updates,
  }, (err, res) => {
    if (err) log.error(err);
    log.info(res);
  });
}

megaAgent.on('MegaAgent.ContentEvent', async (contentEvent) => {
  log.info('Content Event', contentEvent);
  const DFResponse = await dialogFlowRequest(
    contentEvent.message,
    contentEvent.dialogId
  );
  if (lodash.isString(contentEvent.message) && contentEvent.message.startsWith('#close')) {
    updateConversation(
      contentEvent.dialogId,
      [{
        field: 'ConversationStateField',
        conversationState: 'CLOSE',
      }],
    );
  } else if (DFResponse.result.action == '#toBot1') {
    log.info('Change bot to Sample Bot');
    updateConversation(
      contentEvent.dialogId,
      [
        {
          field: 'ParticipantsChange',
          type: 'REMOVE',
          role: 'ASSIGNED_AGENT',
        },
        {
          field: 'Skill',
          type: 'UPDATE',
          skill: tendernessBots.sampleBotId1,
        },
      ],
    );
  } else if (DFResponse.result.action == '#toBot2') {
    log.info('Change bot to Sample Bot');
    updateConversation(
      contentEvent.dialogId,
      [
        {
          field: 'ParticipantsChange',
          type: 'REMOVE',
          role: 'ASSIGNED_AGENT',
        },
        {
          field: 'Skill',
          type: 'UPDATE',
          skill: tendernessBots.sampleBotId2,
        },
      ],
    );
  } else {
    megaAgent.publishEvent({
      dialogId: contentEvent.dialogId,
      event: {
        type: 'ContentEvent',
        contentType: 'text/plain',
        message: `Echo from Router Bot: ${contentEvent.message}`,
      },
    });
    log.info('Publish Event');
  }
});
