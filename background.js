chrome.runtime.onInstalled.addListener(() => {
    // Tạo alarm chạy mỗi 5 phút
    chrome.alarms.create('updateBadgeAlarm', { periodInMinutes: 5 });

    // Gọi lần đầu ngay khi cài
    updateBadge();
});

// Lắng nghe alarm để chạy lại
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'updateBadgeAlarm') {
        updateBadge();
    }
});

function updateBadge() {
    fetch('https://thegioimoicau.com/dia-danh/sai-gon/trang-1', {
      method: 'GET',
      headers: {'Accept': 'text/html', 'Content-Type': 'text/html; charset=UTF-8'}
    })
      .then(response => response.text())
      .then(html => {
        // Thay thế localStorage bằng chrome.storage.local
        chrome.storage.local.get(['tideThreshold', 'tideThreshold2', 'selectedHours'], (result) => {          
          const threshold = parseFloat(result.tideThreshold || 1.5);          
          const threshold2 = parseFloat(result.tideThreshold2 || 2.0);                    
          const selectedHours = result.selectedHours || [];                    
          const currentHour = new Date().getHours();          
          const today = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');

          let redDays = [];
          let currentHourLevel = null;

          // Regex logic remains the same
          const regex = /<table class="table table-striped">[\s\S]*?<\/table>/g;
          const tables = html.match(regex).slice(0, 3);  // Chỉ lấy 3 table đầu tiên

          tables.forEach((table, idx) => {            
            const tideData = [];
            let date = '';
            const progressBars = table.match(/<div class="progress-bar[^>]*>([^<]+)<\/div>/g);  // Match all progress bars
            progressBars.forEach(bar => {
              const text = bar.replace(/<\/?[^>]+(>|$)/g, "").trim();  // Strip HTML tags
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

          // Update badge          
          if (redDays.length > 0) {
            const badgeText = redDays.join('');
            chrome.action.setBadgeText({ text: badgeText });
            chrome.action.setBadgeBackgroundColor({ color: '#EA4335' });
            chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
          } else {
            chrome.action.setBadgeText({ text: '' });
          }

          // Update icon based on currentHourLevel          
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
      });
  }

