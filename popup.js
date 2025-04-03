document.addEventListener('DOMContentLoaded', function() {
  const tideInfo = document.getElementById('tide-info');
  const thresholdInput = document.getElementById('threshold-input');
  const thresholdSummary = document.getElementById('threshold-summary');
  const thresholdValue = document.getElementById('threshold-value');
  const editBtn = document.getElementById('edit-btn');
  const saveBtn = document.getElementById('save-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const hoursContainer = document.getElementById('hours-checkboxes');
  const hoursSummary = document.getElementById('hours-summary');

  if (typeof Chart === 'undefined') {
    tideInfo.textContent = 'Lỗi: Không thể tải Chart.js.';
    return;
  }

  function createDiagonalPattern(baseColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 16, 16);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(16, 0);
    ctx.stroke();
    return ctx.createPattern(canvas, 'repeat');
  }

  for (let i = 0; i < 24; i++) {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `hour-${i}`;
    checkbox.value = i;
    checkbox.disabled = true;
    label.appendChild(checkbox);
    label.append(`${i}h`);
    hoursContainer.appendChild(label);
  }
  const hoursCheckboxes = Array.from(document.querySelectorAll('#hours-checkboxes input[type="checkbox"]'));

  let threshold = localStorage.getItem('tideThreshold') ? parseFloat(localStorage.getItem('tideThreshold')) : 1.5;
  let originalThreshold = threshold;
  thresholdInput.value = threshold;
  thresholdValue.textContent = threshold.toString().replace('.', ',');
  let selectedHours = localStorage.getItem('selectedHours') ? JSON.parse(localStorage.getItem('selectedHours')) : Array.from({ length: 24 }, (_, i) => i);
  let originalSelectedHours = [...selectedHours];
  hoursCheckboxes.forEach(checkbox => checkbox.checked = selectedHours.includes(parseInt(checkbox.value)));

  function updateHoursSummary() {
    const ranges = [];
    let start = null;
    selectedHours.sort((a, b) => a - b);
    for (let i = 0; i <= selectedHours.length; i++) {
      if (i === selectedHours.length || (start !== null && selectedHours[i] !== selectedHours[i - 1] + 1)) {
        if (start !== null) {
          ranges.push(start === selectedHours[i - 1] ? `${start}h` : `${start}h→${selectedHours[i - 1]}h`);
        }
        start = i < selectedHours.length ? selectedHours[i] : null;
      } else if (start === null) {
        start = selectedHours[i];
      }
    }
    hoursSummary.textContent = ranges.join(', ') || 'Không có giờ nào';
  }
  updateHoursSummary();

  editBtn.addEventListener('click', () => {
    thresholdInput.disabled = false;
    thresholdInput.style.display = 'inline';
    thresholdSummary.style.display = 'none';
    hoursCheckboxes.forEach(checkbox => checkbox.disabled = false);
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline';
    cancelBtn.style.display = 'inline';
    hoursSummary.style.display = 'none';
    hoursContainer.style.display = 'block';
    thresholdInput.focus();
  });

  saveBtn.addEventListener('click', () => {
    const newThreshold = parseFloat(thresholdInput.value);
    if (!isNaN(newThreshold) && newThreshold >= 0) {
      threshold = newThreshold;
      localStorage.setItem('tideThreshold', threshold);
      thresholdInput.disabled = true;
      thresholdInput.style.display = 'none';
      thresholdSummary.style.display = 'inline';
      thresholdValue.textContent = threshold.toString().replace('.', ',');
      selectedHours = hoursCheckboxes.filter(checkbox => checkbox.checked).map(checkbox => parseInt(checkbox.value));
      localStorage.setItem('selectedHours', JSON.stringify(selectedHours));
      hoursCheckboxes.forEach(checkbox => checkbox.disabled = true);
      editBtn.style.display = 'inline';
      saveBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
      hoursSummary.style.display = 'inline';
      hoursContainer.style.display = 'none';
      updateHoursSummary();
      loadTideData();
      updateBadge();
    } else {
      alert('Vui lòng nhập số hợp lệ >= 0');
    }
  });

  cancelBtn.addEventListener('click', () => {
    thresholdInput.value = originalThreshold;
    thresholdInput.disabled = true;
    thresholdInput.style.display = 'none';
    thresholdSummary.style.display = 'inline';
    thresholdValue.textContent = originalThreshold.toString().replace('.', ',');
    hoursCheckboxes.forEach(checkbox => {
      checkbox.checked = originalSelectedHours.includes(parseInt(checkbox.value));
      checkbox.disabled = true;
    });
    editBtn.style.display = 'inline';
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    hoursSummary.style.display = 'inline';
    hoursContainer.style.display = 'none';
    updateHoursSummary();
  });

  function loadTideData() {
    tideInfo.textContent = 'Đang tải dữ liệu...';
    fetch('https://thegioimoicau.com/dia-danh/sai-gon/trang-1', {
      method: 'GET',
      headers: {'Accept': 'text/html', 'Content-Type': 'text/html; charset=UTF-8'}
    })
      .then(response => response.text())
      .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const tables = doc.querySelectorAll('table.table-striped');
        if (tables.length === 0) {
          tideInfo.textContent = 'Không tìm thấy bảng dữ liệu.';
          return;
        }
        tideInfo.textContent = '';
        tables.forEach((table, index) => {
          const progressBars = table.querySelectorAll('.progress-bar');
          let date = '', tideData = [];
          progressBars.forEach(bar => {
            const text = bar.textContent.trim();
            if (text.match(/Dương lịch \d{2}\/\d{2}\/\d{4}/)) date = text.replace('Dương lịch ', '');
            if (text.match(/\d{1,2}h/) || text.match(/\d\.\d{1,2}m/)) tideData.push(text);
          });
          if (date && tideData.length > 0) {
            const dateDiv = document.createElement('div');
            dateDiv.className = 'date';
            dateDiv.innerHTML = `<span class="date-value">${date}</span>:`;
            tideInfo.appendChild(dateDiv);

            const labels = [], data = [];
            for (let i = 0; i < tideData.length - 1; i += 2) {
              labels.push(tideData[i]);
              data.push(parseFloat(tideData[i + 1]));
            }

            const currentHour = new Date().getHours();
            const barColors = data.map((level, idx) => {
              const hour = parseInt(labels[idx].replace('h', ''));
              const baseColor = selectedHours.includes(hour) ? (level >= threshold ? 'rgba(255,0,0,1)' : 'rgba(255,215,0,1)') : 'rgba(54,162,235,1)';
              if (index === 0 && hour === currentHour) {
                return createDiagonalPattern(baseColor);
              }
              return baseColor;
            });

            const canvas = document.createElement('canvas');
            canvas.id = `tideChart-${index}`;
            canvas.className = 'tide-chart';
            tideInfo.appendChild(canvas);

            new Chart(canvas.getContext('2d'), {
              type: 'bar',
              data: { labels, datasets: [{ label: 'Mực nước (m)', data, backgroundColor: barColors, borderColor: barColors, borderWidth: 1 }] },
              options: {
                scales: { x: { title: { display: true, text: 'Thời gian' } }, y: { beginAtZero: true, title: { display: true, text: 'Mực nước (m)' } } },
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${context.parsed.y}m` } } }
              }
            });
          }
        });
        updateBadge();
      })
      .catch(error => tideInfo.textContent = `Lỗi: ${error.message}`);
  }

  function updateBadge() {
    fetch('https://thegioimoicau.com/dia-danh/sai-gon/trang-1', {
      method: 'GET',
      headers: {'Accept': 'text/html', 'Content-Type': 'text/html; charset=UTF-8'}
    })
      .then(response => response.text())
      .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const tables = Array.from(doc.querySelectorAll('table.table-striped')).slice(0, 3);
        const threshold = parseFloat(localStorage.getItem('tideThreshold') || 1.5);
        const selectedHours = JSON.parse(localStorage.getItem('selectedHours') || JSON.stringify([...Array(24).keys()]));
        const currentHour = new Date().getHours();
        const today = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');

        let redDays = [];
        let currentHourExceedsThreshold = false;

        tables.forEach((table, idx) => {
          const tideData = [];
          let date = '';
          table.querySelectorAll('.progress-bar').forEach(bar => {
            const text = bar.textContent.trim();
            if (text.match(/Dương lịch \d{2}\/\d{2}\/\d{4}/)) date = text.replace('Dương lịch ', '');
            if (text.match(/\d{1,2}h/) || text.match(/\d\.\d{1,2}m/)) tideData.push(text);
          });
          for (let i = 0; i < tideData.length - 1; i += 2) {
            const hour = parseInt(tideData[i].replace('h', ''));
            const level = parseFloat(tideData[i + 1]);
            if (selectedHours.includes(hour) && level >= threshold) {
              if (redDays.indexOf(idx + 1) === -1) redDays.push(idx + 1);
            }
            if (idx === 0 && date === today && hour === currentHour && level >= threshold) {
              currentHourExceedsThreshold = true;
            }
          }
        });

        const badgeText = redDays.length ? redDays.join('') : '';
        chrome.action.setBadgeText({ text: badgeText });
        if (currentHourExceedsThreshold || !badgeText) {
          chrome.action.setBadgeBackgroundColor({ color: '#000000' });
        } else {
          chrome.action.setBadgeBackgroundColor({ color: '#CC0000' });
        }
      });
  }

  loadTideData();
});