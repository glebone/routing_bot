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

function checkSkillCommand(text, convId) {
  if (!text.startsWith(config.DIALOG_FLOW.skillPrefix)) {
    return false;
  }
  const skillStr = text.substring(
    config.DIALOG_FLOW.skillPrefix.length,
    text.length,
  );
  if (Number.isInteger(Number.parseInt(skillStr, 10))) {
    log.info('Transferring to skill', skillStr);
    transferToSkill(convId, skillStr);
  } else {
    log.error(`Skill '${skillStr}' is not an integer.`);
  }
  return true;
}

function handleDialogFlowResponse(response, convId) {
  const speech =
    response.result.fulfillment.messages &&
    response.result.fulfillment.messages[0] &&
    response.result.fulfillment.messages[0].speech;
  if (!speech) {
    log.error("Can't get correct response from dialogflow.");
    return;
  }
  if (checkSkillCommand(speech, convId)) {
    return;
  }
  megaAgent.publishEvent(
    {
      dialogId: convId,
      event: {
        type: 'ContentEvent',
        contentType: 'text/plain',
        message: speech,
      },
    },
    () => {
      const payload =
          response.result.fulfillment.messages[1] &&
          response.result.fulfillment.messages[1].payload;
      if (!payload) {
        return;
      }
      megaAgent.publishEvent(
        {
          dialogId: convId,
          event: {
            type: 'RichContentEvent',
            content: payload,
          },
        },
        (err) => {
          if (err) log.error(err);
        },
      );
    },
  );
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
      handleDialogFlowResponse(response, contentEvent.dialogId);
    } else if (!checkSkillCommand(contentEvent.message, contentEvent.dialogId)) {
      const response = await dialogflow.textRequest(contentEvent.message, contentEvent.dialogId);
      handleDialogFlowResponse(response, contentEvent.dialogId);
    }
  } catch (err) {
    log.error(err);
  }
});
