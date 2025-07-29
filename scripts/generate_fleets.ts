function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  const ownerRes = await fetch("http://localhost:5000/owner/add", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ownerId: 10,
      name: "Hyundai",
    }),
  });

  const ownerJson = await ownerRes.json();
  console.log("Preseeding owner", ownerJson);

  const fleetRes = await fetch("http://localhost:5000/fleet/add", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fleetId: 1,
      fleetType: "Corporate",
      ownerId: 10,
    }),
  });
  const fleetJson = await fleetRes.json();
  console.log("Preseeding Fleet", fleetJson);

  await fetch("http://localhost:5000/vehicle/add", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      vin: 1,
      manufacturer: "BMW",
      fleetId: 1,
      registrationStatus: "Active",
    }),
  });
  console.log("Preseeding Vehicle");

  let latitude = 0;
  let longitude = 0;
  let speed = 0;
  let totalKm = 0;
  let fuel = 0;

  let i = 0;
  while (i < 1000) {
    latitude += (Math.random() - 0.5) * 0.1;
    longitude += (Math.random() - 0.5) * 0.1;
    longitude += (Math.random() - 0.5) * 0.1;
    speed += (Math.random() - 0.5) * 20;
    totalKm += Math.random();
    if (fuel < Math.random() * 100) {
      fuel += 100;
    } else {
      fuel -= 0.5;
    }

    const telemetryJson = await fetch(
      "http://localhost:5000/telemetry/capture",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: latitude,
          longitude: longitude,
          speed: speed,
          engineStatus: "On",
          fuel: 10,
          totalKm: totalKm,
          vehicleId: 1,
        }),
      },
    );

    i += 1;

    await sleep(1000);

    console.log("Telemetry data sent: ", {
      ...(await telemetryJson.json()),
      time: new Date(),
    });
    //   latitude,
    //   longitude,
    //   speed,
    //   totalKm,
    //   fuel,
    // });
  }
})();
