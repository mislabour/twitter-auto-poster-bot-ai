// index.js
const GenAI = require("@google/generative-ai");
const { TwitterApi } = require("twitter-api-v2");
const SECRETS = require("./SECRETS");

// Twitter client setup
const twitterClient = new TwitterApi({
  appKey: SECRETS.APP_KEY,
  appSecret: SECRETS.APP_SECRET,
  accessToken: SECRETS.ACCESS_TOKEN,
  accessSecret: SECRETS.ACCESS_SECRET,
});

// Gemini setup
const genAI = new GenAI.GoogleGenerativeAI(SECRETS.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

const generationConfig = {
  maxOutputTokens: 400,
  temperature: 0.7,
};

async function run() {
  const prompt =
    "Generate a unique tweet about world news, politics, crypto, or modern technology. Keep it informative, under 280 characters, plain text only. You may use emojis.";

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig,
  });

  const response = result.response;
  const text = response.text();
  console.log("Generated Tweet:", text);
  await sendTweet(text);
}

run();

async function sendTweet(tweetText) {
  try {
    await twitterClient.v2.tweet(tweetText);
    console.log("Tweet sent successfully!");
  } catch (error) {
    console.error("Error sending tweet:", error);
  }
}
