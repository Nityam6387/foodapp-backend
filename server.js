
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { chromium }  = require('playwright');
// const writeFileSync = require('fs');

const app = express();
// const PORT = 5000;
const PORT = process.env.PORT || 5000;


app.use(cors());

// 👉 Route 1: Get list of restaurants
app.get("/api/restaurants", async (req, res) => {
  const swiggyAPI =
    "https://www.swiggy.com/dapi/restaurants/list/v5?lat=28.5355161&lng=77.3910265&is-seo-homepage-enabled=true&page_type=DESKTOP_WEB_LISTING";

  try {
    const response = await axios.get(swiggyAPI, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });

    console.log("✅ Data fetched from Swiggy (Restaurant List)");
    res.json(response.data);
  } catch (error) {
    console.error("❌ Error fetching Swiggy restaurant list:", error.message);
    res.status(500).json({ error: "Failed to fetch restaurant list" });
  }
});

// 👉 Route 2: Get menu/details of a restaurant by ID


// app.get("/api/restaurant/:id", async (req, res) => {
//   const restaurantId = req.params.id;
  
//   const apiUrl = `https://www.swiggy.com/dapi/menu/pl?page-type=REGULAR_MENU&complete-menu=true&lat=26.83730&lng=80.91650&restaurantId=${restaurantId}&catalog_qa=undefined`;
  
//   console.log('🚀 Launching browser to bypass WAF...');
  
//   const browser = await chromium.launch({
//     headless: true,  // Run headless for production
//     args: ['--disable-blink-features=AutomationControlled']
//   });

//   try {
//     const context = await browser.newContext({
//       userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
//       viewport: { width: 1920, height: 1080 },
//       locale: 'en-US'
//     });

//     const page = await context.newPage();
    
//     await page.setExtraHTTPHeaders({
//       'Accept-Language': 'en-US,en;q=0.9',
//       'Accept': '*/*'
//     });
    
//     console.log('🌐 Visiting Swiggy to establish session...');
    
//     // Visit main page first to pass WAF challenge
//     await page.goto('https://www.swiggy.com', {
//       waitUntil: 'networkidle',
//       timeout: 30000
//     });
    
//     console.log('⏳ Waiting for WAF challenge to complete...');
//     await page.waitForTimeout(5000);
    
//     console.log('📡 Fetching API data...');
    
//     // Now fetch the API endpoint
//     const response = await page.goto(apiUrl, {
//       waitUntil: 'networkidle',
//       timeout: 30000
//     });
    
//     console.log('✅ API call successful!');
//     console.log('Status:', response.status());
    
//     // Extract JSON data
//     const textContent = await page.evaluate(() => {
//       const pre = document.querySelector('pre');
//       if (pre) return pre.textContent;
//       return document.body.textContent;
//     });
    
//     const jsonData = JSON.parse(textContent);
    
//     // Display summary
//     console.log('\n📦 Data Summary:');
//     console.log('Restaurant:', jsonData?.data?.cards?.[2]?.card?.card?.info?.name || 'N/A');
//     console.log('Area:', jsonData?.data?.cards?.[2]?.card?.card?.info?.areaName || 'N/A');
//     console.log('Rating:', jsonData?.data?.cards?.[2]?.card?.card?.info?.avgRating || 'N/A');
//     console.log('Total Menu Groups:', jsonData?.data?.cards?.[4]?.groupedCard?.cardGroupMap?.REGULAR?.cards?.filter(c => c.card?.card?.itemCards)?.length || 'N/A');
    
//     return res.json(jsonData);

//   } catch (error) {
//     console.error('❌ Error:', error.message);
//     throw error;
//   } finally {
//     await browser.close();
//   }
// });

// --- robust /api/restaurant/:id (axios first, Playwright fallback, safe) ---
app.get("/api/restaurant/:id", async (req, res) => {
  const restaurantId = req.params.id;
  const apiUrl = `https://www.swiggy.com/dapi/menu/pl?page-type=REGULAR_MENU&complete-menu=true&lat=26.83730&lng=80.91650&restaurantId=${restaurantId}&catalog_qa=undefined`;

  console.log(`[${new Date().toISOString()}] GET /api/restaurant/${restaurantId}`);

  // 1) Try axios first
  try {
    console.log(" -> Trying axios GET...");
    const axResp = await axios.get(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 20000,
      validateStatus: () => true, // we'll inspect status ourselves
    });

    console.log(" -> axios status:", axResp.status);

    // If axios returned a usable body, try parse/return
    if (axResp.status === 200 && axResp.data && Object.keys(axResp.data).length !== 0) {
      let jsonData = axResp.data;
      if (typeof jsonData === "string") {
        try {
          jsonData = JSON.parse(jsonData);
        } catch (e) {
          console.warn(" -> axios returned string but not JSON; returning raw string object");
          return res.status(200).json({ raw: jsonData });
        }
      }
      console.log(" -> Returning axios JSON");
      return res.json(jsonData);
    }

    // If axios returned 200 but empty body OR non-200 (blocked), move to fallback
    console.warn(" -> axios did not return usable data, falling back (status):", axResp.status);
  } catch (axErr) {
    console.warn(" -> Axios error:", axErr.message || axErr);
    // continue to playwright fallback
  }

  // 2) Playwright fallback (only if allowed)
  if (process.env.DISABLE_PLAYWRIGHT === "1") {
    console.warn(" -> Playwright disabled by env; returning 502.");
    return res.status(502).json({ error: "Menu fetch blocked. Playwright disabled." });
  }

  let browser;
  try {
    console.log(" -> Launching Playwright Chromium (fallback) ...");
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--disable-blink-features=AutomationControlled",
      ],
      // optionally set executablePath via env if you installed browsers elsewhere
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
      locale: "en-US",
    });

    const page = await context.newPage();
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "*/*",
    });

    console.log(" -> Visiting swiggy homepage to create session...");
    await page.goto("https://www.swiggy.com", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2500);

    console.log(" -> Fetching menu endpoint via page.goto...");
    const respPage = await page.goto(apiUrl, { waitUntil: "networkidle", timeout: 30000 });

    if (!respPage) {
      throw new Error("No response from page.goto(apiUrl)");
    }
    console.log(" -> page response status:", respPage.status());

    const textContent = await page.evaluate(() => {
      const pre = document.querySelector("pre");
      if (pre) return pre.textContent;
      return document.body.textContent || "";
    });

    if (!textContent || textContent.trim().length === 0) {
      console.warn(" -> Playwright returned empty textContent");
      // optional: return a mock here instead of 502
      return res.status(502).json({ error: "Empty response from Swiggy (playwright)" });
    }

    // parse safely
    let jsonData;
    try {
      jsonData = JSON.parse(textContent);
    } catch (parseErr) {
      console.error(" -> Failed to parse JSON from Playwright textContent:", parseErr.message);
      return res.status(502).json({ error: "Failed to parse menu JSON", details: parseErr.message, raw: textContent.slice(0, 1000) });
    }

    console.log(" -> Playwright fetched and parsed JSON successfully");
    return res.json(jsonData);
  } catch (pwErr) {
    console.error(" -> Playwright fallback error:", pwErr && pwErr.message ? pwErr.message : pwErr);
    // final fallback: serve a small mock so frontend doesn't break
    if (process.env.USE_MOCK_ON_FAIL === "1") {
      console.log(" -> Returning mock data due to Playwright failure (USE_MOCK_ON_FAIL=1)");
      return res.json({
        data: {
          cards: [
            { card: { card: { info: { name: "Demo Restaurant (mock)", areaName: "Demo Area", avgRating: "4.0" } } } },
          ],
        },
      });
    }
    return res.status(502).json({ error: "Playwright fallback failed", details: String(pwErr) });
  } finally {
    try {
      if (browser) {
        console.log(" -> Closing browser");
        await browser.close();
      }
    } catch (closeErr) {
      console.error(" -> Error closing browser:", closeErr && closeErr.message ? closeErr.message : closeErr);
    }
  }
});




app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});


// const express = require("express");
// const cors = require("cors");
// const axios = require("axios");

// const app = express();
// const PORT = 5000;

// app.use(cors());

// app.get("/api/restaurants", async (req, res) => {
//   const swiggyAPI =
//     "https://www.swiggy.com/dapi/restaurants/list/v5?lat=28.5355161&lng=77.3910265&is-seo-homepage-enabled=true&page_type=DESKTOP_WEB_LISTING";

//   try {
//     const response = await axios.get(swiggyAPI, {
//       headers: {
//         "User-Agent":
//           "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
//         Accept: "application/json",
//       },
//     });

//     console.log("✅ Data fetched from Swiggy");
//     res.json(response.data);
//   } catch (error) {
//     console.error("❌ Error fetching Swiggy API:", error.message);
//     res.status(500).json({ error: "Failed to fetch Swiggy data" });
//   }
// });

// app.listen(PORT, () => {
//   console.log(`🚀 Server running at http://localhost:${PORT}`);
// });
