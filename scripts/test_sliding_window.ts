import { CacheService } from "../src/services/cacheService";

async function testSlidingWindow() {
  console.log("🧪 Testing Redis Sliding Window Rate Limiting");
  
  const cache = CacheService.getInstance();
  await cache.connect();
  
  const testKey = "test:sliding-window:vehicle-123:/capture";
  const limit = 5;
  const windowSeconds = 10;
  
  console.log(`\n📊 Test Configuration:`);
  console.log(`- Limit: ${limit} requests per ${windowSeconds} seconds`);
  console.log(`- Window: Sliding window (not fixed buckets)`);
  console.log(`- Key: ${testKey}`);
  
  // Clear any existing data
  await cache.del(testKey);
  
  // Test rapid requests
  console.log(`\n🚀 Testing rapid requests...`);
  
  for (let i = 1; i <= 8; i++) {
    const result = await cache.checkRateLimitWithAnalytics(testKey, limit, windowSeconds);
    
    console.log(`Request ${i}:`);
    console.log(`  ✅ Allowed: ${result.allowed}`);
    console.log(`  📈 Count: ${result.count}/${limit}`);
    console.log(`  ⏰ Remaining: ${result.remaining}`);
    console.log(`  🕐 Window Start: ${new Date(result.windowStart).toISOString()}`);
    console.log(`  📊 Requests in Window: ${result.requestTimes.length}`);
    if (result.averageInterval) {
      console.log(`  ⏱️  Average Interval: ${Math.round(result.averageInterval)}ms`);
    }
    
    if (!result.allowed) {
      console.log(`  🚫 Rate limited! Next allowed in ~${Math.ceil((result.resetTime - Date.now()) / 1000)}s`);
      break;
    }
    
    // Small delay to make timing visible
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Wait for some time to pass, then test sliding behavior
  console.log(`\n⏳ Waiting 3 seconds to test sliding window behavior...`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log(`\n🔄 Testing sliding window after 3 seconds:`);
  const result = await cache.checkRateLimitWithAnalytics(testKey, limit, windowSeconds);
  
  console.log(`After 3s wait:`);
  console.log(`  ✅ Allowed: ${result.allowed}`);
  console.log(`  📈 Count: ${result.count}/${limit}`);
  console.log(`  ⏰ Remaining: ${result.remaining}`);
  console.log(`  🕐 Window Start: ${new Date(result.windowStart).toISOString()}`);
  console.log(`  📊 Requests in Window: ${result.requestTimes.length}`);
  
  // Show the request times to demonstrate sliding window
  console.log(`\n📋 Request timestamps in current window:`);
  result.requestTimes.forEach((time, index) => {
    const secondsAgo = Math.round((Date.now() - time) / 1000);
    console.log(`  ${index + 1}. ${new Date(time).toISOString()} (${secondsAgo}s ago)`);
  });
  
  // Test status check without consuming
  console.log(`\n🔍 Testing status check (without consuming request):`);
  const status = await cache.getRateLimitStatus(testKey, limit, windowSeconds);
  console.log(`Status Check:`);
  console.log(`  📈 Count: ${status.count}/${limit}`);
  console.log(`  ⏰ Remaining: ${status.remaining}`);
  console.log(`  📊 Requests: ${status.requestTimes.length}`);
  
  // Cleanup
  await cache.del(testKey);
  await cache.disconnect();
  
  console.log(`\n✅ Sliding window test completed!`);
}

// Run the test
testSlidingWindow().catch(console.error);
