async function testRateLimiting() {
  console.log("🧪 Testing rate limiting...");

  const VEHICLE_VIN = 40;
  const API_KEY = "test_key";

  try {
    const provisionResponse = await fetch(
      "http://localhost:5000/admin/vehicle/provision",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vehicleVin: VEHICLE_VIN,
          technicianId: "TEST_TECH",
        }),
      },
    );

    const provisionResult = await provisionResponse.json();

    if (provisionResponse.ok) {
      console.log("✅ Vehicle provisioned for testing:", provisionResult);
      var apiKey = provisionResult.apiKey;
    } else {
      console.log("⚠️ Provisioning failed, using default key");
      var apiKey = API_KEY;
    }
  } catch (error) {
    console.error("❌ Provisioning error:", error);
    return;
  }

  // Now send rapid requests to trigger rate limiting
  console.log("🚀 Sending rapid requests to test rate limiting...");

  for (let i = 1; i <= 10; i++) {
    try {
      const response = await fetch("http://localhost:5000/telemetry/capture", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Vehicle-API-Key": apiKey,
        },
        body: JSON.stringify({
          vehicleId: VEHICLE_VIN,
          latitude: 37.7749,
          longitude: -122.4194,
          speed: 60,
          engineStatus: "On",
          fuel: 50,
          totalKm: 1000 + i,
        }),
      });

      const result = await response.json();

      console.log(`Request ${i}: Status ${response.status}`);

      if (response.status === 429) {
        console.log("🚫 RATE LIMITED! Test successful:", result);
        break;
      } else if (response.ok) {
        console.log("✅ Request successful");
      } else {
        console.log("❌ Request failed:", result);
      }

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`❌ Request ${i} failed:`, error);
    }
  }

  console.log("🏁 Rate limiting test completed");
}

testRateLimiting();
