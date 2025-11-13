
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


app.get("/api/restaurant/:id", async (req, res) => {
  const restaurantId = req.params.id;
  
  const apiUrl = `https://www.swiggy.com/dapi/menu/pl?page-type=REGULAR_MENU&complete-menu=true&lat=26.83730&lng=80.91650&restaurantId=${restaurantId}&catalog_qa=undefined`;
  
  console.log('🚀 Launching browser to bypass WAF...');
  
  const browser = await chromium.launch({
    headless: true,  // Run headless for production
    args: ['--disable-blink-features=AutomationControlled']
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US'
    });

    const page = await context.newPage();
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': '*/*'
    });
    
    console.log('🌐 Visiting Swiggy to establish session...');
    
    // Visit main page first to pass WAF challenge
    await page.goto('https://www.swiggy.com', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log('⏳ Waiting for WAF challenge to complete...');
    await page.waitForTimeout(5000);
    
    console.log('📡 Fetching API data...');
    
    // Now fetch the API endpoint
    const response = await page.goto(apiUrl, {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log('✅ API call successful!');
    console.log('Status:', response.status());
    
    // Extract JSON data
    const textContent = await page.evaluate(() => {
      const pre = document.querySelector('pre');
      if (pre) return pre.textContent;
      return document.body.textContent;
    });
    
    const jsonData = JSON.parse(textContent);
    
    // Display summary
    console.log('\n📦 Data Summary:');
    console.log('Restaurant:', jsonData?.data?.cards?.[2]?.card?.card?.info?.name || 'N/A');
    console.log('Area:', jsonData?.data?.cards?.[2]?.card?.card?.info?.areaName || 'N/A');
    console.log('Rating:', jsonData?.data?.cards?.[2]?.card?.card?.info?.avgRating || 'N/A');
    console.log('Total Menu Groups:', jsonData?.data?.cards?.[4]?.groupedCard?.cardGroupMap?.REGULAR?.cards?.filter(c => c.card?.card?.itemCards)?.length || 'N/A');
    
    return res.json(jsonData);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await browser.close();
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
