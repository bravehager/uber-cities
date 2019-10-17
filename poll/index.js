"use strict";

const fs = require("fs");

const puppeteer = require("puppeteer");
const geolib = require("geolib");
const MongoClient = require("mongodb").MongoClient;

const URI = "mongodb://localhost:27017/main";
const BUFFER_LENGTH = 3000;
const MAX_RETRIES = 3;
const DEBUG = false;

async function getPrices(page, pickup, destination) {
  await page.goto("https://www.uber.com/us/en/price-estimate/");

  let resolved = false;
  let numRetries = 0;
  while (!resolved && numRetries < MAX_RETRIES) {
    const [pickupResolve, desinationResolve] = [
      await input(page, "input[name=pickup]", pickup),
      await input(page, "input[name=destination]", destination)
    ];
    try {
      await page.waitForSelector(".text-area", {
        visible: true,
        timeout: BUFFER_LENGTH * 2
      });
    } catch (err) {
      console.log(`error resolving pricing results: ${err.message}`);
      numRetries++;
      continue;
    }
    resolved = true;
  }

  if (numRetries == MAX_RETRIES) {
    console.log(`could not resolve within ${MAX_RETRIES} retries`);
    return;
  }

  await page.screenshot({
    path: `./logs/latest.png`,
    fullPage: true
  });

  const prices = await page.evaluate(selector => {
    let results = [];
    const options = document.querySelectorAll(selector);
    options.forEach(option => results.push(option.textContent.split("$", 2)));
    return results;
  }, ".text-area");
  return prices;
}

async function input(page, selector, input) {
  await page.waitFor(BUFFER_LENGTH);
  await page.click(selector, { clickCount: 3 }); // triple click to clear
  await page.type(selector, input);
  await page.waitFor(BUFFER_LENGTH);
  await page.keyboard.press("Enter");
}

function toGeoLibCoords(doc) {
  const { LAT: latitude, LON: longitude } = doc;
  return {
    latitude,
    longitude
  };
}

function toAddress(doc) {
  const { NUMBER: number, STREET: street, POSTCODE: zipcode } = doc;
  return `${street} ${number} ${zipcode}`;
}

const toMiles = m => m / 1609.34;

const getRandomRoute = collection => {
  return new Promise((resolve, reject) => {
    collection.aggregate([{ $sample: { size: 2 } }]).toArray((err, docs) => {
      err ? reject(err) : resolve(docs);
    });
  });
};

const connectToMongo = uri => {
  return new Promise((resolve, reject) => {
    MongoClient.connect(uri, { useUnifiedTopology: true }, function(
      err,
      mongo
    ) {
      err ? reject(err) : resolve(mongo);
    });
  });
};

async function run(addresses, routes, directions) {
  const session = await puppeteer.launch({
    headless: !DEBUG
  });
  const page = await session.newPage();
  let distance = -Infinity;
  let [pickup, destination] = [null, null];
  let rand = Math.random() * 10;
  rand -= rand / 2;
  let numSeeks = 0;
  while (toMiles(distance) < 5 || toMiles(distance) > 30) {
    [pickup, destination] = await getRandomRoute(addresses);
    distance = geolib.getDistance(
      toGeoLibCoords(pickup),
      toGeoLibCoords(destination)
    );
    numSeeks++;
  }
  console.log(
    "route:",
    toAddress(pickup),
    "to",
    toAddress(destination),
    "miles:",
    toMiles(distance),
    "num seeks:",
    numSeeks
  );

  page.on("response", response => {
    if (response.url() == "https://www.uber.com/api/loadFEDirections") {
      response
        .json()
        .then(data => {
          directions.insertOne(
            {
              pickup: pickup.HASH,
              destination: destination.HASH,
              data
            },
            (err, res) => {
              if (err) console.log("err on write to directions");
              else
                console.log(
                  "write to directions:",
                  pickup.STREET,
                  destination.STREET
                );
            }
          );
        })
        .catch(err => console.log(err));
    }
  });

  const prices = await getPrices(
    page,
    toAddress(pickup),
    toAddress(destination)
  );

  routes.insertOne(
    {
      distance,
      prices,
      pickup: pickup.HASH,
      destination: destination.HASH,
      timestamp: Date.now()
    },
    (err, res) => {
      if (err) console.log("err on write to routes");
      else console.log("write to routes:", pickup.STREET, destination.STREET);
    }
  );
}

async function main() {
  const mongo = await connectToMongo(URI);
  console.log("connected to:", URI);
  const db = mongo.db("main");
  const addresses = db.collection("la");
  const routes = db.collection("routes");
  const directions = db.collection("directions");
  addresses.ensureIndex({ HASH: 1 });
  directions.ensureIndex({ pickup: 1, destination: 1 }, { unique: true });

  while (true) {
    await run(addresses, routes, directions);
  }
}

main();
