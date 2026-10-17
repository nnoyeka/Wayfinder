/* mobile menu */
const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");

menuToggle.addEventListener("click", function () {
    const isOpen = mainNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", isOpen);
});


/* Budget slider - https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/output  */
const budget = document.getElementById("budget");
const budgetValue = document.getElementById("budgetValue");

budget.addEventListener("input", function () {
    budgetValue.textContent = Number(budget.value).toLocaleString("en-GB");
});


/* Stop dates in the past being picked  */
const today = new Date().toISOString().slice(0, 10);
document.getElementById("startDate").min = today;
document.getElementById("endDate").min = today;


/* Form validation  */
function showError(id, message) {
    const input = document.getElementById(id);
    input.classList.add("is-invalid");
    input.setAttribute("aria-invalid", "true");
    document.getElementById(id + "Error").textContent = message;
}

function clearErrors() {
    document.querySelectorAll(".is-invalid").forEach(function (input) {
        input.classList.remove("is-invalid");
        input.removeAttribute("aria-invalid");
    });
    document.querySelectorAll(".error-message").forEach(function (box) {
        box.textContent = "";
    });
}

function validate(trip) {
    clearErrors();
    let valid = true;

    if (trip.city.length < 2) {
        showError("destination", "Please enter a destination city.");
        valid = false;
    }
    if (!trip.start) {
        showError("startDate", "Please choose a departure date.");
        valid = false;
    }
    if (!trip.end) {
        showError("endDate", "Please choose a return date.");
        valid = false;
    } else if (trip.end < trip.start) {
        showError("endDate", "Your return date must be after your departure date.");
        valid = false;
    }
    if (trip.travellers < 1 || trip.travellers > 20) {
        showError("travellers", "Please enter between 1 and 20 travellers.");
        valid = false;
    }
    return valid;
}

/* Fetch helper - https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch */
async function getJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Request failed: " + response.status);
    }
    return response.json();
}


/*  Results  */

// Trip overview Open-Meteo Geocoding API - https://open-meteo.com/en/docs/geocoding-api
function showOverview(trip, place) {
    document.getElementById("overviewList").innerHTML = `
        <dt>Destination</dt><dd>${place.name}, ${place.country}</dd>
        <dt>Dates</dt><dd>${trip.start} to ${trip.end}</dd>
        <dt>Travellers</dt><dd>${trip.travellers}</dd>
        <dt>Trip type</dt><dd>${trip.type}</dd>
        <dt>Budget</dt><dd>${trip.budget.toLocaleString("en-GB")} ${trip.currency} per person</dd>`;
}

// World Bank API with flags received from flagcdn.com - https://datahelpdesk.worldbank.org/knowledgebase/articles/898590
function showCountry(country, place) {
    const flag = `<img src="https://flagcdn.com/w160/${place.country_code.toLowerCase()}.png" alt="Flag of ${place.country}" class="flag">`;

    if (!country) {
        document.getElementById("countryInfo").innerHTML = `
            ${flag}
            <p>${place.country}</p>
            <p class="help-text">More country facts aren't available right now.</p>`;
        return;
    }

    document.getElementById("countryInfo").innerHTML = `
        ${flag}
        <dl class="detail-list">
            <dt>Country</dt><dd>${country.name}</dd>
            <dt>Capital</dt><dd>${country.capitalCity || "Not listed"}</dd>
            <dt>Region</dt><dd>${country.region.value}</dd>
            <dt>Income level</dt><dd>${country.incomeLevel.value}</dd>
        </dl>`;
}

// Frankfurter API - https://frankfurter.dev/
async function showCurrency(trip) {
    const box = document.getElementById("currencyInfo");
    const from = trip.currency;
    const to = trip.destCurrency;

    if (from === to) {
        box.innerHTML = `<p>You're using the same currency (${to}) at home and away.</p>`;
        return;
    }

    try {
        const data = await getJSON(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`);
        const rate = data.rates[to];
        const converted = Math.round(trip.budget * rate).toLocaleString("en-GB");
        box.innerHTML = `
            <p>1 ${from} = ${rate.toFixed(2)} ${to}</p>
            <p class="help-text">Your budget per person is about</p>
            <p class="big-figure">${converted} ${to}</p>`;
    } catch (error) {
        box.innerHTML = `<p class="help-text">Exchange rates aren't available right now.</p>`;
    }
}

//Open-Meteo Forecast API - https://open-meteo.com/en/docs
function weatherIcon(code) {
    if (code === 0) return "☀️ Clear";
    if (code <= 3) return "⛅ Cloudy";
    if (code <= 48) return "🌫️ Fog";
    if (code <= 67) return "🌧️ Rain";
    if (code <= 77) return "❄️ Snow";
    if (code <= 82) return "🌦️ Showers";
    return "⛈️ Storms";
}

async function showWeather(trip, place) {
    const list = document.getElementById("weatherList");
    const url = "https://api.open-meteo.com/v1/forecast" +
        `?latitude=${place.latitude}&longitude=${place.longitude}` +
        "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
        `&timezone=auto&start_date=${trip.start}&end_date=${trip.end}`;

    try {
        const data = await getJSON(url);
        const days = data.daily;
        list.innerHTML = "";
        for (let i = 0; i < days.time.length; i++) {
            list.innerHTML += `
                <li class="weather-day">
                    <p>${days.time[i]}</p>
                    <p>${weatherIcon(days.weather_code[i])}</p>
                    <p class="temp-high">${Math.round(days.temperature_2m_max[i])}°C</p>
                    <p class="help-text">Low ${Math.round(days.temperature_2m_min[i])}°C</p>
                </li>`;
        }
    } catch (error) {
        list.innerHTML = `<li class="help-text">Forecasts are only available for the next 16 days.</li>`;
    }
}

//Nager.Date API - https://date.nager.at/Api
async function showHolidays(trip, place) {
    const body = document.getElementById("holidayBody");
    const message = document.getElementById("holidayMessage");
    const year = trip.start.slice(0, 4);
    body.innerHTML = "";
    message.textContent = "";

    try {
        const holidays = await getJSON(`https://date.nager.at/api/v3/PublicHolidays/${year}/${place.country_code}`);
        const duringTrip = holidays.filter(function (h) {
            return h.date >= trip.start && h.date <= trip.end;
        });

        if (duringTrip.length === 0) {
            message.textContent = "There are no public holidays during your trip.";
        }
        duringTrip.forEach(function (h) {
            body.innerHTML += `<tr><td>${h.date}</td><td>${h.name}</td><td>${h.localName}</td></tr>`;
        });
    } catch (error) {
        message.textContent = "Holiday information isn't available for this country.";
    }
}


/* Call APIs when form is submitted */
const form = document.getElementById("tripForm");
const statusBox = document.getElementById("status");
const results = document.getElementById("resultsContent");

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    
    const trip = {
        name: document.getElementById("tripName").value.trim(),
        city: document.getElementById("destination").value.trim(),
        start: document.getElementById("startDate").value,
        end: document.getElementById("endDate").value,
        travellers: Number(document.getElementById("travellers").value),
        type: form.querySelector('input[name="tripType"]:checked').value,
        currency: document.getElementById("homeCurrency").value,
        destCurrency: document.getElementById("destCurrency").value,
        budget: Number(budget.value)
    };

    if (!validate(trip)) {
        statusBox.textContent = "Please fix the highlighted fields.";
        return;
    }

    statusBox.textContent = "Planning your trip…";
    results.hidden = true;

    try {
        //Open-Meteo Geocoding
        const geo = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trip.city)}&count=1`);
        if (!geo.results) {
            showError("destination", "We couldn't find that city. Check the spelling.");
            statusBox.textContent = "City not found.";
            return;
        }
        const place = geo.results[0];

        //REST Countries
        let country = null;
        try {
            const data = await getJSON(`https://api.worldbank.org/v2/country/${place.country_code}?format=json`);
            country = data[1][0];
        } catch (error) {
            console.warn("World Bank API unavailable:", error);
        }

        // Show results
        showOverview(trip, place);
        showCountry(country, place);
        await showCurrency(trip);
        await showWeather(trip, place);
        await showHolidays(trip, place);

        results.hidden = false;
        statusBox.textContent = `Here's your trip to ${place.name}, ${place.country}.`;
        document.getElementById("resultsHeading").focus();

        if (document.getElementById("saveTrip").checked) {
            saveTrip(trip, place);
        }
    } catch (error) {
        console.error(error);
        statusBox.textContent = "Sorry, something went wrong. Please try again.";
    }
});

form.addEventListener("reset", function () {
    clearErrors();
    results.hidden = true;
    budgetValue.textContent = "1,000";
    statusBox.textContent = "Fill in the form above to see your trip summary.";
});


/* Saved trips stored in the browser https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage */
const savedList = document.getElementById("savedList");
const noSavedMessage = document.getElementById("noSavedMessage");

function getSavedTrips() {
    return JSON.parse(localStorage.getItem("wayfinderTrips")) || [];
}

function showSavedTrips() {
    const trips = getSavedTrips();
    savedList.innerHTML = "";
    trips.forEach(function (trip) {
        const item = document.createElement("li");
        item.textContent = `${trip.name || trip.place}: ${trip.start} to ${trip.end}`;   // textContent keeps user input safe
        savedList.appendChild(item);
    });
    noSavedMessage.hidden = trips.length > 0;
}

function saveTrip(trip, place) {
    const trips = getSavedTrips();
    trips.unshift({ name: trip.name, place: `${place.name}, ${place.country}`, start: trip.start, end: trip.end });
    localStorage.setItem("wayfinderTrips", JSON.stringify(trips));
    showSavedTrips();
}

document.getElementById("clearSavedBtn").addEventListener("click", function () {
    localStorage.removeItem("wayfinderTrips");
    showSavedTrips();
});

showSavedTrips();   // show saved trips when the page loads