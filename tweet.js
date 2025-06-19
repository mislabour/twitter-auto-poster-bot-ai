const axios = require("axios");
const { TwitterApi } = require("twitter-api-v2");
require("dotenv").config();

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY,
  appSecret: process.env.TWITTER_APP_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// 🌍 Get top news headlines
async function fetchTopNews() {
  const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=3&apiKey=${process.env.NEWS_API_KEY}`;
  const res = await axios.get(url);
  return res.data.articles.map(a => `${a.title} - ${a.source.name}`);
}

// 🧠 Use Groq (Mixtral or LLaMA 3) to turn into tweet
async function summarizeWithGroq(newsList) {
  const prompt = `Summarize these headlines into a single short tweet under 280 characters. Use plain text. Add emojis. Avoid hashtags.\n\n${newsList.join("\n")}`;

  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "mixtral-8x7b-32768", // Or use: "llama3-70b-8192"
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 150,
    },
    {
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data.choices[0].message.content.trim();
}

// 🐦 Tweet the result
async function postToTwitter(text) {
  try {
    await twitterClient.v2.tweet(text);
    console.log("✅ Tweet posted:", text);
  } catch (err) {
    console.error("❌ Failed to post tweet:", err.message);
  }
}

// 🚀 Main bot logic
(async () => {
  try {
    const news = await fetchTopNews();
    const tweet = await summarizeWithGroq(news);
    await postToTwitter(tweet);
  } catch (err) {
    console.error("❌ Bot error:", err.message);
  }
})();
