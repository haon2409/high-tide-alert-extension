/**
 * High Tide Alert - Popup
 * Hiển thị biểu đồ mực nước + cấu hình ngưỡng & khung giờ
 */

const TIDE_URL = 'https://thegioimoicau.com/dia-danh/sai-gon/trang-1';
const DEFAULT_THRESHOLD = 1.5;
const DEFAULT_THRESHOLD2 = 2.0;
const DEFAULT_HOURS = Array.from({ length: 24 }, (_, i) => i);

document.addEventListener('DOMContentLoaded', () => {
  const tideInfo = document.getElementById('tide-info');
  const statusEl = document.getElementById('status');
  const thresholdInput = document.getElementById('threshold-input');
  const thresholdSummary = document.getElementById('threshold-summary');
  const thresholdValue = document.getElementById('threshold-value');
  const threshold2Input = document.getElementById('threshold2-input');
  const threshold2Summary = document.getElementById('threshold2-summary');
  const threshold2Value = document.getElementById('threshold2-value');
  const editBtn = document.getElementById('edit-btn');
  const saveBtn = document.getElementById('save-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const hoursContainer = document.getElementById('hours-checkboxes');
  const hoursSummary = document.getElementById('hours-summary');

  if (typeof Chart === 'undefined') {
    tideInfo.textContent = 'Lỗi: Không thể tải Chart.js.';
    return;
  }

  // Đăng ký plugin annotation nếu có
  if (typeof Chart !== 'undefined' && window['chartjs-plugin-annotation']) {
    Chart.register(window['chartjs-plugin-annotation']);
  } else if (typeof ChartAnnotation !== 'undefined') {
    Chart.register(ChartAnnotation);
  }

  // Tạo checkbox 0–23h
  for (let i = 0; i < 24; i++) {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `hour-${i}`;
    checkbox.value = i;
    checkbox.disabled = true;
    label.appendChild(checkbox);
    label.append(` ${i}h`);
    hoursContainer.appendChild(label);
  }
  const hoursCheckboxes = Array.from(
    document.querySelectorAll('#hours-checkboxes input[type="checkbox"]')
  );

  /** Pattern sọc chéo đánh dấu giờ hiện tại */
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

  /** Tóm tắt dải giờ đã chọn: "6h→9h, 14h" */
  function formatHoursSummary(hours) {
    if (!hours.length) return 'Không có giờ nào';
    const sorted = [...hours].sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i <= sorted.length; i++) {
      const cur = sorted[i];
      if (i === sorted.length || cur !== prev + 1) {
        ranges.push(start === prev ? `${start}h` : `${start}h→${prev}h`);
        start = cur;
      }
      prev = cur;
    }
    return ranges.join(', ');
  }

  /** Parse bảng thủy triều từ HTML (DOMParser – chỉ dùng trong popup) */
  function parseTideTables(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const tables = Array.from(doc.querySelectorAll('table.table-striped'));
    const result = [];

    tables.forEach((table) => {
      let date = '';
      const raw = [];
      table.querySelectorAll('.progress-bar').forEach((bar) => {
        const text = bar.textContent.trim();
        if (/Dương lịch \d{2}\/\d{2}\/\d{4}/.test(text)) {
          date = text.replace('Dương lịch ', '');
        } else if (/^\d{1,2}h$/.test(text) || /^\d+\.\d+m$/.test(text)) {
          raw.push(text);
        }
      });

      const labels = [];
      const data = [];
      for (let i = 0; i < raw.length - 1; i += 2) {
        labels.push(raw[i]);
        data.push(parseFloat(raw[i + 1]));
      }
      if (date && labels.length) {
        result.push({ date, labels, data });
      }
    });
    return result;
  }

  /** Cập nhật badge + icon (gọi sau khi lưu cấu hình) */
  function updateBadge() {
    fetch(TIDE_URL, {
      method: 'GET',
      headers: { Accept: 'text/html', 'Content-Type': 'text/html; charset=UTF-8' }
    })
      .then((r) => r.text())
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
            const today = new Date().toLocaleDateString('vi-VN', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            });

            const tables = parseTideTables(html).slice(0, 3);
            const redDays = [];
            let currentHourLevel = null;

            tables.forEach((t, idx) => {
              t.labels.forEach((label, i) => {
                const hour = parseInt(label.replace('h', ''), 10);
                const level = t.data[i];
                if (selectedHours.includes(hour) && level >= threshold) {
                  if (!redDays.includes(idx + 1)) redDays.push(idx + 1);
                }
                if (idx === 0 && t.date === today && hour === currentHour) {
                  currentHourLevel = level;
                }
              });
            });

            if (redDays.length) {
              chrome.action.setBadgeText({ text: redDays.join('') });
              chrome.action.setBadgeBackgroundColor({ color: '#EA4335' });
              chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
            } else {
              chrome.action.setBadgeText({ text: '' });
            }

            let icon = 'icon64.png';
            if (currentHourLevel !== null) {
              if (currentHourLevel >= threshold) icon = 'icon64_red.png';
              else if (currentHourLevel >= threshold2) icon = 'icon64_yellow.png';
            }
            chrome.action.setIcon({ path: icon });
          }
        );
      })
      .catch((e) => console.error('updateBadge:', e.message));
  }

  /** Vẽ biểu đồ cho một ngày */
  function renderChart(container, { date, labels, data }, index, threshold, threshold2, selectedHours) {
    const [day, month, year] = date.split('/');
    const dateObj = new Date(`${year}-${month}-${day}`);
    const weekday = dateObj.toLocaleDateString('vi-VN', { weekday: 'long' });

    const dateDiv = document.createElement('div');
    dateDiv.className = 'date';
    dateDiv.innerHTML = `<span class="date-value">${weekday}, ${date}:</span>`;
    container.appendChild(dateDiv);

    const currentHour = new Date().getHours();
    const barColors = data.map((level, idx) => {
      const hour = parseInt(labels[idx].replace('h', ''), 10);
      // Ưu tiên đỏ (threshold) > vàng (threshold2) > xanh
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

    // Annotation: đường ngưỡng + vùng giờ đã chọn
    const annotations = {
      thresholdLine: {
        type: 'line',
        yMin: threshold,
        yMax: threshold,
        borderColor: '#d32f2f',
        borderWidth: 2,
        borderDash: [5, 5],
        label: {
          display: true,
          content: `Đỏ: ${threshold}m`,
          position: 'end',
          backgroundColor: 'rgba(211,47,47,0.85)',
          color: '#fff',
          padding: 3,
          font: { size: 10 }
        }
      },
      threshold2Line: {
        type: 'line',
        yMin: threshold2,
        yMax: threshold2,
        borderColor: '#ff8f00',
        borderWidth: 2,
        borderDash: [5, 5],
        label: {
          display: true,
          content: `Vàng: ${threshold2}m`,
          position: 'end',
          backgroundColor: 'rgba(255,143,0,0.85)',
          color: '#fff',
          padding: 3,
          font: { size: 10 }
        }
      }
    };

    // Highlight các dải giờ đã chọn
    if (selectedHours.length) {
      const sorted = [...selectedHours].sort((a, b) => a - b);
      let start = sorted[0];
      let prev = sorted[0];
      const ranges = [];
      for (let i = 1; i <= sorted.length; i++) {
        const cur = sorted[i];
        if (i === sorted.length || cur !== prev + 1) {
          ranges.push({ start, end: prev });
          start = cur;
        }
        prev = cur;
      }
      const yMax = Math.max(...data, threshold, threshold2) * 1.15;
      ranges.forEach((r, i) => {
        annotations[`range${i}`] = {
          type: 'box',
          xMin: `${r.start}h`,
          xMax: `${r.end}h`,
          yMin: 0,
          yMax,
          backgroundColor: 'rgba(2,136,209,0.28)',
          borderWidth: 0
        };
      });
    }

    new Chart(canvas.getContext('2d'), {
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
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Mực nước (m)', font: { size: 11 } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => `${ctx.parsed.y} m` }
          },
          annotation: { annotations }
        }
      }
    });
  }

  function loadTideData(threshold, threshold2, selectedHours) {
    statusEl.textContent = 'Đang tải dữ liệu...';
    tideInfo.innerHTML = '';

    fetch(TIDE_URL, {
      method: 'GET',
      headers: { Accept: 'text/html', 'Content-Type': 'text/html; charset=UTF-8' }
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((html) => {
        const tables = parseTideTables(html);
        if (!tables.length) {
          statusEl.textContent = 'Không tìm thấy bảng dữ liệu.';
          return;
        }
        statusEl.textContent = '';
        tables.forEach((t, idx) => {
          renderChart(tideInfo, t, idx, threshold, threshold2, selectedHours);
        });
        updateBadge();
      })
      .catch((err) => {
        statusEl.textContent = `Lỗi: ${err.message}`;
      });
  }

  // ---- Load cấu hình & gắn sự kiện ----
  chrome.storage.local.get(
    ['tideThreshold', 'tideThreshold2', 'selectedHours'],
    (result) => {
      let threshold = parseFloat(result.tideThreshold ?? DEFAULT_THRESHOLD);
      let threshold2 = parseFloat(result.tideThreshold2 ?? DEFAULT_THRESHOLD2);
      let selectedHours =
        Array.isArray(result.selectedHours) && result.selectedHours.length
          ? result.selectedHours
          : [...DEFAULT_HOURS];

      let originalThreshold = threshold;
      let originalThreshold2 = threshold2;
      let originalSelectedHours = [...selectedHours];

      thresholdInput.value = threshold;
      thresholdValue.textContent = String(threshold).replace('.', ',');
      threshold2Input.value = threshold2;
      threshold2Value.textContent = String(threshold2).replace('.', ',');
      hoursCheckboxes.forEach((cb) => {
        cb.checked = selectedHours.includes(parseInt(cb.value, 10));
      });
      hoursSummary.textContent = formatHoursSummary(selectedHours);

      editBtn.addEventListener('click', () => {
        thresholdInput.disabled = false;
        thresholdInput.style.display = 'inline';
        thresholdSummary.style.display = 'none';
        threshold2Input.disabled = false;
        threshold2Input.style.display = 'inline';
        threshold2Summary.style.display = 'none';
        hoursCheckboxes.forEach((cb) => (cb.disabled = false));
        hoursContainer.style.display = 'flex';
        hoursSummary.style.display = 'none';
        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline';
        cancelBtn.style.display = 'inline';
        thresholdInput.focus();
      });

      saveBtn.addEventListener('click', () => {
        const newT = parseFloat(thresholdInput.value);
        const newT2 = parseFloat(threshold2Input.value);
        if (isNaN(newT) || newT < 0 || isNaN(newT2) || newT2 < 0) {
          alert('Vui lòng nhập số hợp lệ ≥ 0 cho cả hai ngưỡng.');
          return;
        }
        threshold = newT;
        threshold2 = newT2;
        selectedHours = hoursCheckboxes
          .filter((cb) => cb.checked)
          .map((cb) => parseInt(cb.value, 10));

        chrome.storage.local.set({
          tideThreshold: threshold,
          tideThreshold2: threshold2,
          selectedHours
        });

        originalThreshold = threshold;
        originalThreshold2 = threshold2;
        originalSelectedHours = [...selectedHours];

        thresholdValue.textContent = String(threshold).replace('.', ',');
        threshold2Value.textContent = String(threshold2).replace('.', ',');
        hoursSummary.textContent = formatHoursSummary(selectedHours);

        // Khóa lại UI
        thresholdInput.disabled = true;
        thresholdInput.style.display = 'none';
        thresholdSummary.style.display = 'inline';
        threshold2Input.disabled = true;
        threshold2Input.style.display = 'none';
        threshold2Summary.style.display = 'inline';
        hoursCheckboxes.forEach((cb) => (cb.disabled = true));
        hoursContainer.style.display = 'none';
        hoursSummary.style.display = 'inline';
        editBtn.style.display = 'inline';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';

        loadTideData(threshold, threshold2, selectedHours);
      });

      cancelBtn.addEventListener('click', () => {
        thresholdInput.value = originalThreshold;
        threshold2Input.value = originalThreshold2;
        hoursCheckboxes.forEach((cb) => {
          cb.checked = originalSelectedHours.includes(parseInt(cb.value, 10));
          cb.disabled = true;
        });
        thresholdInput.disabled = true;
        thresholdInput.style.display = 'none';
        thresholdSummary.style.display = 'inline';
        threshold2Input.disabled = true;
        threshold2Input.style.display = 'none';
        threshold2Summary.style.display = 'inline';
        hoursContainer.style.display = 'none';
        hoursSummary.style.display = 'inline';
        hoursSummary.textContent = formatHoursSummary(originalSelectedHours);
        editBtn.style.display = 'inline';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
      });

      loadTideData(threshold, threshold2, selectedHours);
    }
  );
});
