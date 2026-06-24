const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Universal login credentials data bank
const userInfo = {
  username: "tvpass",
  password: "live",
  auth: 1,
  status: "Active",
  exp_date: "1798761600",
  max_connections: "50"
};

const serverInfo = {
  url: "render.com",
  port: "443",
  https_port: "443",
  server_protocol: "https",
  timezone: "America/New_York"
};

// Handle player requests seamlessly whether they call player_api.php or get.php
app.get(['/player_api.php', '/get.php'], (req, requireResponse) => {
  const { username, password, action } = req.query;

  // Validate the login credentials
  if (username !== userInfo.username || password !== userInfo.password) {
    return requireResponse.status(403).json({ error: "Invalid pipeline login authorization data" });
  }

  // Action route controller: when the player asks for channels
  if (action === 'get_live_streams') {
    const liveStreams = [
      {
        num: 1,
        name: "Cartoon Network",
        stream_id: 101,
        stream_icon: "https://iptv-org.github.io/logos/languages/mul/CartoonNetwork.png",
        epg_channel_id: "CartoonNetwork.la@mx",
        category_id: "1"
      },
      {
        num: 2,
        name: "Adult Swim",
        stream_id: 102,
        stream_icon: "https://iptv-org.github.io/logos/languages/mul/AdultSwim.png",
        epg_channel_id: "AdultSwim.us",
        category_id: "1"
      }
    ];
    return requireResponse.json(liveStreams);
  }

  // Action route controller: when the player asks for categories
  if (action === 'get_live_categories') {
    return requireResponse.json([{ category_id: "1", category_name: "TVPass Animation Network" }]);
  }

  // Default fallback: return general account panel login details
  return requireResponse.json({ user_info: userInfo, server_info: serverInfo });
});

// Video stream request target endpoint
app.get('/live/:username/:password/:streamId.m3u8', (req, requireResponse) => {
  const { streamId } = req.params;
  
  // Point the streaming target IDs directly to your active feeds
  let directStreamUrl = "";
  if (streamId === "101") directStreamUrl = "https://your-stream-provider.com/live/cartoon_network.m3u8";
  if (streamId === "102") directStreamUrl = "https://your-stream-provider.com/live/adult_swim.m3u8";

  if (directStreamUrl) {
    // Issue a clean 302 stream pointer redirect directly to the player video processor
    return requireResponse.redirect(302, directStreamUrl);
  }
  return requireResponse.status(404).send("Stream channel signature offline.");
});

app.listen(PORT, () => {
  console.log(`TVPass pipeline online on interface target port ${PORT}`);
});
