chrome.alarms.create("checkTide", { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "checkTide") updateBadge();
});

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
      const threshold2 = parseFloat(localStorage.getItem('tideThreshold2') || 2.0);
      const selectedHours = JSON.parse(localStorage.getItem('selectedHours') || JSON.stringify([...Array(24).keys()]));
      const currentHour = new Date().getHours();
      const today = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');

      let redDays = [];
      let currentHourLevel = null;

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
          if (idx === 0 && date === today && hour === currentHour) {
            currentHourLevel = level;
          }
        }
      });

      // Logic badge mới
      if (redDays.length > 0) {
        const badgeText = redDays.join('');
        chrome.action.setBadgeText({ text: badgeText });
        chrome.action.setBadgeBackgroundColor({ color: '#FF0000' }); // Nền đỏ
        chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
      } else {
        chrome.action.setBadgeText({ text: '' }); // Không hiển thị badge
      }

      // Cập nhật icon dựa trên giờ hiện tại trong biểu đồ đầu tiên
      if (currentHourLevel !== null) {
        if (currentHourLevel >= threshold) {
          chrome.action.setIcon({ path: 'icon64_red.png' });
        } else if (currentHourLevel >= threshold2) {
          chrome.action.setIcon({ path: 'icon64_yellow.png' });
        } else {
          chrome.action.setIcon({ path: 'icon64.png' });
        }
      } else {
        chrome.action.setIcon({ path: 'icon64.png' });
      }
    });
}