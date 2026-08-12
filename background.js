/**
 * High Tide Alert - Background Service Worker
 * Vẽ icon động dựa trên mực nước thủy triều và số cột tùy chỉnh
 */

const TIDE_URL = 'https://thegioimoicau.com/dia-danh/sai-gon/trang-1';
const DEFAULT_THRESHOLD = 1.5;
const DEFAULT_THRESHOLD2 = 2.0;
const DEFAULT_COLUMNS = 12;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('updateIconAlarm', { periodInMinutes: 5 });
  updateDynamicIcon();
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes.tideThreshold || changes.tideThreshold2 || changes.iconColumns)) {
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
    const labels = [];
    const data = [];
    
    for (let j = 0; j < tideData.length - 1; j += 2) {
      const hourStr = tideData[j];
      const hour = parseInt(hourStr.replace('h', ''), 10);
      const level = parseFloat(tideData[j + 1]);
      
      if (!isNaN(hour) && !isNaN(level)) {
        entries.push({ hour, level });
        labels.push(hourStr);
        data.push(level);
      }
    }

    if (date && entries.length) {
      result.push({ date, entries, labels, data });
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

function drawExtensionIcon(tables, threshold, threshold2, columns) {
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
    for (let i = currentIndex; i <= currentIndex + (columns - 1); i++) {
      if (i >= 0 && i < flatData.length) {
        targetLevels.push(flatData[i].level);
      } else {
        targetLevels.push(0);
      }
    }
  } else {
    targetLevels.push(...Array(columns).fill(0));
  }

  const canvas = new OffscreenCanvas(32, 32);
  const ctx = canvas.getContext('2d');
  
  // Vẽ nền trắng
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 32, 32);

  const maxUsableHeight = 29;
  
  // Tự động tính toán chiều rộng cột dựa trên số lượng cột
  const colWidth = 32 / columns; 
  const gap = 0;
  const startX = 0;

  targetLevels.forEach((level, idx) => {
    if (level === 0) return;
    
    const ratio = Math.min(1, level / threshold);
    const h = Math.max(1, ratio * maxUsableHeight);
    const x = startX + idx * (colWidth + gap);
    const y = 32 - h;

    if (level > threshold) {
      ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    } else if (level === threshold) {
      ctx.fillStyle = 'rgba(255, 0, 0, 1)';
    } else if (level >= threshold2) {
      ctx.fillStyle = 'rgba(255, 215, 0, 1)';
    } else {
      ctx.fillStyle = 'rgba(54, 162, 235, 1)';
    }

    ctx.fillRect(x, y, colWidth, h);
  });

  ctx.fillStyle = 'rgba(255, 0, 0, 1)';
  ctx.fillRect(0, 0, 32, 3);

  const imageData = ctx.getImageData(0, 0, 32, 32);
  chrome.action.setIcon({ imageData: imageData });

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
      chrome.storage.local.get(['tideThreshold', 'tideThreshold2', 'iconColumns'], (result) => {
        const threshold = parseFloat(result.tideThreshold ?? DEFAULT_THRESHOLD);
        const threshold2 = parseFloat(result.tideThreshold2 ?? DEFAULT_THRESHOLD2);
        const columns = parseInt(result.iconColumns ?? DEFAULT_COLUMNS, 10);
        
        const tables = parseTideTables(html, 4); 
        chrome.storage.local.set({ tideData: tables });
        
        drawExtensionIcon(tables, threshold, threshold2, columns);
      });
    })
    .catch((err) => {
      console.error('[High Tide Alert] Cập nhật icon thất bại:', err.message);
    });
}