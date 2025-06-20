const { TwitterApi } = require('twitter-api-v2');

// Replace these with your actual values (or use dotenv)
const client = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY,
  appSecret: process.env.TWITTER_APP_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

client.v2.tweet("Test tweet from my bot! ✅")
  .then(res => console.log("✅ Success!", res))
  .catch(err => {
    console.error("❌ Failed!");
    console.error("Message:", err.message);
    console.error("Status:", err.code || err.status);
    console.error("Details:", err.data || err.errors || err);
  });
