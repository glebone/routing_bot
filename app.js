require('dotenv').config();
const { log } = require('./config/bunyan');
const lodash = require('lodash');

const Agent = require('./megaAgent');
const tendernessBots = require('./config/tendernesBots');

const megaAgent = new Agent({
  accountId: process.env.LP_ACCOUNT_ID,
  username: process.env.LP_USER_NAME,
  appKey: process.env.LP_AGENT_APP_KEY,
  secret: process.env.LP_AGENT_SECRET,
  accessToken: process.env.LP_AGENT_ACCESS_TOKEN,
  accessTokenSecret: process.env.LP_AGENT_ACCESS_TOKEN_SECRET,
});

megaAgent.on('MegaAgent.ContentEvent', (contentEvent) => {
  log.info('Content Event', contentEvent);
  if (lodash.isString(contentEvent.message) && contentEvent.message.startsWith('#close')) {
    megaAgent.updateConversationField({
      conversationId: contentEvent.dialogId,
      conversationField: [{
        field: 'ConversationStateField',
        conversationState: 'CLOSE',
      }],
    });
  } else if (lodash.isString(contentEvent.message) && contentEvent.message.startsWith('#transferToSampleBot')) {
    log.info('Change bot to Sample Bot');
    megaAgent.updateConversationField({
      conversationId: contentEvent.dialogId,
      conversationField: [
        {
          field: 'ParticipantsChange',
          type: 'REMOVE',
          role: 'ASSIGNED_AGENT',
        },
        {
          field: 'Skill',
          type: 'UPDATE',
          skill: tendernessBots.sampleBotId,
        },
      ],
    });
  } else {
    megaAgent.publishEvent({
      dialogId: contentEvent.dialogId,
      event: {
        type: 'ContentEvent',
        contentType: 'text/plain',
        message: `echo routing_bot: ${contentEvent.message}`,
      },
    });
    // log.info(contentEvent.dialogId);
    // Template for a structured content.
    // echoAgent.publishEvent({
    //   dialogId: contentEvent.dialogId,
    //   event: {
    //     type: 'RichContentEvent',
    //     content: {
    //       type: 'vertical',
    //       elements: [
    //         {
    //           type: 'text',
    //           text: `echo routing_bot: ${contentEvent.message}`,
    //           tooltip: 'product name (Title)',
    //           style: {
    //             bold: true,
    //             size: 'large',
    //           },
    //         },
    //         {
    //           type: 'text',
    //           text: `echo routing_bot: ${contentEvent.message}`,
    //           tooltip: 'product name (Title)',
    //         },
    //         {
    //           type: 'image',
    //           url: 'https://i.imgur.com/ZOM7GQx.png',
    //           caption: 'This is an example of image caption',
    //           tooltip: 'image tooltip',
    //         },
    //       ],
    //     },
    //   },
    // }, null, [{
    //   type: 'ExternalId',
    //   id: 'CARD IDENTIFIER',
    // }], (err, res) => {
    //   if (err) log.error(err);
    //   log.info(res);
    // });
    log.info('Publish Event');
  }
});
