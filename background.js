/**
 * High Tide Alert - Background Service Worker
 * Vẽ icon 5 cột động (T-1 đến T+3) dựa trên mực nước thủy triều
 */

const TIDE_URL = 'https://thegioimoicau.com/dia-danh/sai-gon/trang-1';
const DEFAULT_THRESHOLD = 1.5;
const DEFAULT_THRESHOLD2 = 2.0;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('updateIconAlarm', { periodInMinutes: 5 });
  updateDynamicIcon();
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes.tideThreshold || changes.tideThreshold2)) {
    updateDynamicIcon();
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updateIconAlarm') {
    updateDynamicIcon();
  }
});

function parseTideTables(html, maxTables = 3) {
  const result = [];
  const tableRegex = /<table class="table table-striped">[\s\S]*?<\/table>/g;
  const tables = html.match(tableRegex) || [];

  for (let i = 0; i < Math.min(tables.length, maxTables); i++) {
    const table = tables[i];
    let date = '';
    const tideData = [];

    const barRegex = /<div class="progress-bar[^>]*>([^<]+)<\/div>/g;
    let match;
    while ((match = barRegex.exec(table)) !== null) {
      const text = match[1].trim();
      if (/Dương lịch \d{2}\/\d{2}\/\d{4}/.test(text)) {
        date = text.replace('Dương lịch ', '');
      } else if (/^\d{1,2}h$/.test(text) || /^\d+\.\d+m$/.test(text)) {
        tideData.push(text);
      }
    }

    const entries = [];
    for (let j = 0; j < tideData.length - 1; j += 2) {
      const hour = parseInt(tideData[j].replace('h', ''), 10);
      const level = parseFloat(tideData[j + 1]);
      if (!isNaN(hour) && !isNaN(level)) {
        entries.push({ hour, level });
      }
    }

    if (date && entries.length) {
      result.push({ date, entries });
    }
  }
  return result;
}

function getTodayString() {
  return new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function drawExtensionIcon(tables, threshold, threshold2) {
  const flatData = [];
  tables.forEach(t => {
    t.entries.forEach(e => {
      flatData.push({ date: t.date, hour: e.hour, level: e.level });
    });
  });

  const currentHour = new Date().getHours();
  const today = getTodayString();
  const currentIndex = flatData.findIndex(d => d.date === today && d.hour === currentHour);

  const targetLevels = [];
  if (currentIndex !== -1) {
    for (let i = currentIndex - 1; i <= currentIndex + 3; i++) {
      if (i >= 0 && i < flatData.length) {
        targetLevels.push(flatData[i].level);
      } else {
        targetLevels.push(0);
      }
    }
  } else {
    targetLevels.push(0, 0, 0, 0, 0);
  }

  const canvas = new OffscreenCanvas(32, 32);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 32, 32);

  const maxLevel = Math.max(...targetLevels, 2.5);
  const colWidth = 5;
  const gap = 1;
  const startX = 1;

  targetLevels.forEach((level, idx) => {
    if (level === 0) return;
    
    const h = Math.max((level / maxLevel) * 32, 1);
    const x = startX + idx * (colWidth + gap);
    const y = 32 - h;

    if (level >= threshold) {
      ctx.fillStyle = 'rgba(255, 0, 0, 1)';
    } else if (level >= threshold2) {
      ctx.fillStyle = 'rgba(255, 215, 0, 1)';
    } else {
      ctx.fillStyle = 'rgba(54, 162, 235, 1)';
    }

    ctx.fillRect(x, y, colWidth, h);

    if (idx === 1) {
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      ctx.fillRect(x, 32 - 4, colWidth, 4);
    }
  });

  const imageData = ctx.getImageData(0, 0, 32, 32);
  chrome.action.setIcon({ imageData: imageData });

  // Cập nhật tooltip ngắn gọn
  if (currentIndex !== -1 && flatData[currentIndex]) {
    const currentData = flatData[currentIndex];
    chrome.action.setTitle({ title: `${currentData.level}m` });
  } else {
    chrome.action.setTitle({ title: 'High Tide Alert' });
  }
}

function updateDynamicIcon() {
  fetch(TIDE_URL, {
    method: 'GET',
    headers: { Accept: 'text/html', 'Content-Type': 'text/html; charset=UTF-8' }
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
    .then((html) => {
      chrome.storage.local.get(['tideThreshold', 'tideThreshold2'], (result) => {
        const threshold = parseFloat(result.tideThreshold ?? DEFAULT_THRESHOLD);
        const threshold2 = parseFloat(result.tideThreshold2 ?? DEFAULT_THRESHOLD2);
        const tables = parseTideTables(html, 4); 
        drawExtensionIcon(tables, threshold, threshold2);
      });
    })
    .catch((err) => {
      console.error('[High Tide Alert] Cập nhật icon thất bại:', err.message);
    });
}