let map, directionsService, directionsRenderer, originAutocomplete, destinationAutocomplete;

function initializeAutocomplete() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 27.8164, lng: -80.4706 },
        zoom: 12,
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(map);

    originAutocomplete = new google.maps.places.Autocomplete(document.getElementById("origin"), {
        types: ["geocode", "establishment"],
        fields: ["name", "formatted_address", "geometry"],
    });

    destinationAutocomplete = new google.maps.places.Autocomplete(document.getElementById("destination"), {
        types: ["geocode", "establishment"],
        fields: ["name", "formatted_address", "geometry"],
    });

    originAutocomplete.addListener("place_changed", handlePlaceChange.bind(null, "origin"));
    destinationAutocomplete.addListener("place_changed", handlePlaceChange.bind(null, "destination"));

    addClearButton("origin");
    addClearButton("destination");

    setupTimeToggleListeners();
    loadSavedData();
}

function addClearButton(fieldId) {
    const field = document.getElementById(fieldId);
    const parent = field.parentNode;

    const clearButton = document.createElement("button");
    clearButton.textContent = "X";
    clearButton.type = "button";
    clearButton.style.position = "absolute";
    clearButton.style.right = "10px";
    clearButton.style.top = "50%";
    clearButton.style.transform = "translateY(-50%)";
    clearButton.style.border = "none";
    clearButton.style.background = "transparent";
    clearButton.style.cursor = "pointer";
    clearButton.style.fontSize = "18px";

    clearButton.addEventListener("click", () => {
        field.value = "";
    });

    parent.style.position = "relative";
    parent.appendChild(clearButton);
}

function handlePlaceChange(fieldId) {
    const autocomplete = fieldId === "origin" ? originAutocomplete : destinationAutocomplete;
    const place = autocomplete.getPlace();

    if (place) {
        const name = place.name || "";
        const address = place.formatted_address || "";
        document.getElementById(fieldId).value = name ? `${name}, ${address}` : address;
    } else {
        document.getElementById(fieldId).value = "";
    }
}

function setupTimeToggleListeners() {
    const pickupTimeField = document.getElementById("pickup-time");
    const arrivalTimeField = document.getElementById("arrival-time");
    const pickupRadio = document.querySelector("input[name='time-toggle'][value='pickup']");
    const arrivalRadio = document.querySelector("input[name='time-toggle'][value='arrival']");

    pickupTimeField.addEventListener("input", () => {
        if (pickupTimeField.value) {
            pickupRadio.checked = true;
        }
    });

    arrivalTimeField.addEventListener("input", () => {
        if (arrivalTimeField.value) {
            arrivalRadio.checked = true;
        }
    });
}

function calculateCost() {
    const origin = document.getElementById("origin").value;
    const destination = document.getElementById("destination").value;
    const baseRate = parseFloat(document.getElementById("base-rate").value) || 0;
    const mileRate = parseFloat(document.getElementById("mile-rate").value) || 0;
    const minuteRate = parseFloat(document.getElementById("minute-rate").value) || 0;
    const pickupDate = document.getElementById("pickup-date").value;
    const pickupTime = document.getElementById("pickup-time").value;
    const arrivalTime = document.getElementById("arrival-time").value;

    if (!origin || !destination) {
        alert("Please enter both origin and destination.");
        return;
    }

    directionsService.route(
        {
            origin: origin,
            destination: destination,
            travelMode: "DRIVING",
        },
        (result, status) => {
            if (status === "OK") {
                directionsRenderer.setDirections(result);

                const leg = result.routes[0].legs[0];
                const distanceInMiles = leg.distance.value / 1609.34;
                const durationInMinutes = leg.duration.value / 60;

                const mileCost = mileRate * distanceInMiles;
                const minuteCost = minuteRate * durationInMinutes;
                const totalCost = baseRate + mileCost + minuteCost;

                let calculatedPickupTime = "N/A";
                let calculatedArrivalTime = "N/A";

                if (pickupDate) {
                    if (pickupTime) {
                        const pickupDateTime = new Date(`${pickupDate}T${pickupTime}`);
                        calculatedPickupTime = pickupDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                        const arrivalDateTime = new Date(pickupDateTime.getTime() + durationInMinutes * 60000);
                        calculatedArrivalTime = arrivalDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                        document.getElementById("arrival-time").value = arrivalDateTime.toISOString().substring(11, 16);
                    } else if (arrivalTime) {
                        const arrivalDateTime = new Date(`${pickupDate}T${arrivalTime}`);
                        calculatedArrivalTime = arrivalDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                        const pickupDateTime = new Date(arrivalDateTime.getTime() - durationInMinutes * 60000);
                        calculatedPickupTime = pickupDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                        document.getElementById("pickup-time").value = pickupDateTime.toISOString().substring(11, 16);
                    }
                }

                const quoteData = {
                    customerName: document.getElementById("customer-name").value || "",
                    phoneNumber: document.getElementById("phone-number").value || "",
                    numPassengers: document.getElementById("num-passengers").value || "",
                    origin: origin,
                    destination: destination,
                    date: pickupDate || "N/A",
                    pickupTime: calculatedPickupTime,
                    arrivalTime: calculatedArrivalTime,
                    distance: distanceInMiles,
                    duration: durationInMinutes,
                    baseRate: baseRate,
                    mileRate: mileRate,
                    minuteRate: minuteRate,
                    mileCost: mileCost,
                    minuteCost: minuteCost,
                    cost: totalCost,
                };
                saveQuote(quoteData);

                document.getElementById("output").innerHTML = `
                    <h2>Trip Summary</h2>
                    <p><strong>Origin:</strong> ${origin}</p>
                    <p><strong>Destination:</strong> ${destination}</p>
                    <p><strong>Pickup Time:</strong> ${quoteData.pickupTime}</p>
                    <p><strong>Arrival Time:</strong> ${quoteData.arrivalTime}</p>
                    <p><strong>Distance:</strong> ${distanceInMiles.toFixed(2)} miles</p>
                    <p><strong>Duration:</strong> ${durationInMinutes.toFixed(2)} minutes</p>
                    <p><strong>Total Cost:</strong> $${totalCost.toFixed(2)}</p>
                `;

                document.getElementById("breakdown").innerHTML = `
                    <h3>Cost Breakdown</h3>
                    <p><strong>Base Rate:</strong> $${baseRate.toFixed(2)}</p>
                    <p><strong>Cost per Mile:</strong> $${mileCost.toFixed(2)} (${distanceInMiles.toFixed(2)} miles @ $${mileRate.toFixed(2)}/mile)</p>
                    <p><strong>Cost per Minute:</strong> $${minuteCost.toFixed(2)} (${durationInMinutes.toFixed(2)} minutes @ $${minuteRate.toFixed(2)}/minute)</p>
                `;
            } else {
                alert("Could not calculate route. Please check the locations and try again.");
            }
        }
    );
}

// Functions for recalling quotes, saving rates, and creating a new form omitted for brevity.

window.onload = initializeAutocomplete;
