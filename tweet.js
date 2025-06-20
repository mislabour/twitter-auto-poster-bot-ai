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

// Test Twitter connection with multiple methods
async function testTwitterConnection() {
  debugLog("TWITTER", "Testing Twitter API connection...");
  
  // Test 1: Try v1.1 API first (more reliable)
  try {
    debugLog("TWITTER", "Testing v1.1 API...");
    const credentials = await twitterClient.v1.verifyCredentials();
    debugLog("TWITTER", "✅ v1.1 API works", { 
      screen_name: credentials.screen_name,
      id: credentials.id_str,
      name: credentials.name 
    });
    
    // Test 2: Try v2 API
    try {
      debugLog("TWITTER", "Testing v2 API...");
      const me = await twitterClient.v2.me();
      debugLog("TWITTER", "✅ v2 API also works", { 
        username: me.data.username,
        id: me.data.id,
        name: me.data.name 
      });
      return { v1: true, v2: true };
    } catch (v2Err) {
      debugLog("TWITTER", "⚠️ v2 API failed, but v1 works", {
        v2Error: v2Err.message
      });
      return { v1: true, v2: false };
    }
    
  } catch (err) {
    debugLog("TWITTER", "❌ Both APIs failed", {
      message: err.message,
      code: err.code,
      status: err.status,
      errors: err.errors,
      data: err.data
    });
    
    // Additional debug info
    if (err.response) {
      debugLog("TWITTER", "HTTP Response details", {
        status: err.response.status,
        statusText: err.response.statusText,
        headers: err.response.headers,
        data: err.response.data
      });
    }
    
    return { v1: false, v2: false };
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
    // Try v2 API first
    const result = await twitterClient.v2.tweet(tweetText);
    debugLog("TWITTER", "✅ Tweet posted successfully via v2", {
      tweetId: result.data.id,
      text: result.data.text
    });
    console.log("✅ Tweet posted:", tweetText);
    
  } catch (v2Err) {
    debugLog("TWITTER", "⚠️ v2 tweet failed, trying v1...", {
      v2Error: v2Err.message
    });
    
    try {
      // Fallback to v1.1 API
      const result = await twitterClient.v1.tweet(tweetText);
      debugLog("TWITTER", "✅ Tweet posted successfully via v1", {
        tweetId: result.id_str,
        text: result.text
      });
      console.log("✅ Tweet posted via v1:", tweetText);
      
    } catch (v1Err) {
      debugLog("TWITTER", "❌ Both v1 and v2 posting failed", {
        v2Error: v2Err.message,
        v1Error: v1Err.message,
        v1Code: v1Err.code,
        v1Status: v1Err.status,
        v1Errors: v1Err.errors,
        v1Data: v1Err.data,
        v1RateLimit: v1Err.rateLimit
      });
      
      // Show detailed error info
      if (v1Err.errors) {
        console.error("Twitter API Errors:");
        v1Err.errors.forEach((error, index) => {
          console.error(`  ${index + 1}. ${error.message} (Code: ${error.code})`);
        });
      }
      
      throw v1Err;
    }
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
    const connectionTest = await testTwitterConnection();
    if (!connectionTest.v1 && !connectionTest.v2) {
      console.log("❌ Cannot proceed without Twitter API access. Please check your credentials.");
      console.log("💡 Make sure you have:");
      console.log("   1. Elevated access (not just Essential)");
      console.log("   2. Read and Write permissions");
      console.log("   3. Correct API keys in .env file");
      process.exit(1);
    }
    
    if (connectionTest.v1 && !connectionTest.v2) {
      console.log("⚠️  Only v1.1 API works. Bot will use v1.1 for posting.");
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
