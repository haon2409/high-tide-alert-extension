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