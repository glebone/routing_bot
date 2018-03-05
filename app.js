require('dotenv').config();
const { log } = require('./config/bunyan');
const lodash = require('lodash');
const Agent = require('./megaAgent');
const tendernessBots = require('./config/tendernesBots');
const dialogflow = require('./services/dialogflowService');

const megaAgent = new Agent({
  accountId: process.env.LP_ACCOUNT_ID,
  username: process.env.LP_USER_NAME,
  appKey: process.env.LP_AGENT_APP_KEY,
  secret: process.env.LP_AGENT_SECRET,
  accessToken: process.env.LP_AGENT_ACCESS_TOKEN,
  accessTokenSecret: process.env.LP_AGENT_ACCESS_TOKEN_SECRET,
});

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
  try {
    const DFResponse = await dialogflow.textRequest(
      contentEvent.message,
      contentEvent.dialogId,
    );
    if (lodash.isString(contentEvent.message) && contentEvent.message.startsWith('#close')) {
      updateConversation(
        contentEvent.dialogId,
        [{
          field: 'ConversationStateField',
          conversationState: 'CLOSE',
        }],
      );
    } else if (DFResponse.result.action === '#toBot1') {
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
    } else if (DFResponse.result.action === '#toBot2') {
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
          message: `Echo from Mega Bot: ${DFResponse.result.fulfillment.speech}`,
        },
      });
      log.info('Publish Event');
    }
  } catch (err) {
    log.error(err);
  }
});
