const { TwitterApi } = require('twitter-api-v2');
const client = new TwitterApi({
  appKey: 'your_app_key',
  appSecret: 'your_app_secret',
  accessToken: 'your_access_token',
  accessSecret: 'your_access_secret',
});

client.v2.tweet("Test tweet from my bot! ✅")
  .then(res => console.log("Success!", res))
  .catch(err => console.error("Failed!", err));
