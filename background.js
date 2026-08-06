/**
 * High Tide Alert - Background Service Worker
 * Cập nhật badge & icon định kỳ dựa trên mực nước thủy triều Sài Gòn
 */

const TIDE_URL = 'https://thegioimoicau.com/dia-danh/sai-gon/trang-1';
const DEFAULT_THRESHOLD = 1.5;   // Đỏ (nguy hiểm cao)
const DEFAULT_THRESHOLD2 = 2.0;  // Vàng (cảnh báo)
const DEFAULT_HOURS = Array.from({ length: 24 }, (_, i) => i);

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('updateBadgeAlarm', { periodInMinutes: 5 });
  updateBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updateBadgeAlarm') {
    updateBadge();
  }
});

/**
 * Parse HTML thủy triều bằng regex (service worker không có DOMParser)
 * @returns {{ date: string, entries: { hour: number, level: number }[] }[]}
 */
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

function updateBadge() {
  fetch(TIDE_URL, {
    method: 'GET',
    headers: {
      Accept: 'text/html',
      'Content-Type': 'text/html; charset=UTF-8'
    }
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
    .then((html) => {
      chrome.storage.local.get(
        ['tideThreshold', 'tideThreshold2', 'selectedHours'],
        (result) => {
          const threshold = parseFloat(result.tideThreshold ?? DEFAULT_THRESHOLD);
          const threshold2 = parseFloat(result.tideThreshold2 ?? DEFAULT_THRESHOLD2);
          const selectedHours =
            Array.isArray(result.selectedHours) && result.selectedHours.length
              ? result.selectedHours
              : DEFAULT_HOURS;

          const currentHour = new Date().getHours();
          const today = getTodayString();
          const tables = parseTideTables(html, 3);

          const redDays = [];
          let currentHourLevel = null;

          tables.forEach((table, idx) => {
            table.entries.forEach(({ hour, level }) => {
              if (selectedHours.includes(hour) && level >= threshold) {
                if (!redDays.includes(idx + 1)) redDays.push(idx + 1);
              }
              if (idx === 0 && table.date === today && hour === currentHour) {
                currentHourLevel = level;
              }
            });
          });

          // Badge: số ngày có mực nước vượt ngưỡng đỏ trong khung giờ đã chọn
          if (redDays.length > 0) {
            chrome.action.setBadgeText({ text: redDays.join('') });
            chrome.action.setBadgeBackgroundColor({ color: '#EA4335' });
            chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
          } else {
            chrome.action.setBadgeText({ text: '' });
          }

          // Icon theo mực nước giờ hiện tại
          let iconPath = 'icon64.png';
          if (currentHourLevel !== null) {
            if (currentHourLevel >= threshold) {
              iconPath = 'icon64_red.png';
            } else if (currentHourLevel >= threshold2) {
              iconPath = 'icon64_yellow.png';
            }
          }
          chrome.action.setIcon({ path: iconPath });
        }
      );
    })
    .catch((err) => {
      console.error('[High Tide Alert] updateBadge failed:', err.message);
    });
}
