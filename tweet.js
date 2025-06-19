const axios = require("axios");
const { TwitterApi } = require("twitter-api-v2");
require("dotenv").config();

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY,
  appSecret: process.env.TWITTER_APP_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

async function fetchTopNews() {
  const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=3&apiKey=${process.env.NEWS_API_KEY}`;
  const res = await axios.get(url);
  return res.data.articles.map(a => `${a.title} - ${a.source.name}`);
}

async function summarizeWithGroq(newsList) {
  const prompt = `Summarize these headlines into a single tweet under 280 characters. Use plain text. Add emojis. Avoid hashtags.\n\n${newsList.join("\n")}`;

  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama3-70b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 150,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data.choices[0].message.content.trim();
}

async function postToTwitter(tweetText) {
  try {
    await twitterClient.v2.tweet(tweetText);
    console.log("✅ Tweet posted:", tweetText);
  } catch (err) {
    console.error("❌ Error posting tweet:", err.message);
  }
}

(async () => {
  try {
    const headlines = await fetchTopNews();
    const tweet = await summarizeWithGroq(headlines);
    await postToTwitter(tweet);
  } catch (err) {
    console.error("❌ Bot error:", err.message);
  }
})();
