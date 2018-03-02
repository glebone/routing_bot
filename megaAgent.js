const { log } = require('./config/bunyan');
const { Agent } = require('node-agent-sdk');
const rp = require('request-promise-native');
const _ = require('lodash');
const dialogflow = require('./dialogflow');

// class TokenDomain {
//   constructor() {
//     const reqData = getTokenAndDomainMsgHist()
//     .then((res) => {
//       this.domain = reqData.domain;
//       this.token = reqData.token;
//     })
//     .catch((err) => {
//       console.log(err);
//     })
//   };

//   async getTokenAndDomain(){
//     if (this.token && this.domain) {
//       return { 
//         token: this.token, 
//         domain: this.domain 
//       };
//     } else {
//       const reqData = await getTokenAndDomainMsgHist();
//       this.token = reqData.token;
//       this.domain = reqData.domain;
//       return await this.getTokenAndDomain();
//     }
//   }
// }

// const tokenDomain = new TokenDomain();

function getTokenAndDomainMsgHist() {
  const options = {
    method: 'POST',
    uri: `https://va.agentvep.liveperson.net/api/account/${process.env.LP_ACCOUNT_ID}/login?v=1.3`,
    body: {
      "username": process.env.LP_USER_NAME,
      "appKey": process.env.LP_AGENT_APP_KEY,
      "secret": process.env.LP_AGENT_SECRET,
      "accessToken": process.env.LP_AGENT_ACCESS_TOKEN,
      "accessTokenSecret": process.env.LP_AGENT_ACCESS_TOKEN_SECRET,
    },
    json: true
  };

  return rp(options)
    .then((parsedBody) => {
      const baseURIelement = parsedBody.csdsCollectionResponse.baseURIs.find((el) => { if (el.service === 'msgHist') return el });
      return { token: parsedBody.bearer, domain: baseURIelement.baseURI };
    })
    .catch((err) => {
      log.error(err, 'Getting LP token error.');
    });
}

let reqData;

async function getConversationsContent(conversationId) {
  try {
    if(!reqData) {
      reqData = await getTokenAndDomainMsgHist();
    }
    const options = {
      method: 'POST',
      // uri: `https://va.msghist.liveperson.net/messaging_history/api/account/${process.env.LP_ACCOUNT_ID}/conversations/conversation/search`,
      uri: `https://${reqData.domain}/messaging_history/api/account/${process.env.LP_ACCOUNT_ID}/conversations/conversation/search`,
      headers: {
        'Authorization': `Bearer 83811e9aa6ab712b5de87a2b223a3ba7a9e6b5e89de78ffc89040db71e156ba9`,
        // 'Authorization': `Bearer ${reqData.token}`,
        'Content-Type': 'application/json'
      },
      body: {
        conversationId: conversationId
      },
      json: true // Automatically stringifies the body to JSON
    };
    return rp(options);
  } catch (err) {
    console.log(err);
  }
}

async function getLastMessageStatus(convId) {
  try {
    const conversationsContent = await getConversationsContent(convId);
    if (conversationsContent) {
      return await _.maxBy(conversationsContent.conversationHistoryRecords['0'].messageStatuses, 
      (message) => { return message.seq; });
    } else {
      return null;
    }
  } catch (err) {
    console.log(err);
  }
  
}
class MegaAgent extends Agent {
  constructor(conf) {
    super(conf);
    this.conf = conf;
    this.init();
    this.CONTENT_NOTIFICATION = 'MegaAgent.ContentEvent';
    this.initial = process.env.LP_INITIAL_SKILL_ID;
  }

  init() {
    const openConvs = {};

    this.on('connected', () => {
      log.info('connected...', this.conf.id || '');
      this.setAgentState({ availability: 'ONLINE' });
      this.subscribeExConversations({
        agentIds: [this.agentId],
        convState: ['OPEN'],
        //TODO: get convers...
      }, () => log.info('subscribed successfully', this.conf.id || ''));
      this.subscribeRoutingTasks({});
    });

    // Accept any routingTask (==ring)
    this.on('routing.RoutingTaskNotification', (body) => {
      // console.log('routing Task', JSON.stringify(body));
      body.changes.forEach((c) => {
        if (c.type === 'UPSERT') {
          c.result.ringsDetails.forEach((r) => {
            //TODO: get convers... продебажить тут
            if (r.ringState === 'WAITING') {
              this.updateRingState({
                ringId: r.ringId,
                ringState: 'ACCEPTED',
              }, (e, resp) => log.info(resp));
            }
          });
        }
      });
    });

    // Notification on changes in the open consversation list
    this.on('cqm.ExConversationChangeNotification', (notificationBody) => {
      notificationBody.changes.forEach(async (change) => {
        try {
          if (change.type === 'UPSERT' && !openConvs[change.result.convId]) {
            // new conversation for me
            openConvs[change.result.convId] = {};
  
            // demonstraiton of using the consumer profile calls
            // const consumerId =
            //   change.result.conversationDetails.participants
            //     .filter(p => p.role === 'CONSUMER')[0].id;
            // this.getUserProfile(consumerId, (e, profileResp) => {
            //   this.publishEvent({
            //     dialogId: change.result.convId,
            //     event: {
            //       type: 'ContentEvent',
            //       contentType: 'text/plain',
            //       message: `Just joined to conversation with ${JSON.stringify(profileResp)}`,
            //     },
            //   });
            // });
            // const lastMessageStatus = await getLastMessageStatus(change.result.convId);
            // const maxSeq = lastMessageStatus ? lastMessageStatus : 0;
            this.subscribeMessagingEvents({ fromSeq: 99999999, dialogId: change.result.convId });
          } else if (change.type === 'DELETE') {
            // conversation was closed or transferred
            delete openConvs[change.result.convId];
          }
        } catch (err) {
          console.log(err);
        }
      });
    });

    // Echo every unread consumer message and mark it as read
    this.on('ms.MessagingEventNotification', (body) => {
      const respond = {};
      body.changes.forEach((c) => {
        // In the current version MessagingEventNotification are recived also without subscription
        // Will be fixed in the next api version. So we have to check if this notification is
        // handled by us.
        if (openConvs[c.dialogId]) {
          // add to respond list all content event not by me
          if (c.event.type === 'ContentEvent' && c.originatorId !== this.agentId) {
            respond[`${body.dialogId}-${c.sequence}`] = {
              dialogId: body.dialogId,
              sequence: c.sequence,
              message: c.event.message,
            };
          }
          // remove from respond list all the messages that were already read
          if (c.event.type === 'AcceptStatusEvent' && c.originatorId === this.agentId) {
            c.event.sequenceList.forEach((seq) => {
              delete respond[`${body.dialogId}-${seq}`];
            });
          }
        }
      });

      // publish read, and echo
      Object.keys(respond).forEach((key) => {
        const contentEvent = respond[key];
        this.publishEvent({
          dialogId: contentEvent.dialogId,
          event: { type: 'AcceptStatusEvent', status: 'READ', sequenceList: [contentEvent.sequence] },
        });
        this.emit(this.CONTENT_NOTIFICATION, contentEvent);
      });
    });

    // Tracing
    // this.on('notification', msg => console.log('got message', JSON.stringify(msg)));
    this.on('error', err => log.info('got an error', err));
    this.on('closed', data => log.info('socket closed', data));
  }
}

module.exports = MegaAgent;
