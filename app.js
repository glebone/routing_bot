require('dotenv').config();
const config = require('./config/config');
const { log } = require('./config/bunyan');
const Agent = require('./megaAgent');
const dialogflow = require('./services/dialogflowService');

const megaAgent = new Agent({
  accountId: config.LP.accountId,
  username: config.LP.username,
  appKey: config.LP.appKey,
  secret: config.LP.secret,
  accessToken: config.LP.accessToken,
  accessTokenSecret: config.LP.accessTokenSecret,
});

function transferToSkill(convId, newSkill) {
  megaAgent.updateConversationField({
    conversationId: convId,
    conversationField: [
      {
        field: 'ParticipantsChange',
        type: 'REMOVE',
        role: 'ASSIGNED_AGENT',
      },
      {
        field: 'Skill',
        type: 'UPDATE',
        skill: newSkill.toString(),
      },
    ],
  });
}

function handleDialogFlowResponse(response, contentEvent) {
  if (
    response.result.fulfillment.messages &&
    response.result.fulfillment.messages[0] &&
    response.result.fulfillment.messages[0].speech
  ) {
    megaAgent.publishEvent(
      {
        dialogId: contentEvent.dialogId,
        event: {
          type: 'ContentEvent',
          contentType: 'text/plain',
          message: response.result.fulfillment.messages[0].speech,
        },
      },
      () => {
        if (
          response.result.fulfillment.messages[1] &&
          response.result.fulfillment.messages[1].payload
        ) {
          megaAgent.publishEvent(
            {
              dialogId: contentEvent.dialogId,
              event: {
                type: 'RichContentEvent',
                content: response.result.fulfillment.messages[1].payload,
              },
            },
            (err) => {
              if (err) log.error(err);
            },
          );
        }
      },
    );
  } else {
    log.error("Can't get correct response from dialogflow.");
  }
}

megaAgent.on('MegaAgent.ContentEvent', async (contentEvent) => {
  log.debug('Content Event', contentEvent);
  try {
    if (contentEvent.message.startsWith(config.DIALOG_FLOW.eventPrefix)) {
      const eventStr = contentEvent.message.substring(
        config.DIALOG_FLOW.eventPrefix.length,
        contentEvent.message.length,
      );
      const response = await dialogflow.eventRequest(eventStr, contentEvent.dialogId);
      handleDialogFlowResponse(response, contentEvent);
    } else if (contentEvent.message.startsWith(config.DIALOG_FLOW.skillPrefix)) {
      const skillStr = contentEvent.message.substring(
        config.DIALOG_FLOW.skillPrefix.length,
        contentEvent.message.length,
      );
      if (Number.isInteger(Number.parseInt(skillStr, 10))) {
        log.info('Transferring to skill', skillStr);
        transferToSkill(contentEvent.dialogId, skillStr);
      } else {
        log.error(`Skill '${skillStr}' is not an integer.`);
      }
    } else {
      const response = await dialogflow.textRequest(contentEvent.message, contentEvent.dialogId);
      handleDialogFlowResponse(response, contentEvent);
    }
  } catch (err) {
    log.error(err);
  }
});
