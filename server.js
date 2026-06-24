const express = require('express');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

// 1. Point this directly to your raw GitHub repository M3U file link
const M3U_PLAYLIST_URL = "https://raw.githubusercontent.com/Armond452Alt/Fixed-M3U/main/CN/AS.m3u";

// Global database caches
let channelCache = [];
let userInfo = {
  username: "tvpass",
  password: "live",
  auth: 1,
  status: "Active",
  exp_date: "1798761600",
  max_connections: "50"
};

// 2. Automated IPTV-Org Logo Matcher Engine
function getLogoUrl(name) {
  const lower = name.toLowerCase();
  const base = "https://iptv-org.github.io/logos/languages/mul/";
  if (lower.includes('adult swim') || lower.includes('swim')) return `${base}AdultSwim.png`;
  if (lower.includes('cartoon') || lower.includes('cn')) return `${base}CartoonNetwork.png`;
  if (lower.includes('nickelodeon')) return `${base}Nickelodeon.png`;
  if (lower.includes('nicktoons')) return `${base}Nicktoons.png`;
  return "https://iptv-org.github.io/logos/categories/classic.png";
}

// 3. Central M3U Transmission Stream Parser
function updatePlaylistCache() {
  https.get(M3U_PLAYLIST_URL, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      const lines = data.split('\n');
      let currentName = '';
      let tempCache = [];
      let streamIdCounter = 100;

      lines.forEach(line => {
        line = line.trim();
        if (line.startsWith('#EXTINF:')) {
          const commaIndex = line.lastIndexOf(',');
          if (commaIndex !== -1) {
            currentName = line.substring(commaIndex + 1).trim();
          }
        } else if (line.startsWith('http') && currentName) {
          streamIdCounter++;
          tempCache.push({
            num: tempCache.length + 1,
            name: currentName,
            stream_id: streamIdCounter,
            stream_icon: getLogoUrl(currentName),
            epg_channel_id: currentName.toLowerCase().includes('cartoon') ? "CartoonNetwork.la@mx" : "AdultSwim.us",
            category_id: "1",
            direct_url: line // Kept internally for backend video delivery redirects
          });
          currentName = '';
        }
      });

      if (tempCache.length > 0) {
        channelCache = tempCache;
        console.log(`Successfully mapped ${channelCache.length} dynamic pipeline channels from M3U.`);
      }
    });
  }).on('error', (err) => {
    console.error("Error updating stream sync profiles: ", err.message);
  });
}

// Initial pull on initialization boot
updatePlaylistCache();
// Automatically refresh cache matrix every 30 minutes to capture playlist alterations
setInterval(updatePlaylistCache, 30 * 60 * 1000);

// 4. Panel Login and Live Directory Router Endpoints
app.get(['/player_api.php', '/get.php'], (req, res) => {
  const { username, password, action } = req.query;

  if (username !== userInfo.username || password !== userInfo.password) {
    return res.status(403).json({ error: "Invalid credentials" });
  }

  if (action === 'get_live_streams') {
    // Return all parsed channels out safely to the grid array layout
    return res.json(channelCache.map(({direct_url, ...keep}) => keep));
  }

  if (action === 'get_live_categories') {
    return res.json([{ category_id: "1", category_name: "TVPass Network Pipeline" }]);
  }

  return res.json({
    user_info: userInfo,
    server_info: {
      url: "render.com",
      port: "443",
      https_port: "443",
      server_protocol: "https",
      timezone: "America/New_York"
    }
  });
});

// 5. Dynamic Video Stream Handoff Controller
app.get('/live/:username/:password/:streamId.m3u8', (req, res) => {
  const { streamId } = req.params;
  const targetChannel = channelCache.find(c => c.stream_id.toString() === streamId.toString());

  if (targetChannel && targetChannel.direct_url) {
    // Deliver a direct handoff 302 redirect payload straight into the player core engine
    return res.redirect(302, targetChannel.direct_url);
  }
  return res.status(404).send("Transmission signature route offline.");
});

app.listen(PORT, () => {
  console.log(`Live Xtream network syncing active on target interface port ${PORT}`);
});
