const config = {};

config.ENV = process.env.ENV;

config.LP = {
  accountId: process.env.LP_ACCOUNT_ID,
  username: process.env.LP_USER_NAME,
  appKey: process.env.LP_AGENT_APP_KEY,
  secret: process.env.LP_AGENT_SECRET,
  accessToken: process.env.LP_AGENT_ACCESS_TOKEN,
  accessTokenSecret: process.env.LP_AGENT_ACCESS_TOKEN_SECRET,
  mainBotId: process.env.MAIN_BOT_ID,
  // initialSkillId: process.env.LP_INITIAL_SKILL_ID,
};

config.DIALOG_FLOW = {
  token: process.env.DIALOG_FLOW_TOKEN,
  eventPrefix: '#event ',
  skillPrefix: '#skill ',
};

module.exports = config;
