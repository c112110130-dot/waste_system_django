const StationMobile = (function(){
  let cfg = { locations: [] };
  let html5QrcodeScanner = null;
  let isScanning = false;
  let selectedDeviceName = null;

  function init(options){
    cfg = Object.assign(cfg, options || {});
    cacheDom();
    bindEvents();
    renderLocations(cfg.locations);
  }

  function cacheDom(){
    // no-op for now; elements accessed ad-hoc
  }

  function bindEvents(){
    const startBtn = document.querySelector('.btn-camera-start');
    const stopBtn = document.getElementById('btn-stop-cam');
    const btOpen = document.getElementById('btn-bt-connect');
    const btConfirm = document.getElementById('btn-bt-confirm');
    const btCancel = document.querySelector('.btn-cancel');
    const submitBtn = document.getElementById('btn_submit');

    if (startBtn) startBtn.addEventListener('click', startScanner);
    if (stopBtn) stopBtn.addEventListener('click', stopScanner);
    if (btOpen) btOpen.addEventListener('click', openBluetoothModal);
    if (btConfirm) btConfirm.addEventListener('click', confirmBluetoothDevice);
    if (btCancel) btCancel.addEventListener('click', closeBluetoothModal);
    if (submitBtn) submitBtn.addEventListener('click', submitData);

    // ensure modal close when clicking cancel overlay close
    const modalOverlay = document.getElementById('bt-modal');
    if (modalOverlay) modalOverlay.addEventListener('click', (e)=>{ if(e.target === modalOverlay) closeBluetoothModal(); });
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

    document.getElementById('disp_dept').innerText = dept;
    document.getElementById('disp_waste_type').innerText = wasteType;
    
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
      badge.innerHTML = '<span class="ts-icon is-check-icon"></span> 掃描成功';
    }

    checkSubmitReady();
  }

  // Bluetooth modal (simulated search)
  function openBluetoothModal(){
    // availability check
    if (navigator.bluetooth && navigator.bluetooth.getAvailability){
      navigator.bluetooth.getAvailability().catch(()=>{});
    }

    const modal = document.getElementById('bt-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    document.getElementById('bt-searching').style.display = 'block';
    const list = document.getElementById('bt-list');
    if (list) { list.style.display = 'none'; list.innerHTML = ''; }
    const confirm = document.getElementById('btn-bt-confirm'); if (confirm) confirm.disabled = true;
    selectedDeviceName = null;

    setTimeout(()=>{
      document.getElementById('bt-searching').style.display = 'none';
      if (list) list.style.display = 'block';
      const devices = [
        "Medical Waste Scale #01",
        "Mi Smart Scale 2",
        "Unknown Device (CC:21:44)"
      ];
      devices.forEach(dev => {
        const li = document.createElement('li');
        li.className = 'device-item';
        li.innerText = dev;
        li.onclick = () => selectDevice(li, dev);
        list.appendChild(li);
      });
    }, 1500);
  }

  function closeBluetoothModal(){
    const modal = document.getElementById('bt-modal');
    if (modal) modal.style.display = 'none';
  }

  function selectDevice(element, devName){
    document.querySelectorAll('.device-item').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    selectedDeviceName = devName;
    const confirm = document.getElementById('btn-bt-confirm'); if (confirm) confirm.disabled = false;
  }

  function confirmBluetoothDevice(){
    closeBluetoothModal();
    const btn = document.getElementById('btn-bt-connect');
    const msg = document.getElementById('bt-msg');
    const weightInput = document.getElementById('weight_input');

    if (btn) { btn.className = 'btn-bluetooth connected'; btn.innerHTML = `<span class="ts-icon is-link-icon"></span> ${selectedDeviceName}`; }
    if (msg) { msg.innerText = '正在讀取數據...'; msg.style.color = '#21ba45'; }

    setTimeout(()=>{
      const randomWeight = (Math.random()*10 + 5).toFixed(2);
      if (weightInput) weightInput.value = randomWeight;
      if (msg) msg.innerText = '穩定讀數 (Stable)';
      checkSubmitReady();
    }, 800);
  }

  function checkSubmitReady(){
    const locIdEl = document.getElementById('select_loc_id');
    const weightEl = document.getElementById('weight_input');
    const btn = document.getElementById('btn_submit');
    const locId = locIdEl ? locIdEl.value : '';
    const weight = weightEl ? weightEl.value : '';
    if (locId && weight && parseFloat(weight) > 0){ if (btn) btn.disabled = false; }
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

  async function submitData(){
    const sel = document.getElementById('select_loc_id');
    const locId = sel ? sel.value : '';
    const weight = document.getElementById('weight_input').value;
    const dept = document.getElementById('disp_dept').innerText;
    const wasteType = document.getElementById('disp_waste_type').innerText;
    
    const btn = document.getElementById('btn_submit');
    const originalHTML = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="ts-loading"></span> 上傳中...'; }

    try{
      const res = await fetch(cfg.api.recordUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({ 
          location_id: locId, 
          weight: weight,
          dept: dept,
          waste_type: wasteType
        })
      });
      const data = await res.json();
      if (data.status === 'success'){
        const locName = document.querySelector('#select_loc_id option:checked')?.text || '---';
        alert(`✅ 上傳成功！\n地點: ${locName}\n重量: ${weight} KG`);
        window.location.reload();
      } else {
        alert('❌ 失敗: ' + (data.message || 'unknown'));
        if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
      }
    }catch(err){
      alert('❌ 錯誤: ' + err);
      if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
    }
  }

  return { 
    init, 
    startScanner, 
    stopScanner, 
    submitData,
    openBluetoothModal,
    closeBluetoothModal,
    selectDevice,
    confirmBluetoothDevice
  };
})();

window.StationMobile = StationMobile;

// Expose functions to global scope for onclick handlers in HTML
window.startScanner = function(){ StationMobile.startScanner(); };
window.stopScanner = function(){ StationMobile.stopScanner(); };
window.openBluetoothModal = function(){ StationMobile.openBluetoothModal(); };
window.closeBluetoothModal = function(){ StationMobile.closeBluetoothModal(); };
window.selectDevice = function(el, name){ StationMobile.selectDevice(el, name); };
window.confirmBluetoothDevice = function(){ StationMobile.confirmBluetoothDevice(); };
window.submitData = function(){ StationMobile.submitData(); };
