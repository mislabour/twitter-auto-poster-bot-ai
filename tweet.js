const axios = require("axios");
const { TwitterApi } = require("twitter-api-v2");
require("dotenv").config();

// Debug logging function
function debugLog(section, message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🔍 ${section}: ${message}`);
  if (data) {
    console.log("   Data:", JSON.stringify(data, null, 2));
  }
}

// Environment variables validation
function validateEnvironment() {
  debugLog("ENV", "Validating environment variables...");
  
  const requiredEnvVars = [
    'TWITTER_APP_KEY',
    'TWITTER_APP_SECRET', 
    'TWITTER_ACCESS_TOKEN',
    'TWITTER_ACCESS_SECRET',
    'NEWS_API_KEY',
    'GROQ_API_KEY'
  ];
  
  const missing = [];
  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      missing.push(envVar);
    } else {
      debugLog("ENV", `✅ ${envVar} is set (${process.env[envVar].substring(0, 10)}...)`);
    }
  });
  
  if (missing.length > 0) {
    console.error("❌ Missing environment variables:", missing);
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  debugLog("ENV", "✅ All environment variables validated");
}

// Initialize Twitter client with debug
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY,
  appSecret: process.env.TWITTER_APP_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// Test Twitter connection
async function testTwitterConnection() {
  debugLog("TWITTER", "Testing Twitter API connection...");
  try {
    const me = await twitterClient.v2.me();
    debugLog("TWITTER", "✅ Connection successful", { 
      username: me.data.username,
      id: me.data.id,
      name: me.data.name 
    });
    return true;
  } catch (err) {
    debugLog("TWITTER", "❌ Connection failed", {
      message: err.message,
      code: err.code,
      status: err.status,
      errors: err.errors
    });
    return false;
  }
}

async function fetchTopNews() {
  debugLog("NEWS", "Fetching top news headlines...");
  
  try {
    const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=3&apiKey=${process.env.NEWS_API_KEY}`;
    debugLog("NEWS", "Making request to NewsAPI", { url: url.replace(process.env.NEWS_API_KEY, '[API_KEY]') });
    
    const res = await axios.get(url);
    debugLog("NEWS", "NewsAPI response received", { 
      status: res.status,
      totalResults: res.data.totalResults,
      articlesCount: res.data.articles?.length || 0
    });
    
    if (!res.data.articles || res.data.articles.length === 0) {
      throw new Error('No articles found in response');
    }
    
    const headlines = res.data.articles
      .filter(a => a.title && a.source?.name)
      .map(a => `${a.title} - ${a.source.name}`);
    
    debugLog("NEWS", "✅ Headlines processed", { count: headlines.length, headlines });
    return headlines;
    
  } catch (error) {
    debugLog("NEWS", "❌ Error fetching news", {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    throw error;
  }
}

async function summarizeWithGroq(newsList) {
  debugLog("GROQ", "Generating tweet summary...");
  
  const prompt = `Summarize these headlines into a single tweet under 280 characters. Use plain text. Add emojis. Avoid hashtags.\n\n${newsList.join("\n")}`;
  
  debugLog("GROQ", "Sending prompt to Groq", { 
    promptLength: prompt.length,
    headlinesCount: newsList.length
  });

  try {
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

    debugLog("GROQ", "Groq API response received", {
      status: response.status,
      usage: response.data.usage,
      model: response.data.model
    });

    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response structure from Groq API');
    }

    const tweetText = response.data.choices[0].message.content.trim();
    debugLog("GROQ", "✅ Tweet generated", { 
      length: tweetText.length,
      content: tweetText
    });

    return tweetText;
    
  } catch (error) {
    debugLog("GROQ", "❌ Error generating summary", {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    throw error;
  }
}

async function postToTwitter(tweetText) {
  debugLog("TWITTER", "Attempting to post tweet...", { 
    tweetLength: tweetText.length,
    tweet: tweetText
  });
  
  try {
    const result = await twitterClient.v2.tweet(tweetText);
    debugLog("TWITTER", "✅ Tweet posted successfully", {
      tweetId: result.data.id,
      text: result.data.text
    });
    console.log("✅ Tweet posted:", tweetText);
    
  } catch (err) {
    debugLog("TWITTER", "❌ Error posting tweet", {
      message: err.message,
      code: err.code,
      status: err.status,
      errors: err.errors,
      data: err.data,
      rateLimit: err.rateLimit,
      rateLimitRemaining: err.rateLimitRemaining,
      rateLimitReset: err.rateLimitReset
    });
    
    // Additional error details
    if (err.errors) {
      console.error("Twitter API Errors:");
      err.errors.forEach((error, index) => {
        console.error(`  ${index + 1}. ${error.message} (Code: ${error.code})`);
      });
    }
    
    throw err;
  }
}

// Main execution with comprehensive debugging
(async () => {
  console.log("🚀 Starting Twitter News Bot...");
  console.log("================================================");
  
  try {
    // Step 1: Validate environment
    validateEnvironment();
    console.log("");
    
    // Step 2: Test Twitter connection
    const connected = await testTwitterConnection();
    if (!connected) {
      console.log("❌ Cannot proceed without Twitter API access. Please check your credentials.");
      process.exit(1);
    }
    console.log("");
    
    // Step 3: Fetch news
    const headlines = await fetchTopNews();
    if (headlines.length === 0) {
      throw new Error('No valid headlines found');
    }
    console.log("");
    
    // Step 4: Generate tweet
    const tweet = await summarizeWithGroq(headlines);
    if (tweet.length > 280) {
      debugLog("VALIDATION", "⚠️ Tweet exceeds 280 characters", { length: tweet.length });
    }
    console.log("");
    
    // Step 5: Post tweet
    await postToTwitter(tweet);
    
    console.log("================================================");
    console.log("🎉 Bot execution completed successfully!");
    
  } catch (err) {
    console.log("================================================");
    console.error("❌ Bot execution failed:");
    console.error("Error:", err.message);
    
    if (err.stack) {
      debugLog("ERROR", "Full stack trace", { stack: err.stack });
    }
    
    process.exit(1);
  }
})();
