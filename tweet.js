const axios = require("axios");
const { TwitterApi } = require("twitter-api-v2");
const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY,
  appSecret: process.env.TWITTER_APP_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

async function fetchTopNews() {
  const res = await axios.get(`https://newsapi.org/v2/top-headlines?language=en&pageSize=3&apiKey=${process.env.NEWS_API_KEY}`);
  return res.data.articles.map((a) => `${a.title} - ${a.source.name}`);
}

async function summarizeNewsAsTweet(newsList) {
  const prompt = `Convert the following news headlines into one tweet under 280 characters, summarizing the theme or highlight. Use plain text with emojis. Don't mention source names. Headlines:\n${newsList.join("\n")}`;

  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-3.5-turbo",
    max_tokens: 100,
    temperature: 0.7,
  });

  return completion.choices[0].message.content.trim();
}

async function postToTwitter(tweetText) {
  try {
    await twitterClient.v2.tweet(tweetText);
    console.log("✅ Tweet posted:", tweetText);
  } catch (err) {
    console.error("❌ Tweet failed:", err);
  }
}

(async () => {
  try {
    const headlines = await fetchTopNews();
    const tweet = await summarizeNewsAsTweet(headlines);
    await postToTwitter(tweet);
  } catch (e) {
    console.error("❌ Error in bot:", e.message);
  }
})();
