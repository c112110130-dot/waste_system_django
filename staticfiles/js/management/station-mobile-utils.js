
const StationMobile = (function () {
  const SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
  const CHARACTERISTIC_UUID = 'abcdef12-3456-7890-abcd-ef1234567890';

  let cfg = { locations: [] };
  let html5QrcodeScanner = null;
  let isScanning = false;

  // API URLs
  let recordApiUrl = '';

  // Bluetooth variables
  let bluetoothDevice = null;
  let weightCharacteristic = null;
  let isBluetoothConnected = false;

  // DOM elements
  let btnConnect = null;
  let btText = null;
  let btnScan = null;
  let btnRecord = null;
  let btnSubmit = null;
  let btnResetFactor = null;
  let btnZero = null;
  let btnUnit = null;
  let btnResetName = null;
  let currentUnit = null;
  let calibrationFactorInput = null;
  let btnResetFactorText = null;
  let statusDisplay = null;
  let inputUnit = null;
  let inputWasteType = null;
  let inputCleaner = null;
  let inputTime = null;
  let inputWeight = null;
  let scaleNameInput = null;
  let toastContainer = null;

  function init(options) {
    cfg = Object.assign(cfg, options || {});
    // Set API URLs from config
    if (cfg.api && cfg.api.recordUrl) {
      recordApiUrl = cfg.api.recordUrl;
    }
    initializeDOMElements();
    renderLocations(cfg.locations);
  }

  // Initialize DOM elements
  function initializeDOMElements() {
    // Get DOM elements
    inputUnit = document.getElementById('disp_dept');
    inputWasteType = document.getElementById('disp_waste_type');
    inputCleaner = document.getElementById('disp_cleaner');
    inputTime = document.getElementById('disp_time');
    inputWeight = document.getElementById('weight_input');
    btnScan = document.getElementById('btn-scan-qr');
    btnRecord = document.getElementById('btn-record-weight');
    btnSubmit = document.getElementById('btn-submit-record');
    btnConnect = document.getElementById('btn-bt-connect');
    btText = document.getElementById('bt-text');
    btnResetFactorText = document.getElementById('btn-reset-factor-text');
    btnZero = document.getElementById('btn-zero');
    btnUnit = document.getElementById('btn-unit');
    scaleNameInput = document.getElementById('scale-name-input');
    currentUnit = document.getElementById('current-unit');
    statusDisplay = document.getElementById('bt-status');
    toastContainer = document.getElementById('toast-container');
    btnResetFactor = document.getElementById('btn-reset-factor');
    calibrationFactorInput = document.getElementById('calibration-factor-input');
    btnResetName = document.getElementById('btn-reset-name');
    // Setup event listeners
    setupEventListeners();
  }

  // Setup event listeners (from app.js)
  function setupEventListeners() {
    // Scan QR button
    if (btnScan) {
      btnScan.addEventListener('click', function () {
        if (isScanning) {
          stopScanner();
        } else {
          startScanner();
        }
      });
    }

    // Record weight button
    if (btnRecord) {
      btnRecord.addEventListener('click', async function () {
        if (!isBluetoothConnected || !bluetoothDevice || !bluetoothDevice.gatt.connected) {
          displayMessage('請先連接藍芽裝置', 'warning');
          return;
        }

        if (!weightCharacteristic) {
          displayMessage('無法找到重量特徵值', 'danger');
          return;
        }

        btnRecord.disabled = true;
        btnRecord.textContent = '讀取中...';

        try {
          // Start notifications
          await weightCharacteristic.startNotifications();
          weightCharacteristic.addEventListener('characteristicvaluechanged', handleWeightNotification);

          // Send read command
          sendCommandToESP32('R');
          displayMessage('⏳ 等待重量數據...', 'info');

        } catch (error) {
          console.error('啟用通知失敗:', error);
          displayMessage('❌ 無法啟用通知', 'danger');
          btnRecord.disabled = false;
          btnRecord.textContent = '記錄重量';
        }
      });
    }

    // Bluetooth connect button
    if (btnConnect) {
      btnConnect.addEventListener('click', function () {
        if (!isBluetoothConnected) {
          connectToBluetoothDevice();
        } else {
          disconnectBluetooth();
        }
      });
    }

    // Reset calibration button
    if (btnResetFactor) {
      btnResetFactor.addEventListener('click', function () {
        if (isBluetoothConnected && bluetoothDevice && bluetoothDevice.gatt.connected) {
          if (!calibrationFactorInput || !calibrationFactorInput.value.trim()) {
            displayMessage('請輸入校正參數', 'warning');
            return;
          }
          const value = calibrationFactorInput.value.trim();
          sendCommandToESP32('C'+value);
          displayMessage('開始校正...', 'info');
        } else {
          displayMessage('請先連接藍芽裝置', 'warning');
        }
      });
    }

    // Submit record button
    if (btnSubmit) {
      btnSubmit.addEventListener('click', submitRecord);
    }

    if(btnZero) {
      btnZero.addEventListener('click', function() {
        if (isBluetoothConnected && bluetoothDevice && bluetoothDevice.gatt.connected) {
          sendCommandToESP32('T');
          displayMessage('正在歸零...', 'info', 600);
        } else {
          displayMessage('請先連接藍芽裝置', 'warning');
        }
      });
    }

    if(btnUnit) {
      btnUnit.addEventListener('click', function() {
        { 
          if(currentUnit.innerText === 'G') {
            inputWeight.value = inputWeight.value === '' ? '' : (inputWeight.value / 1000).toFixed(3);
          }
          else {
            inputWeight.value = inputWeight.value === '' ? '' : (inputWeight.value * 1000).toFixed(0);
          }
          currentUnit.innerText = currentUnit.innerText === 'G' ? 'KG' : 'G';
        }
      });
    }
    
    if(btnResetName) {
      btnResetName.addEventListener('click', function() {
        if (isBluetoothConnected && bluetoothDevice && bluetoothDevice.gatt.connected) {
          if (!scaleNameInput || !scaleNameInput.value.trim()) {
            displayMessage('請輸入磅秤名稱', 'warning');
            return;
          }
          const value = scaleNameInput.value.trim();
          sendCommandToESP32('N'+value);
          displayMessage('正在設定磅秤名稱...', 'info', 600);
        } else {
          displayMessage('請先連接藍芽裝置', 'warning');
        }
      });
    }
  }

  function renderLocations(locations) {
    const sel = document.getElementById('select_loc_id');
    if (!sel) return;
    // clear except the placeholder option
    sel.innerHTML = '<option value="">-- 請選擇定點 --</option>';
    locations.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = String(loc.id);
      opt.textContent = loc.name || loc.loc || (`Loc ${loc.id}`);
      sel.appendChild(opt);
    });

    // bind change to update display and readiness
    sel.addEventListener('change', function () {
      const idx = sel.selectedIndex;
      const txt = sel.options[idx] ? sel.options[idx].text : '---';
      const dispLoc = document.getElementById('disp_loc');
      if (dispLoc) dispLoc.innerText = txt;
      checkSubmitReady();
    });
  }

  function startScanner() {
    const placeholder = document.getElementById('cam-placeholder');
    const reader = document.getElementById('reader');
    const stopBtn = document.getElementById('btn-stop-cam');

    if (placeholder) placeholder.style.display = 'none';
    if (reader) reader.style.display = 'block';
    if (stopBtn) stopBtn.style.display = 'block';

    html5QrcodeScanner = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess)
      .catch(err => {
        alert('無法啟動鏡頭 (請允許瀏覽器存取相機)');
        stopScanner();
      });
    isScanning = true;
  }

  function stopScanner() {
    if (html5QrcodeScanner && isScanning) {
      html5QrcodeScanner.stop().then(() => {
        html5QrcodeScanner.clear();
        isScanning = false;
        const reader = document.getElementById('reader');
        const stopBtn = document.getElementById('btn-stop-cam');
        const placeholder = document.getElementById('cam-placeholder');
        if (reader) reader.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
      }).catch(err => console.log('Stop failed', err));
    }
  }
  // Parse QR code: supports standard JSON
  // Examples: 
  //   Standard: {"dept":"病理檢驗部","waste_type":"病理廢棄物"}
  //   dept:病理檢驗部,type:病理,clea:junlong,time:20260312
  function onScanSuccess(decodedText) {
    stopScanner();

    let qrData = {};
    const cleanText = decodedText.trim();

    // 1. 先嘗試標準 JSON 解析
    try {
      qrData = JSON.parse(cleanText);
    } catch (e) {
      // 2. 如果失敗，判斷是否為「key:value,key:value」格式
      // 移除可能存在的左右大括號，然後依據逗號切割
      const pairs = cleanText.replace(/[{}]/g, '').split(',');

      pairs.forEach(pair => {
        // 尋找第一個冒號的位置來拆分 key 和 value
        const colonIndex = pair.indexOf(':');
        if (colonIndex !== -1) {
          const key = pair.substring(0, colonIndex).trim();
          const value = pair.substring(colonIndex + 1).trim();

          // 映射常見的欄位名稱
          if (key === 'dept') qrData.dept = value;
          if (key === 'type') qrData.type = value;
          if (key === 'clea') qrData.cleaner = value;
          if (key === 'time') qrData.time = value;
        }
      });
    }

    // Map QR code fields to expected field names
    const dept = qrData.dept || '---';
    const wasteType = qrData.type || '---';
    const cleaner = qrData.cleaner || '---';
    const time = qrData.time || '---';

    if (inputUnit) inputUnit.innerText = dept;
    if (inputWasteType) inputWasteType.innerText = wasteType;
    if (inputCleaner) inputCleaner.innerText = cleaner;
    if (inputTime) inputTime.innerText = time;

    const badge = document.getElementById('scan-status-badge');
    if (badge) {
      badge.className = 'ts-badge is-positive';
      badge.innerHTML = '<span class="ts-icon is-check-icon" style="background: rgba(101, 212, 127, 0.9); border-radius: 50%; padding: 2px;"></span> 掃描成功';
      displayMessage('✅ QR code 掃描成功', 'success');
    }

    checkSubmitReady();
  }

  function displayMessage(msg, type = 'warning', duration = 1500) {
    // Map type to Tocas message state and color
    let bgColor = '';
    let textColor = '';

    switch (type) {
      case 'success':
        bgColor = 'rgba(101, 212, 127, 0.9)'; // Tocas green
        textColor = '#fff';
        break;
      case 'danger':
      case 'error':
        bgColor = 'rgba(255, 79, 82, 0.9)'; // Tocas red
        textColor = '#fff';
        break;
      case 'info':
        bgColor = 'rgba(64, 169, 255, 0.9)'; // Tocas blue
        textColor = '#fff';
        break;
      case 'warning':
      default:
        bgColor = 'rgba(255, 184, 46, 0.9)'; // Tocas yellow
        textColor = '#000';
        break;
    }

    const messageHtml = `
      <div style="background: ${bgColor}; color: ${textColor}; position: fixed; top: 20px; right: 20px; z-index: 99999; min-width: 250px; max-width: 400px; animation: slideIn 0.3s ease-out; padding: 12px 16px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: space-between; gap: 10px;">
        <div style="flex: 1;">
          <div style="font-weight: 500; line-height: 1.4;">${msg}</div>
        </div>
        <button onclick="this.closest('div').remove()" style="flex-shrink: 0; color: inherit; opacity: 0.7; padding: 2px; background: none; border: none; cursor: pointer; font-size: 18px; line-height: 1;">×</button>
      </div>
    `;

    if (toastContainer) {
      toastContainer.insertAdjacentHTML('beforeend', messageHtml);
      const messageEl = toastContainer.lastElementChild;

      // Auto-remove after duration
      setTimeout(() => {
        if (messageEl && messageEl.parentNode) {
          messageEl.style.animation = 'slideOut 0.3s ease-out';
          setTimeout(() => {
            if (messageEl && messageEl.parentNode) {
              messageEl.remove();
            }
          }, 300);
        }
      }, duration);
    }
  }

  // Handle weight notification (from app.js)
  function handleWeightNotification(event) {
    const value = event.target.value;
    let receivedString = new TextDecoder().decode(value.buffer).trim();

    console.log("BLE 接收數據:", receivedString);

    // Calibration logic
    if (receivedString === "CALI_START") {
      console.log("ESP32: 開始迭代校正邏輯");
      if (btnResetFactor) {
        btnResetFactor.disabled = true;
        btnResetFactorText.innerText = "校正中...";
      }
      return;
    }

    if (receivedString.startsWith("DONE:")) {
      const finalFactor = receivedString.split(':')[1];

      displayMessage(`✅ 校正成功！新因子：${finalFactor}`, "success", 4000);

      setTimeout(() => {
        if (btnResetFactor) {
          btnResetFactor.disabled = false;
          btnResetFactorText.innerText = "校正完成";
        }
      }, 2000);
      return;
    }

    // General commands
    if (receivedString === "TARE_OK") {
      displayMessage("✅ 秤盤已歸零", "success", 1500);
      return;
    }

    if (receivedString === "NAME_OK") {
      displayMessage("✅ 磅秤名稱設定成功", "success", 1500);
      return;
    }

    if (receivedString === "ERR") {
      displayMessage("❌ 感測器未就緒，請檢查接線", "danger", 3000);
      if (btnRecord) {
        btnRecord.innerText = "讀取失敗";
        btnRecord.disabled = false;
      }
      return;
    }

    const weightValue = parseFloat(receivedString);
    if (!isNaN(weightValue)) {
      if (inputWeight){ 
        if(currentUnit.innerText === 'G') {
        inputWeight.value = weightValue.toFixed(0);
        }
        else {
          inputWeight.value = (weightValue / 1000).toFixed(3);
        }
      }
      if (btnRecord) {
        btnRecord.textContent = '✅ 重量記錄';
        btnRecord.classList.replace('btn-secondary', 'btn-success');
        btnRecord.disabled = false;
      }
      displayMessage("✅ 重量已成功讀取。", "success", 1500);
    } else {
      console.warn("收到無法識別的格式:", receivedString);
    }
  }

  // Connect to Bluetooth device (direct connection without modal)
  async function connectToBluetoothDevice() {
    if (!navigator.bluetooth) {
      displayMessage('此瀏覽器不支援 Web Bluetooth API', 'danger');
      return;
    }

    if (btnConnect) {
      btnConnect.disabled = true;
      btText.textContent = '請求連線中...';
    }

    try {
      displayMessage('正在掃描藍芽裝置...', 'info');

      // Request device with specific service UUID
      bluetoothDevice = await navigator.bluetooth.requestDevice({
        optionalServices: [SERVICE_UUID],
        acceptAllDevices: true  // Allow any device for now
      });

      displayMessage('正在連接到裝置...', 'info');
      // Connect to GATT server
      const server = await bluetoothDevice.gatt.connect();

      // Get the service
      const service = await server.getPrimaryService(SERVICE_UUID);

      // Get the characteristic
      weightCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

      // Set up disconnect handler
      bluetoothDevice.addEventListener('gattserverdisconnected', () => {
        displayMessage('藍芽連線已中斷', 'danger');
        resetFormAndState(false);
      });

      isBluetoothConnected = true;

      if (statusDisplay) {
        statusDisplay.textContent = `磅秤名稱： ${bluetoothDevice.name || '裝置'}`;
        statusDisplay.classList.replace('text-danger', 'text-success');
      }
      if (btnConnect) {
        btText.textContent = '解除連線';
        btnConnect.disabled = false;
      }

      displayMessage('✅ 藍芽連線成功！', 'success');

    } catch (error) {
      console.error('藍芽連線失敗:', error);
      isBluetoothConnected = false;

      if (statusDisplay) {
        statusDisplay.textContent = '磅秤名稱：連線失敗';
      }
      if (btnConnect) {
        btText.textContent = '藍芽連線';
        btnConnect.disabled = false;
      }

      displayMessage('❌ 藍芽連線失敗，請檢查裝置和權限', 'danger');
    }
  }

  // Disconnect Bluetooth
  function disconnectBluetooth() {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
      bluetoothDevice.gatt.disconnect();
      isBluetoothConnected = false;
      bluetoothDevice = null;
      if (statusDisplay) {
        statusDisplay.textContent = '磅秤名稱：未連線';
        statusDisplay.classList.replace('text-success', 'text-danger');
      }
      if (btnConnect) {
        btText.textContent = '藍芽連線';
      }
      displayMessage('藍芽已斷開', 'info');
    }
  }

  // Reset form and state 
  function resetFormAndState(keepBluetooth = true) {
    if (inputUnit) inputUnit.innerText = '---';
    if (inputWasteType) inputWasteType.innerText = '---';
    if (inputCleaner) inputCleaner.innerText = '---';
    if (inputTime) inputTime.innerText = '---';
    const sel = document.getElementById('select_loc_id');
    if (sel) sel.selectedIndex = 0;

    if (btnScan) {
      btnScan.textContent = '掃描 QR code';
      btnScan.classList.remove('btn-success');
      btnScan.classList.add('btn-secondary');
      btnScan.disabled = false;
    }

    if (btnRecord) {
      btnRecord.textContent = '記錄重量';
      btnRecord.classList.remove('btn-success');
      btnRecord.classList.add('btn-secondary');
      btnRecord.disabled = false;
    }

    if (btnSubmit) {
      btnSubmit.textContent = '送出記錄';
      btnSubmit.disabled = false;
    }

    if (!keepBluetooth || !isBluetoothConnected) {
      if (bluetoothDevice && bluetoothDevice.gatt.connected) {
        bluetoothDevice.gatt.disconnect();
      }
      isBluetoothConnected = false;
      if (statusDisplay) {
        statusDisplay.textContent = '磅秤名稱：未連線';
        statusDisplay.classList.replace('text-success', 'text-danger');
        bluetoothDevice.name = null;
      }
      if (btnConnect) {
        btText.textContent = '藍芽連線';
      }
    } else {
      if (statusDisplay) {
        statusDisplay.textContent = `磅秤名稱： ${bluetoothDevice.name || '裝置'}`;
        statusDisplay.classList.replace('text-danger', 'text-success');

      }
      if (btnConnect) {
        btText.textContent = '藍芽已連線';
      }
    }
  }

  function checkSubmitReady() {
    const locIdEl = document.getElementById('select_loc_id');
    const weightEl = document.getElementById('weight_input');
    const deptEl = document.getElementById('disp_dept');
    const typeEl = document.getElementById('disp_waste_type');
    const btn = document.getElementById('btn-submit-record');
    const locId = locIdEl ? locIdEl.value : '';
    const weight = weightEl ? weightEl.value : '';
    const dept = deptEl ? deptEl.innerText : '---';
    const type = typeEl ? typeEl.innerText : '---';
  }

  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === (name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  function submitRecord() {
    const dept = inputUnit ? inputUnit.innerText.trim() : '';
    const wasteType = inputWasteType ? inputWasteType.innerText.trim() : '';
    const cleaner = inputCleaner ? inputCleaner.innerText.trim() : '';
    const time = inputTime ? inputTime.innerText.trim() : '';

    const weight = inputWeight ? parseFloat(inputWeight.value) : 0;
    const locSel = document.getElementById('select_loc_id');
    const locId = locSel ? locSel.value : '';

    if (!dept || dept === '---' || !wasteType || wasteType === '---' || !cleaner || cleaner === '---' || !time || time === '---' || weight <= 0 || !locId || locId === '-- 請選擇定點 --') {
      displayMessage('請確保所有欄位都已填寫正確', 'danger');
      return;
    }

    fetch(recordApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify({
        dept: dept,
        waste_type: wasteType,
        weight: weight,
        location_id: locId
      })
    })
      .then(response => response.json())
      .then(data => {
        if (data.success || data.status === 'success') {
          displayMessage('記錄成功！', 'success');
          setTimeout(() => {
            resetFormAndState(true); // keep bluetooth connection
          }, 500);
        } else {
          displayMessage('記錄失敗: ' + (data.error || data.message || '未知錯誤'), 'danger');
        }
      })
      .catch(error => {
        console.error('Submit error:', error);
        displayMessage('網路錯誤，請重試', 'danger');
      });
  }

  function sendCommandToESP32(command) {
    if (!isBluetoothConnected || !bluetoothDevice || !bluetoothDevice.gatt.connected) {
      displayMessage('藍芽未連線', 'danger');
      return;
    }

    if (!weightCharacteristic) {
      displayMessage('無法找到重量特徵值', 'danger');
      return;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(command);

    weightCharacteristic.writeValue(data)
      .then(() => {
        console.log('Command sent:', command);
      })
      .catch(error => {
        console.error('Send command error:', error);
        displayMessage('發送命令失敗', 'danger');
      });
  }

  // Backward compatibility - alias for submitRecord
  function submitData() {
    submitRecord();
  }

  return {
    init: init,
    renderLocations: renderLocations,
    startScanner: startScanner,
    stopScanner: stopScanner,
    onScanSuccess: onScanSuccess,
    displayMessage: displayMessage,
    handleWeightNotification: handleWeightNotification,
    resetFormAndState: resetFormAndState,
    checkSubmitReady: checkSubmitReady,
    submitRecord: submitRecord,
    connectToBluetoothDevice: connectToBluetoothDevice,
    sendCommandToESP32: sendCommandToESP32,
    disconnectBluetooth: disconnectBluetooth,
    submitData: submitData
  };
})();

window.StationMobile = StationMobile;

// Expose functions to global scope for onclick handlers in HTML
window.startScanner = function () { StationMobile.startScanner(); };
window.stopScanner = function () { StationMobile.stopScanner(); };
window.submitRecord = function () { StationMobile.submitRecord(); };
window.checkSubmitReady = function () { StationMobile.checkSubmitReady(); };
window.sendCommandToESP32 = function (command) { StationMobile.sendCommandToESP32(command); };
window.disconnectBluetooth = function () { StationMobile.disconnectBluetooth(); };
window.resetFormAndState = function (keepBluetooth) { StationMobile.resetFormAndState(keepBluetooth); };
window.submitData = function () { StationMobile.submitData(); };
window.connectToBluetoothDevice = function () { StationMobile.connectToBluetoothDevice(); };