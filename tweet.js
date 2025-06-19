const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { TwitterApi } = require("twitter-api-v2");
require("dotenv").config();

// 🔐 Load secrets from .env file
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY,
  appSecret: process.env.TWITTER_APP_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// 🌐 Fetch top news headlines from NewsAPI
async function fetchTopNews() {
  const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=5&category=general&apiKey=${NEWS_API_KEY}`;
  const res = await axios.get(url);
  return res.data.articles.map(article => `${article.title} - ${article.source.name}`);
}

// 🤖 Use Gemini to rephrase news as tweets
async function summarizeWithGemini(newsList) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const prompt = `Convert these news headlines into a tweet under 280 characters:
${newsList.join("\n")}
Only output the tweet.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// 🐦 Post to Twitter
async function postToTwitter(tweetText) {
  try {
    await twitterClient.v2.tweet(tweetText);
    console.log("✅ Tweet posted:", tweetText);
  } catch (err) {
    console.error("❌ Error posting tweet:", err);
  }
}

// 🚀 Orchestrator
(async () => {
  try {
    const headlines = await fetchTopNews();
    const tweet = await summarizeWithGemini(headlines);
    await postToTwitter(tweet);
  } catch (err) {
    console.error("❌ Failed to complete workflow:", err);
  }

})();
