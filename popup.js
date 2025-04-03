document.addEventListener('DOMContentLoaded', function() {
  const tideInfo = document.getElementById('tide-info');
  tideInfo.textContent = 'Đang tải dữ liệu...';

  fetch('https://thegioimoicau.com/dia-danh/sai-gon/trang-1', {
    method: 'GET',
    headers: {
      'Accept': 'text/html',
      'Content-Type': 'text/html; charset=UTF-8'
    }
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then(html => {
      console.log('HTML cào được:', html);

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const tables = doc.querySelectorAll('table.table-striped');

      console.log('Số table tìm thấy:', tables.length);

      if (tables.length === 0) {
        tideInfo.textContent = 'Không tìm thấy bảng dữ liệu nào trong HTML.';
        return;
      }

      tideInfo.textContent = '';

      let hasData = false;
      let chartData = {
        labels: [], // Thời gian (0h, 1h, ...)
        datasets: []
      };

      tables.forEach((table, index) => {
        console.log(`Table ${index}:`, table.outerHTML);
        const progressBars = table.querySelectorAll('.progress-bar');
        let date = '';
        const tideData = [];
        const tideLevels = []; // Mực nước để vẽ biểu đồ

        progressBars.forEach(bar => {
          const text = bar.textContent.trim();
          console.log('Progress bar text:', text);
          if (text.match(/Dương lịch \d{2}\/\d{2}\/\d{4}/)) {
            date = text;
          }
          if (text.match(/\d{1,2}h/) || text.match(/\d\.\d{1,2}m/)) {
            tideData.push(text);
          }
        });

        if (date && tideData.length > 0) {
          hasData = true;
          const dateDiv = document.createElement('div');
          dateDiv.className = 'date';
          dateDiv.textContent = date + ':';
          tideInfo.appendChild(dateDiv);

          // Chuẩn bị dữ liệu cho biểu đồ
          const labels = [];
          const data = [];
          for (let i = 0; i < tideData.length - 1; i += 2) {
            const time = tideData[i]; // Ví dụ: "0h"
            const level = parseFloat(tideData[i + 1]); // Ví dụ: "1.4m" -> 1.4
            labels.push(time);
            data.push(level);
          }

          // Chỉ vẽ biểu đồ cho ngày đầu tiên (có thể mở rộng nếu cần)
          if (index === 0) {
            chartData.labels = labels;
            chartData.datasets.push({
              label: 'Mực nước (m)',
              data: data,
              backgroundColor: 'rgba(54, 162, 235, 0.8)', // Màu xanh giống hình
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1
            });
          }
        }
      });

      if (!hasData) {
        tideInfo.textContent = 'Không tìm thấy dữ liệu thủy triều hợp lệ.';
      } else {
        // Vẽ biểu đồ
        const ctx = document.getElementById('tideChart').getContext('2d');
        new Chart(ctx, {
          type: 'bar',
          data: chartData,
          options: {
            indexAxis: 'y', // Thanh ngang
            scales: {
              x: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Mực nước (m)'
                }
              },
              y: {
                title: {
                  display: true,
                  text: 'Thời gian'
                }
              }
            },
            plugins: {
              legend: {
                display: false // Ẩn legend vì chỉ có 1 dataset
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    return `${context.parsed.x}m`;
                  }
                }
              }
            }
          }
        });
      }
    })
    .catch(error => {
      tideInfo.textContent = `Lỗi khi tải dữ liệu: ${error.message}`;
      console.error('Fetch error:', error);
    });
});