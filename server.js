const express = require('express');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

const GITHUB_USER = "Armond452Alt";
const GITHUB_REPO = "Fixed-M3U";
const M3U_PATH = "CN/AS.m3u";

let channelCache = [];
let lastStatusReport = "Server started. Initializing network check...";
let userInfo = { username: "tvpass", password: "live", auth: 1, status: "Active", exp_date: "1798761600", max_connections: "50" };

function getLogoUrl(name) {
  const lower = name.toLowerCase();
  const base = "https://iptv-org.github.io/logos/languages/mul/";
  if (lower.includes('adult swim') || lower.includes('swim')) return `${base}AdultSwim.png`;
  if (lower.includes('cartoon') || lower.includes('cn')) return `${base}CartoonNetwork.png`;
  if (lower.includes('nickelodeon')) return `${base}Nickelodeon.png`;
  if (lower.includes('nicktoons')) return `${base}Nicktoons.png`;
  return "https://iptv-org.github.io/logos/categories/classic.png";
}

function fetchM3U(branch) {
  return new Promise((resolve, reject) => {
    const url = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${branch}/${M3U_PATH}`;
    https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`GitHub returned HTTP Code ${res.statusCode}`));
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', (err) => reject(err));
  });
}

async function updatePlaylistCache() {
  try {
    const playlistData = await fetchM3U('main');
    parsePlaylist(playlistData, 'main');
  } catch (error) {
    try {
      const playlistData = await fetchM3U('master');
      parsePlaylist(playlistData, 'master');
    } catch (fallbackError) {
      lastStatusReport = `CRITICAL ERROR: Failed to fetch your M3U file from GitHub from both 'main' and 'master' branches. Double-check that your file is named exactly '${M3U_PATH}' inside your '${GITHUB_REPO}' repository. Error: ${fallbackError.message}`;
      console.error(lastStatusReport);
    }
  }
}

function parsePlaylist(playlistData, branch) {
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
    lastStatusReport = `SUCCESS: Loaded ${channelCache.length} channels perfectly from the [${branch}] branch line.`;
    console.log(lastStatusReport);
  } else {
    lastStatusReport = `WARNING: Connected to GitHub [${branch}] successfully, but could not parse any channels out of the file text. Check your M3U syntax formatting.`;
  }
}

// Automatic Sync Routines
updatePlaylistCache();
setInterval(updatePlaylistCache, 15 * 60 * 1000);

// --- DIAGNOSTIC HOME DASHBOARD ---
app.get('/', (req, res) => {
  res.send(`
    <style>body{background:#111;color:#fff;font-family:sans-serif;padding:40px;} .box{background:#222;padding:20px;border-radius:8px;border:1px solid #333;margin-top:20px;}</style>
    <h2>TVPass Xtream API Diagnostic Link</h2>
    <div class="box"><strong>System Status:</strong> ${lastStatusReport}</div>
    <div class="box"><strong>Active Channels in Database:</strong> ${channelCache.length}</div>
    <div class="box"><strong>Detected Channel Inventory:</strong><br><pre>${JSON.stringify(channelCache.map(c => c.name), null, 2)}</pre></div>
  `);
});

// Xtream App API endpoints
app.get(['/player_api.php', '/get.php'], (req, res) => {
  const { username, password, action } = req.query;
  if (username !== userInfo.username || password !== userInfo.password) return res.status(403).json({ error: "Invalid credentials" });
  if (action === 'get_live_streams') return res.json(channelCache.map(({direct_url, ...keep}) => keep));
  if (action === 'get_live_categories') return res.json([{ category_id: "1", category_name: "TVPass Network Pipeline" }]);
  return res.json({ user_info: userInfo, server_info: { url: "render.com", port: "443", https_port: "443", server_protocol: "https", timezone: "America/New_York" } });
});

app.get('/live/:username/:password/:streamId.m3u8', (req, res) => {
  const { streamId } = req.params;
  const targetChannel = channelCache.find(c => c.stream_id.toString() === streamId.toString());
  if (targetChannel && targetChannel.direct_url) return res.redirect(302, targetChannel.direct_url);
  return res.status(404).send("Off-line");
});

app.listen(PORT, () => console.log(`Online on port ${PORT}`));
