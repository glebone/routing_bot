// require('dotenv').config();
const lodash = require('lodash');
const config = require('./config/config');
const { log } = require('./config/bunyan');
const Agent = require('./megaAgent');
const tendernessBots = require('./config/tendernesBots');
const dialogflow = require('./services/dialogflowService');

const megaAgent = new Agent({
  accountId: config.LP.accountId,
  username: config.LP.username,
  appKey: config.LP.appKey,
  secret: config.LP.secret,
  accessToken: config.LP.accessToken,
  accessTokenSecret: config.LP.accessTokenSecret,
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
    } else if (contentEvent.message.startsWith(config.DIALOG_FLOW.eventSymbol)) {
      const eventStr = contentEvent.message
        .substring(config.DIALOG_FLOW.eventSymbol.length, contentEvent.message.length);
      const event = await dialogflow.eventRequest('WELCOME', eventStr);
      megaAgent.publishEvent({
        dialogId: contentEvent.dialogId,
        event: {
          type: 'ContentEvent',
          contentType: 'text/plain',
          message: `echo tender sample: ${event.result.fulfillment.speech}`,
        },
      });
    } else if (contentEvent.message.startsWith(config.DIALOG_FLOW.skillSymbol)) {
      const skillStr = contentEvent.message
        .substring(config.DIALOG_FLOW.eventSymbol.length, contentEvent.message.length);
      const skill = await dialogflow.eventRequest('WELCOME', skillStr);
      megaAgent.publishEvent({
        dialogId: contentEvent.dialogId,
        event: {
          type: 'ContentEvent',
          contentType: 'text/plain',
          message: `echo tender sample: ${skill.result.fulfillment.speech}`,
        },
      });
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
