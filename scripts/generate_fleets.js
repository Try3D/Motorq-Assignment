"use strict";
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
(async () => {
    let latitude = 0;
    let longitude = 0;
    let speed = 0;
    let totalKm = 0;
    let fuel = 50;
    let i = 0;
    while (i < 1000) {
        latitude += (Math.random() - 0.5) * 0.1;
        longitude += (Math.random() - 0.5) * 0.1;
        speed = Math.max(0, Math.min(120, speed + (Math.random() - 0.5) * 20));
        totalKm += Math.random() * 2;
        if (fuel < 10 && Math.random() < 0.3) {
            fuel = 100;
            console.log("🚗 Vehicle refueled");
        }
        else {
            fuel = Math.max(0, fuel - Math.random() * 2);
        }
        const telemetryData = {
            latitude: latitude,
            longitude: longitude,
            speed: speed,
            engineStatus: "On",
            fuel: fuel,
            totalKm: totalKm,
            vehicleId: 1,
        };
        const telemetryJson = await fetch("http://localhost:5000/telemetry/capture", {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(telemetryData),
        });
        i += 1;
        await sleep(1000);
        console.log("Telemetry data sent: ", {
            ...(await telemetryJson.json()),
            data: telemetryData,
            time: new Date(),
        });
    }
})();
