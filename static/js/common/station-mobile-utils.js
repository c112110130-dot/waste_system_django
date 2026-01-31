const StationMobile = (function(){
  const SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
  const CHARACTERISTIC_UUID = 'abcdef12-3456-7890-abcd-ef1234567890';

  let cfg = { locations: [] };
  let html5QrcodeScanner = null;
  let isScanning = false;
  let selectedDeviceName = null;

  // API URLs
  let locationsApiUrl = '';
  let recordApiUrl = '';

  // Bluetooth variables
  let bluetoothDevice = null;
  let weightCharacteristic = null;
  let isBluetoothConnected = false;


  // DOM elements
  let btnConnect = null;
  let btnScan = null;
  let btnRecord = null;
  let btnSubmit = null;
  let btnResetFactor = null;
  let statusDisplay = null;
  let inputUnit = null;
  let inputWasteType = null;
  let inputWeight = null;
  let caliProgressContainer = null;
  let caliProgressBar = null;
  let toastContainer = null;

  function init(options){
    cfg = Object.assign(cfg, options || {});
    // Set API URLs from config
    if (cfg.api && cfg.api.recordUrl) {
      recordApiUrl = cfg.api.recordUrl;
    }
    initializeDOMElements();
    renderLocations(cfg.locations);
  }

  // Initialize DOM elements (from app.js)
  function initializeDOMElements(){
    // Get DOM elements
    inputUnit = document.getElementById('disp_dept');
    inputWasteType = document.getElementById('disp_waste_type');
    inputWeight = document.getElementById('weight_input');
    btnScan = document.getElementById('btn-scan-qr');
    btnRecord = document.getElementById('btn-record-weight');
    btnSubmit = document.getElementById('btn-submit-record');
    btnConnect = document.getElementById('btn-bt-connect');
    statusDisplay = document.getElementById('bt-status');
    toastContainer = document.getElementById('toast-container');
    caliProgressContainer = document.getElementById('cali-progress-container');
    caliProgressBar = document.getElementById('cali-progress-bar');
    btnResetFactor = document.getElementById('btn-reset-factor');

    // Setup event listeners
    setupEventListeners();
  }

  // Setup event listeners (from app.js)
  function setupEventListeners(){
    // Scan QR button
    if (btnScan) {
      btnScan.addEventListener('click', function(){
        if (isScanning) {
          stopScanner();
        } else {
          startScanner();
        }
      });
    }

    // Record weight button
    if (btnRecord) {
      btnRecord.addEventListener('click', async function(){
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

          isNotificationActive = true;
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
      btnConnect.addEventListener('click', function(){
        if (!isBluetoothConnected) {
          connectToBluetoothDevice();
        } else {
          disconnectBluetooth();
        }
      });
    }

    // Reset calibration button
    if (btnResetFactor) {
      btnResetFactor.addEventListener('click', function(){
        if (isBluetoothConnected && bluetoothDevice && bluetoothDevice.gatt.connected) {
          sendCommandToESP32('C');
          displayMessage('開始校正 (100g)...', 'info');
        } else {
          displayMessage('請先連接藍芽裝置', 'warning');
        }
      });
    }

    // Submit record button
    if (btnSubmit) {
      btnSubmit.addEventListener('click', submitRecord);
    }
  }

  function renderLocations(locations){
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
    sel.addEventListener('change', function(){
      const idx = sel.selectedIndex;
      const txt = sel.options[idx] ? sel.options[idx].text : '---';
      const dispLoc = document.getElementById('disp_loc');
      if (dispLoc) dispLoc.innerText = txt;
      checkSubmitReady();
    });
  }

  function startScanner(){
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

  function stopScanner(){
    if (html5QrcodeScanner && isScanning){
      html5QrcodeScanner.stop().then(()=>{
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

  function onScanSuccess(decodedText, decodedResult){
    // Parse QR code: supports both standard JSON and non-standard JSON
    // Examples: 
    //   Standard: {"dept":"病理檢驗部","waste_type":"病理廢棄物"}
    //   Non-standard: {department:HB, status:dangerous}
    stopScanner();

    let qrData = {};
    const cleanText = decodedText.trim();
    
    try {
      // Try parsing as standard JSON first
      qrData = JSON.parse(cleanText);
    } catch (e) {
      // Try converting non-standard JSON to standard format (add quotes around keys and values)
      try {
        const standardJson = cleanText.replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
                                       .replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*([,}])/g, ':"$1"$2');
        qrData = JSON.parse(standardJson);
      } catch (e2) {
        // Fallback: extract key:value pairs manually
        const pairs = cleanText.replace(/[{}]/g, '').split(',');
        pairs.forEach(pair => {
          const parts = pair.split(':').map(s => s.trim());
          if (parts.length === 2) {
            const [k, v] = parts;
            if (k && v) qrData[k] = v;
          }
        });
      }
    }

    // Map QR code fields to expected field names
    const dept = qrData.dept || qrData.department || '---';
    const wasteType = qrData.waste_type || qrData.type || qrData.status || '---';

    if (inputUnit) inputUnit.innerText = dept;
    if (inputWasteType) inputWasteType.innerText = wasteType;
    
    // Reset location selection - user must choose manually
    const sel = document.getElementById('select_loc_id');
    if (sel) {
      sel.value = '';
    }
    const dispLoc = document.getElementById('disp_loc');
    if (dispLoc) dispLoc.innerText = '-- 請選擇定點 --';

    const badge = document.getElementById('scan-status-badge');
    if (badge){
      badge.className = 'ts-badge is-positive';
      badge.innerHTML = '<span class="ts-icon is-check-icon" style="background: rgba(101, 212, 127, 0.9); border-radius: 50%; padding: 2px;"></span> 掃描成功';
      displayMessage('✅ QR code 掃描成功', 'success');
    }

    checkSubmitReady();
  }

  // Real Bluetooth device scanning (based on app.js implementation)
  async function bluetoothConnect(){
    if (isBluetoothConnected) {
      displayMessage('藍芽已連線，無需重複操作', 'warning');
      return;
    }

    if (btnConnect) {
      btnConnect.textContent = '請求連線中...';
      btnConnect.disabled = true;
    }

    try {
      // Request device with specific service UUID and filter by name prefix 'ESP32'
      bluetoothDevice = await navigator.bluetooth.requestDevice({
        optionalServices: [SERVICE_UUID],
        filters: [{ namePrefix: 'ESP32' }],
        acceptAllDevices: false
      });

      // Connect to GATT server
      const server = await bluetoothDevice.gatt.connect();

      // Get the service
      const service = await server.getPrimaryService(SERVICE_UUID);

      // Get the characteristic
      weightCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
      
      isBluetoothConnected = true;
      
      // Set up disconnect handler
      bluetoothDevice.addEventListener('gattserverdisconnected', () => {
        displayMessage('藍牙連線已中斷', 'danger');
        resetFormAndState(false);
      });

      displayMessage('✅ 藍芽連線成功！', 'success', 2000);
      
      // Update UI status
      if (statusDisplay) {
        statusDisplay.textContent = `✅ 已連線到 ${bluetoothDevice.name || '裝置'}`;
        statusDisplay.classList.replace('text-danger', 'text-success');
      }
      if (btnConnect) {
        btnConnect.textContent = '✅ 藍芽已連線';
        btnConnect.classList.replace('btn-secondary', 'btn-success');
      }

    } catch (error) {
      console.error('藍芽連線失敗:', error);
      displayMessage('❌ 連線失敗，請檢查藍牙或 HTTPS', 'danger', 2500);
      isBluetoothConnected = false;
      
      if (statusDisplay) {
        statusDisplay.textContent = '未連線';
        statusDisplay.classList.replace('text-success', 'text-danger');
      }
      if (btnConnect) {
        btnConnect.textContent = '藍芽連線';
        btnConnect.classList.remove('btn-success');
        btnConnect.classList.add('btn-secondary');
      }
    }
    
    if (btnConnect) {
      btnConnect.disabled = false;
    }
  }
  
  function displayMessage(msg, type = 'warning', duration = 1500) {
    // Map type to Tocas message state and color
    let bgColor = '';
    let textColor = '';
    
    switch(type) {
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
      <div style="background: ${bgColor}; color: ${textColor}; position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 250px; max-width: 400px; animation: slideIn 0.3s ease-out; padding: 12px 16px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: space-between; gap: 10px;">
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
      if (caliProgressContainer) caliProgressContainer.style.display = 'block';
      if (btnResetFactor) {
        btnResetFactor.disabled = true;
        btnResetFactor.innerText = "校正中...";
      }
      return;
    }

    if (receivedString.startsWith("CALI:")) {
      const step = parseInt(receivedString.split(':')[1]);
      const percent = Math.round(((step + 1) / 9) * 100);
      if (caliProgressBar) {
        caliProgressBar.style.width = percent + '%';
        caliProgressBar.innerText = `採樣中 ${percent}%`;
      }
      return;
    }

    if (receivedString === "NEXT_ROUND") {
      displayMessage("🔄 誤差尚大，進行下一輪微調...", "info", 1000);
      if (caliProgressBar) caliProgressBar.style.width = '10%';
      return;
    }

    if (receivedString.startsWith("DONE:")) {
      const finalFactor = receivedString.split(':')[1];
      if (caliProgressBar) {
        caliProgressBar.style.width = '100%';
        caliProgressBar.classList.replace('bg-primary', 'bg-success');
        caliProgressBar.innerText = "校正完成！";
      }
      displayMessage(`✅ 校正成功！新因子：${finalFactor}`, "success", 4000);

      setTimeout(() => {
        if (btnResetFactor) {
          btnResetFactor.disabled = false;
          btnResetFactor.innerText = "重新校正 (100g)";
        }
        if (caliProgressContainer) caliProgressContainer.style.display = 'none';
        if (caliProgressBar) {
          caliProgressBar.classList.replace('bg-success', 'bg-primary');
          caliProgressBar.style.width = '0%';
        }
      }, 2000);
      return;
    }

    // General commands
    if (receivedString === "TARE_OK") {
      displayMessage("✅ 秤盤已歸零", "success", 1500);
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
      if (inputWeight) inputWeight.value = weightValue.toFixed(2);
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
      btnConnect.textContent = '請求連線中...';
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
        statusDisplay.textContent = `✅ 已連線到 ${bluetoothDevice.name || '裝置'}`;
        statusDisplay.classList.replace('text-danger', 'text-success');
      }
      if (btnConnect) {
        btnConnect.textContent = '✅ 藍芽已連線';
        btnConnect.classList.remove('btn-secondary');
        btnConnect.classList.add('btn-success');
        btnConnect.disabled = false;
      }

      displayMessage('✅ 藍芽連線成功！', 'success');

    } catch (error) {
      console.error('藍芽連線失敗:', error);
      isBluetoothConnected = false;

      if (statusDisplay) {
        statusDisplay.textContent = '連線失敗';
        statusDisplay.classList.replace('text-success', 'text-danger');
      }
      if (btnConnect) {
        btnConnect.textContent = '藍芽連線';
        btnConnect.classList.remove('btn-success');
        btnConnect.classList.add('btn-secondary');
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
      if (statusDisplay) {
        statusDisplay.textContent = '未連線';
        statusDisplay.classList.replace('text-success', 'text-danger');
      }
      if (btnConnect) {
        btnConnect.textContent = '藍芽連線';
        btnConnect.classList.remove('btn-success');
        btnConnect.classList.add('btn-secondary');
      }
      displayMessage('藍芽已斷開', 'info');
    }
  }

  // Reset calibration UI
  function resetCaliUI() {
    if (btnResetFactor) {
      btnResetFactor.disabled = false;
      btnResetFactor.innerText = "重新校正 (100g)";
    }
    if (caliProgressContainer) caliProgressContainer.style.display = 'none';
    if (caliProgressBar) {
      caliProgressBar.style.width = '0%';
      caliProgressBar.classList.replace('bg-success', 'bg-primary');
    }
  }

  // Reset form and state (from app.js)
  function resetFormAndState(keepBluetooth = true) {
    if (inputUnit) inputUnit.innerText = '---';
    if (inputWasteType) inputWasteType.innerText = '---';
    if (inputWeight) inputWeight.value = '0.00';
    const sel = document.getElementById('select_loc_id');
    if (sel) sel.selectedIndex = 0;

    isQRScanned = false;

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
        statusDisplay.textContent = '未連線';
        statusDisplay.classList.replace('text-success', 'text-danger');
      }
      if (btnConnect) {
        btnConnect.textContent = '藍芽連線';
        btnConnect.classList.remove('btn-success');
        btnConnect.classList.add('btn-secondary');
      }
    } else {
      if (statusDisplay) {
        statusDisplay.textContent = `✅ 已連線到 ${bluetoothDevice.name || '裝置'}`;
        statusDisplay.classList.replace('text-danger', 'text-success');
      }
      if (btnConnect) {
        btnConnect.textContent = '✅ 藍芽已連線';
        btnConnect.classList.remove('btn-secondary');
        btnConnect.classList.add('btn-success');
      }
    }
  }

  function checkSubmitReady(){
    const locIdEl = document.getElementById('select_loc_id');
    const weightEl = document.getElementById('weight_input');
    const deptEl = document.getElementById('disp_dept');
    const typeEl = document.getElementById('disp_waste_type');
    const btn = document.getElementById('btn-submit-record');
    const locId = locIdEl ? locIdEl.value : '';
    const weight = weightEl ? weightEl.value : '';
    const dept = deptEl ? deptEl.innerText : '---';
    const type = typeEl ? typeEl.innerText : '---';
    if (locId && weight && parseFloat(weight) > 0 && dept !== '---' && type !== '---'){ 
      if (btn) btn.disabled = false; 
    } else {
      if (btn) btn.disabled = true;
    }
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

  function submitRecord(){
    const dept = inputUnit ? inputUnit.innerText.trim() : '';
    const wasteType = inputWasteType ? inputWasteType.innerText.trim() : '';
    const weight = inputWeight ? parseFloat(inputWeight.value) : 0; 
    const locSel = document.getElementById('select_loc_id');
    const locId = locSel ? locSel.value : '';

    if (!dept || dept === '---' || !wasteType || wasteType === '---' || weight <= 0 || !locId || locId === '-- 請選擇定點 --'){
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
      if (data.success || data.status === 'success'){
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
  function submitData(){
    submitRecord();
  }

  return { 
    init: init,
    renderLocations: renderLocations,
    startScanner: startScanner,
    stopScanner: stopScanner,
    onScanSuccess: onScanSuccess,
    bluetoothConnect: bluetoothConnect,
    displayMessage: displayMessage,
    handleWeightNotification: handleWeightNotification,
    resetCaliUI: resetCaliUI,
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
window.startScanner = function(){ StationMobile.startScanner(); };
window.stopScanner = function(){ StationMobile.stopScanner(); };
window.bluetoothConnect = function(){ StationMobile.bluetoothConnect(); };
window.submitRecord = function(){ StationMobile.submitRecord(); };
window.resetFormAndState = function(keepBluetooth){ StationMobile.resetFormAndState(keepBluetooth); };
window.submitData = function(){ StationMobile.submitData(); };
Window.connectToBluetoothDevice = function(){ StationMobile.connectToBluetoothDevice(); };
