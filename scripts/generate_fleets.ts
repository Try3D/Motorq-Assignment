function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const VEHICLE_API_KEY = "veh_1_abc123def456789";

(async () => {
  console.log("🔧 Provisioning vehicle...");

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
          vehicleVin: 40, // Vehicle ID we're provisioning
          technicianId: "TECH_001",
        }),
      },
    );

    const provisionResult = await provisionResponse.json();

    if (provisionResponse.ok) {
      console.log("✅ Vehicle provisioned:", provisionResult);
      var actualApiKey = provisionResult.apiKey;
    } else {
      console.log(
        "⚠️  Provisioning failed (vehicle may already be provisioned):",
        provisionResult,
      );
      var actualApiKey = VEHICLE_API_KEY;
    }
  } catch (error) {
    console.error("❌ Provisioning error:", error);
    var actualApiKey = VEHICLE_API_KEY;
  }

  console.log(
    "🚗 Starting telemetry simulation with API key authentication and rate limiting...",
  );

  let latitude = 37.7749;
  let longitude = -122.4194;
  let speed = 0;
  let totalKm = 0;
  let fuel = 50;
  let requestCount = 0;
  let rateLimitedCount = 0;

  let i = 0;
  while (i < 1000) {
    latitude += (Math.random() - 0.5) * 0.01;
    longitude += (Math.random() - 0.5) * 0.01;

    speed = Math.max(0, Math.min(120, speed + (Math.random() - 0.5) * 20));
    totalKm += Math.random() * 2;

    if (fuel < 10 && Math.random() < 0.3) {
      fuel = 100;
      console.log("⛽ Vehicle refueled");
    } else {
      fuel = Math.max(0, fuel - Math.random() * 2);
    }

    const telemetryData = {
      latitude: parseFloat(latitude.toFixed(6)),
      longitude: parseFloat(longitude.toFixed(6)),
      speed: parseFloat(speed.toFixed(2)),
      engineStatus: "On",
      fuel: parseFloat(fuel.toFixed(2)),
      totalKm: parseFloat(totalKm.toFixed(2)),
      vehicleId: 40, // MUST match the provisioned vehicle ID
    };

    try {
      const telemetryJson = await fetch(
        "http://localhost:5000/telemetry/capture",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Vehicle-API-Key": actualApiKey,
          },
          body: JSON.stringify(telemetryData),
        },
      );

      const response = await telemetryJson.json();
      requestCount++;

      if (telemetryJson.ok) {
        console.log("✅ Telemetry data sent:", {
          ...response,
          data: telemetryData,
          time: new Date().toISOString(),
          requestNumber: requestCount,
          rateLimitHeaders: {
            limit: telemetryJson.headers.get('X-RateLimit-Limit'),
            remaining: telemetryJson.headers.get('X-RateLimit-Remaining'),
            reset: telemetryJson.headers.get('X-RateLimit-Reset'),
          }
        });
      } else if (telemetryJson.status === 429) {
        // Rate limited
        rateLimitedCount++;
        console.warn("⚠️  Rate limited:", {
          error: response.error,
          currentCount: response.currentCount,
          limit: response.limit,
          retryAfter: response.retryAfter,
          requestNumber: requestCount,
        });

        // Wait for the suggested retry time plus a small buffer
        const retryDelay = (response.retryAfter || 60) * 1000 + 1000;
        console.log(`⏳ Waiting ${retryDelay / 1000} seconds before retry...`);
        await sleep(retryDelay);
        continue; // Don't increment i, retry this request
      } else {
        console.error("❌ Telemetry failed:", response);

        if (telemetryJson.status === 401) {
          console.log(
            "🔑 Authentication failed, may need to re-provision vehicle",
          );
          break;
        }
      }
    } catch (error) {
      console.error("❌ Network error:", error);
    }

    i += 1;

    // Much faster requests to trigger rate limiting
    const baseDelay = 100; // Only 100ms delay (instead of 1000ms)
    await sleep(baseDelay);
  }

  console.log("🏁 Telemetry simulation completed");
  console.log(
    `📊 Summary: ${requestCount} requests sent, ${rateLimitedCount} rate limited`,
  );
})();
