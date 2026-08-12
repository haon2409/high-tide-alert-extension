/**
 * High Tide Alert - Popup
 * Hiển thị biểu đồ mực nước + cấu hình ngưỡng
 */

const DEFAULT_THRESHOLD = 1.5;
const DEFAULT_THRESHOLD2 = 2.0;
const DEFAULT_COLUMNS = 12;

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
  const columnsInput = document.getElementById('columns-input');
  const columnsSummary = document.getElementById('columns-summary');
  const columnsValue = document.getElementById('columns-value');

  let chartInstances = []; // Quản lý bộ nhớ các instance biểu đồ

  if (typeof Chart === 'undefined') {
    tideInfo.textContent = 'Lỗi: Không thể tải Chart.js.';
    return;
  }

  if (typeof Chart !== 'undefined' && window['chartjs-plugin-annotation']) {
    Chart.register(window['chartjs-plugin-annotation']);
  } else if (typeof ChartAnnotation !== 'undefined') {
    Chart.register(ChartAnnotation);
  }

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
    dateDiv.innerHTML = `<span class="date-value">${weekday}, ${date}:</span>`;
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
        borderColor: '#d32f2f', borderWidth: 2, borderDash: [5, 5],
        label: {
          display: true, content: `Đỏ: ${threshold}m`, position: 'end',
          backgroundColor: 'rgba(211,47,47,0.85)', color: '#fff', padding: 3, font: { size: 10 }
        }
      },
      threshold2Line: {
        type: 'line', yMin: threshold2, yMax: threshold2,
        borderColor: '#ff8f00', borderWidth: 2, borderDash: [5, 5],
        label: {
          display: true, content: `Vàng: ${threshold2}m`, position: 'end',
          backgroundColor: 'rgba(255,143,0,0.85)', color: '#fff', padding: 3, font: { size: 10 }
        }
      }
    };

    const newChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Mực nước (m)', data, backgroundColor: barColors, borderColor: barColors, borderWidth: 1 }]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
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

    // Lưu instance để dọn dẹp sau
    chartInstances.push(newChart);
  }

  function loadTideData(threshold, threshold2) {
    statusEl.textContent = 'Đang đọc dữ liệu...';
    
    // Hủy các biểu đồ cũ trước khi render lại để tránh lỗi đè (flickering)
    chartInstances.forEach(chart => chart.destroy());
    chartInstances = [];
    tideInfo.innerHTML = '';

    // Lấy dữ liệu đã được parse sẵn từ background
    chrome.storage.local.get(['tideData'], (result) => {
      const tables = result.tideData;
      if (!tables || !tables.length) {
        statusEl.textContent = 'Đang đồng bộ dữ liệu. Vui lòng mở lại sau ít phút.';
        return;
      }
      statusEl.textContent = '';
      tables.forEach((t, idx) => {
        renderChart(tideInfo, t, idx, threshold, threshold2);
      });
    });
  }

  chrome.storage.local.get(['tideThreshold', 'tideThreshold2'], (result) => {
    let threshold = parseFloat(result.tideThreshold ?? DEFAULT_THRESHOLD);
    let threshold2 = parseFloat(result.tideThreshold2 ?? DEFAULT_THRESHOLD2);
    let columns = parseInt(result.iconColumns ?? DEFAULT_COLUMNS, 10); // Thêm biến columns

    let originalThreshold = threshold;
    let originalThreshold2 = threshold2;
    let originalColumns = columns; // Lưu giá trị gốc

    thresholdInput.value = threshold;
    thresholdValue.textContent = String(threshold).replace('.', ',');
    threshold2Input.value = threshold2;
    threshold2Value.textContent = String(threshold2).replace('.', ',');
    columnsInput.value = columns;
    columnsValue.textContent = columns;

    editBtn.addEventListener('click', () => {
      thresholdInput.disabled = false;
      thresholdInput.style.display = 'inline';
      thresholdSummary.style.display = 'none';
      threshold2Input.disabled = false;
      threshold2Input.style.display = 'inline';
      threshold2Summary.style.display = 'none';
      columnsInput.disabled = false;
      columnsInput.style.display = 'inline';
      columnsSummary.style.display = 'none';

      editBtn.style.display = 'none';
      saveBtn.style.display = 'inline';
      cancelBtn.style.display = 'inline';
      thresholdInput.focus();
    });

    saveBtn.addEventListener('click', () => {
      const newT = parseFloat(thresholdInput.value);
      const newT2 = parseFloat(threshold2Input.value);
      const newCols = parseInt(columnsInput.value, 10); // Lấy giá trị cột
      if (isNaN(newT) || newT < 0 || isNaN(newT2) || newT2 < 0 || isNaN(newCols) || newCols < 1 || newCols > 32) {
        alert('Vui lòng nhập thông số hợp lệ (Ngưỡng ≥ 0, Số cột 1-32).');
        return;
      }
      threshold = newT;
      threshold2 = newT2;
      columns = newCols;

      // Lưu thêm iconColumns
      chrome.storage.local.set({ tideThreshold: threshold, tideThreshold2: threshold2, iconColumns: columns });
    
      originalThreshold = threshold;
      originalThreshold2 = threshold2;
      originalColumns = columns;

      thresholdValue.textContent = String(threshold).replace('.', ',');
      threshold2Value.textContent = String(threshold2).replace('.', ',');
      columnsValue.textContent = columns;

      thresholdInput.disabled = true;
      thresholdInput.style.display = 'none';
      thresholdSummary.style.display = 'inline';
      threshold2Input.disabled = true;
      threshold2Input.style.display = 'none';
      threshold2Summary.style.display = 'inline';
      columnsInput.disabled = true;
      columnsInput.style.display = 'none';
      columnsSummary.style.display = 'inline';
      editBtn.style.display = 'inline';
      saveBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
    
      loadTideData(threshold, threshold2);
    });

    cancelBtn.addEventListener('click', () => {
      thresholdInput.value = originalThreshold;
      threshold2Input.value = originalThreshold2;
      columnsInput.value = originalColumns;

      thresholdInput.disabled = true;
      thresholdInput.style.display = 'none';
      thresholdSummary.style.display = 'inline';
      threshold2Input.disabled = true;
      threshold2Input.style.display = 'none';
      threshold2Summary.style.display = 'inline';
      columnsInput.disabled = true;
      columnsInput.style.display = 'none';
      columnsSummary.style.display = 'inline';
      editBtn.style.display = 'inline';
      saveBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
    });

    loadTideData(threshold, threshold2);
  });
});