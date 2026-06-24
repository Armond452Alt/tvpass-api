const express = require('express');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

// Central file configuration path settings
const GITHUB_USER = "Armond452Alt";
const GITHUB_REPO = "Fixed-M3U";
const M3U_PATH = "CN/AS.m3u";

let channelCache = [];
let userInfo = {
  username: "tvpass",
  password: "live",
  auth: 1,
  status: "Active",
  exp_date: "1798761600",
  max_connections: "50000"
};

function getLogoUrl(name) {
  const lower = name.toLowerCase();
  const base = "https://iptv-org.github.io/logos/languages/mul/";
  if (lower.includes('adult swim') || lower.includes('swim')) return `${base}AdultSwim.png`;
  if (lower.includes('cartoon') || lower.includes('cn')) return `${base}CartoonNetwork.png`;
  if (lower.includes('nickelodeon')) return `${base}Nickelodeon.png`;
  if (lower.includes('nicktoons')) return `${base}Nicktoons.png`;
  return "https://iptv-org.github.io/logos/categories/classic.png";
}

// Helper function to handle streaming text downloads from GitHub
function fetchM3U(branch) {
  return new Promise((resolve, reject) => {
    const url = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${branch}/${M3U_PATH}`;
    console.log(`Attempting pipeline extraction from branch route: [${branch}]`);
    
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP Route Status Error: ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', (err) => reject(err));
  });
}

// Master parsing function that attempts to read main first, then falls back to master
async function updatePlaylistCache() {
  let playlistData = null;

  try {
    // Try primary default branch route
    playlistData = await fetchM3U('main');
  } catch (error) {
    console.log("Primary 'main' line offline. Dropping down to 'master' fallback transmission line...");
    try {
      // Try secondary fallback branch route
      playlistData = await fetchM3U('master');
    } catch (fallbackError) {
      console.error("CRITICAL: All branch retrieval routes failed. Check file placement inside repository.");
      return;
    }
  }

  if (!playlistData) return;

  const lines = playlistData.split('\n');
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
        direct_url: line
      });
      currentName = '';
    }
  });

  if (tempCache.length > 0) {
    channelCache = tempCache;
    console.log(`SUCCESS: ${channelCache.length} live channels parsed and loaded into Xtream database engine.`);
  }
}

// Boot configuration loops
updatePlaylistCache();
setInterval(updatePlaylistCache, 30 * 60 * 1000);

app.get(['/player_api.php', '/get.php'], (req, res) => {
  const { username, password, action } = req.query;

  if (username !== userInfo.username || password !== userInfo.password) {
    return res.status(403).json({ error: "Invalid credentials" });
  }

  if (action === 'get_live_streams') {
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

app.get('/live/:username/:password/:streamId.m3u8', (req, res) => {
  const { streamId } = req.params;
  const targetChannel = channelCache.find(c => c.stream_id.toString() === streamId.toString());

  if (targetChannel && targetChannel.direct_url) {
    return res.redirect(302, targetChannel.direct_url);
  }
  return res.status(404).send("Transmission signature route offline.");
});

app.listen(PORT, () => {
  console.log(`Live Xtream network syncing active on target interface port ${PORT}`);
});
