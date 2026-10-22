/**
 * High Tide Alert - Web Version
 * Chuyển thể từ Chrome Extension
 */

const TIDE_URL = 'https://thegioimoicau.com/dia-danh/sai-gon/trang-1';
// Proxy để bypass CORS (có thể thay đổi nếu proxy chết)
const PROXY_URL = 'https://api.allorigins.win/raw?url=';

const DEFAULTS = {
  threshold: 1.5,
  threshold2: 2.0,
  days: 4
};

let chartInstances = [];

// ===== Storage =====
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('tideSettings') || '{}');
    return {
      threshold: parseFloat(saved.threshold ?? DEFAULTS.threshold),
      threshold2: parseFloat(saved.threshold2 ?? DEFAULTS.threshold2),
      days: parseInt(saved.days ?? DEFAULTS.days, 10)
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(settings) {
  localStorage.setItem('tideSettings', JSON.stringify(settings));
}

// ===== Parse HTML =====
function parseTideTables(html, maxTables = 4) {
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
      } else if (/^\d{1,2}h$/.test(text) || /^\d+\.\d+m$/.test(text) || /^\d+,\d+m$/.test(text)) {
        tideData.push(text.replace(',', '.'));
      }
    }

    const labels = [];
    const data = [];

    for (let j = 0; j < tideData.length - 1; j += 2) {
      const hourStr = tideData[j];
      const hour = parseInt(hourStr.replace('h', ''), 10);
      const level = parseFloat(tideData[j + 1]);

      if (!isNaN(hour) && !isNaN(level)) {
        labels.push(hourStr);
        data.push(level);
      }
    }

    if (date && labels.length) {
      result.push({ date, labels, data });
    }
  }
  return result;
}

// ===== Chart helpers =====
function createDiagonalPattern(baseColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 16, 16);
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 16);
  ctx.lineTo(16, 0);
  ctx.stroke();
  return ctx.createPattern(canvas, 'repeat');
}

function renderChart(container, { date, labels, data }, index, threshold, threshold2) {
  const [day, month, year] = date.split('/');
  const dateObj = new Date(`${year}-${month}-${day}`);
  const weekday = dateObj.toLocaleDateString('vi-VN', { weekday: 'long' });

  const dateDiv = document.createElement('div');
  dateDiv.className = 'date';
  dateDiv.innerHTML = `<span class="date-value">${weekday}, ${date}</span>`;
  container.appendChild(dateDiv);

  const currentHour = new Date().getHours();
  const barColors = data.map((level, idx) => {
    const hour = parseInt(labels[idx].replace('h', ''), 10);
    let base = 'rgba(54, 162, 235, 1)';
    if (level >= threshold2) base = 'rgba(255, 215, 0, 1)';
    if (level >= threshold) base = 'rgba(255, 0, 0, 1)';
    if (index === 0 && hour === currentHour) {
      return createDiagonalPattern(base);
    }
    return base;
  });

  const canvas = document.createElement('canvas');
  canvas.className = 'tide-chart';
  container.appendChild(canvas);

  const annotations = {
    thresholdLine: {
      type: 'line', yMin: threshold, yMax: threshold,
      borderColor: '#d32f2f', borderWidth: 2, borderDash: [5, 5]
    },
    threshold2Line: {
      type: 'line', yMin: threshold2, yMax: threshold2,
      borderColor: '#ff8f00', borderWidth: 2, borderDash: [5, 5]
    }
  };

  const newChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Mực nước (m)',
        data,
        backgroundColor: barColors,
        borderColor: barColors,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: { title: { display: true, text: 'Thời gian', font: { size: 11 } } },
        y: { beginAtZero: true, title: { display: true, text: 'Mực nước (m)', font: { size: 11 } } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y} m` } },
        annotation: { annotations }
      }
    }
  });

  chartInstances.push(newChart);
}

// ===== Current level display =====
function updateCurrentLevel(tables, threshold, threshold2) {
  const el = document.getElementById('current-level');
  if (!tables || !tables.length) {
    el.textContent = '--';
    el.className = 'current-level';
    return;
  }

  const today = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  const currentHour = new Date().getHours();
  const todayTable = tables.find(t => t.date === today);

  if (!todayTable) {
    el.textContent = 'Không có dữ liệu hôm nay';
    el.className = 'current-level';
    return;
  }

  const hourIdx = todayTable.labels.findIndex(l => parseInt(l) === currentHour);
  if (hourIdx === -1) {
    el.textContent = '--';
    el.className = 'current-level';
    return;
  }

  const level = todayTable.data[hourIdx];
  el.textContent = `${level} m (hiện tại)`;

  if (level >= threshold) {
    el.className = 'current-level high';
  } else if (level >= threshold2) {
    el.className = 'current-level medium';
  } else {
    el.className = 'current-level low';
  }
}

// ===== Main load =====
async function loadTideData() {
  const statusEl = document.getElementById('status');
  const tideInfo = document.getElementById('tide-info');
  const settings = loadSettings();

  document.getElementById('threshold').value = settings.threshold;
  document.getElementById('threshold2').value = settings.threshold2;
  document.getElementById('days').value = settings.days;

  statusEl.textContent = 'Đang tải dữ liệu...';
  chartInstances.forEach(c => c.destroy());
  chartInstances = [];
  tideInfo.innerHTML = '';

  try {
    const res = await fetch(PROXY_URL + encodeURIComponent(TIDE_URL));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const tables = parseTideTables(html, settings.days);
    if (!tables.length) {
      statusEl.textContent = 'Không tìm thấy dữ liệu thủy triều. Thử lại sau.';
      return;
    }

    statusEl.textContent = `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')}`;
    tables.forEach((t, idx) => {
      renderChart(tideInfo, t, idx, settings.threshold, settings.threshold2);
    });
    updateCurrentLevel(tables, settings.threshold, settings.threshold2);
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Lỗi tải dữ liệu (có thể do proxy). Hãy thử nút Làm mới hoặc kiểm tra kết nối.';
  }
}

// ===== Events =====
document.addEventListener('DOMContentLoaded', () => {
  if (typeof Chart !== 'undefined' && window['chartjs-plugin-annotation']) {
    Chart.register(window['chartjs-plugin-annotation']);
  }

  document.getElementById('save-btn').addEventListener('click', () => {
    const threshold = parseFloat(document.getElementById('threshold').value);
    const threshold2 = parseFloat(document.getElementById('threshold2').value);
    const days = parseInt(document.getElementById('days').value, 10);

    if (isNaN(threshold) || threshold < 0 || isNaN(threshold2) || threshold2 < 0 ||
        isNaN(days) || days < 1 || days > 7) {
      alert('Vui lòng nhập thông số hợp lệ (Ngưỡng ≥ 0, Số ngày 1-7).');
      return;
    }

    saveSettings({ threshold, threshold2, days });
    loadTideData();
  });

  document.getElementById('refresh-btn').addEventListener('click', loadTideData);
  loadTideData();
});