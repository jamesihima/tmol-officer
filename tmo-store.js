/* TMO Logistics — shared live data store for all prototype apps.
   Persists to localStorage and syncs across tabs/iframes (storage event + BroadcastChannel). */
(function () {
  if (window.TMO) return;
  var KEY = 'tmo.db.v1', SK = 'tmo.sess.';
  var DESTS = [
    { n: 'Sabo Market, Yaba', s: 'Yaba', km: 9, z: 'A' },
    { n: 'Computer Village, Ikeja', s: 'Ikeja', km: 21, z: 'B' },
    { n: 'Admiralty Way, Lekki Ph. 1', s: 'Lekki Ph. 1', km: 14, z: 'B' },
    { n: 'Oshodi Interchange', s: 'Oshodi', km: 17, z: 'B' },
    { n: 'Ajah Roundabout', s: 'Ajah', km: 28, z: 'C' },
    { n: 'Ikorodu Garage', s: 'Ikorodu', km: 36, z: 'C' }
  ];
  var PICKUPS = ['Balogun Market, Lagos Island', 'Idumota Market', 'Tinubu Square', 'CMS Park, Obalende', 'Marina, Lagos Island'];
  var PARKS = ['CMS Park, Obalende', 'Balogun Market desk', 'Tinubu Square', 'Idumota'];
  var BANDS = [{ l: 'Under 2 kg', max: 2 }, { l: '2–5 kg', max: 5 }, { l: '5–10 kg', max: 10 }, { l: '10–20 kg', max: 20 }, { l: '20 kg+', max: 1e9 }];
  var CATS = ['Fabrics', 'Electronics', 'Food items', 'Documents', 'Household', 'Other'];
  var COLORS = {
    'Created': ['#F4F6F3', '#5C6B60'], 'Requested': ['#F4F6F3', '#5C6B60'], 'Awaiting payment': ['#FDF7D8', '#6B5300'],
    'Paid': ['#E6F6EC', '#075A36'], 'Accepted': ['#E6F6EC', '#075A36'], 'Assigned': ['#FDF7D8', '#6B5300'],
    'Ready for pickup': ['#E6F6EC', '#075A36'], 'In transit': ['#F9D44B', '#17251B'], 'Out for delivery': ['#F9D44B', '#17251B'],
    'Delivered': ['#075A36', '#fff'], 'Closed': ['#17251B', '#fff'], 'Cancelled': ['#FBE9E6', '#C8412F'], 'Issue': ['#FBE9E6', '#C8412F'],
    'active': ['#E6F6EC', '#075A36'], 'pending': ['#FDF7D8', '#6B5300'], 'invited': ['#F4F6F3', '#5C6B60'], 'rejected': ['#FBE9E6', '#C8412F']
  };
  var now = function () { return Date.now(); };
  var uid = function (p) { return (p || 'id') + '_' + Math.random().toString(36).slice(2, 9); };
  var rnd = function (n) { var s = ''; for (var i = 0; i < n; i++) s += Math.floor(Math.random() * 10); return s; };
  function norm(p) { var d = String(p || '').replace(/\D/g, ''); if (d.indexOf('234') === 0) d = '0' + d.slice(3); if (d.length === 10 && d[0] !== '0') d = '0' + d; return d; }
  function fmtPhone(p) { var d = norm(p); return d.length === 11 ? d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7) : (p || ''); }
  function fmt(n) { return '₦' + Math.round(n || 0).toLocaleString('en-NG'); }
  function time(t) { var d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function ago(t) { var s = Math.round((now() - t) / 1000); if (s < 60) return s + 's ago'; if (s < 3600) return Math.round(s / 60) + 'm ago'; if (s < 86400) return Math.round(s / 3600) + 'h ago'; return Math.round(s / 86400) + 'd ago'; }

  function seed() {
    var t = now();
    return {
      v: 1, seq: 48300,
      rates: { base: 500, svc: 250, ins: 1.5, vat: 7.5, bands: [600, 1200, 2000, 3200, 4800], zones: { A: 800, B: 1500, C: 2400 } },
      users: [
        { id: 'u_admin', role: 'admin', name: 'Kemi Adebayo', phone: '08020000001', email: 'kemi.a@tmo.ng', status: 'active', createdAt: t },
        { id: 'u_off1', role: 'officer', name: 'Bisi Olatunji', phone: '08054412290', pin: '1234', park: 'CMS Park, Obalende', staffId: 'CMS-OF-0417', status: 'active', createdAt: t },
        { id: 'u_drv1', role: 'driver', name: 'Emeka Adeyemi', phone: '08035550192', pin: '2580', vehicle: 'Van', plate: 'LND 482 KJ', status: 'active', onDuty: false, createdAt: t },
        { id: 'u_drv2', role: 'driver', name: 'Musa Kabiru', phone: '08061230044', pin: '1111', vehicle: 'Bus', plate: 'BRT-114', status: 'active', onDuty: true, createdAt: t }
      ],
      shipments: [], sms: [],
      activity: [{ id: uid('a'), at: t, actor: 'System', role: 'system', text: 'TMO Logistics workspace ready. Seeded staff: officer Bisi (PIN 1234), drivers Emeka (PIN 2580) and Musa (PIN 1111).' }]
    };
  }
  function load() { try { var j = JSON.parse(localStorage.getItem(KEY)); if (j && j.v === 1) return j; } catch (e) { } var s = seed(); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { } return s; }
  var db = load();
  var subs = [];
  var bc = ('BroadcastChannel' in window) ? new BroadcastChannel('tmo-live') : null;
  function notify() { subs.slice().forEach(function (f) { try { f(db); } catch (e) { console.error(e); } }); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn('TMO store full', e); } if (bc) bc.postMessage(now()); }
  function refresh() { db = load(); notify(); }
  window.addEventListener('storage', function (e) { if (e.key === KEY) refresh(); });
  if (bc) bc.onmessage = refresh;
  window.addEventListener('resize', function () { notify(); });
  var libWait = setInterval(function () { if (window.qrcode) { clearInterval(libWait); notify(); } }, 120);

  var T = {
    DESTS: DESTS, PICKUPS: PICKUPS, PARKS: PARKS, BANDS: BANDS, CATS: CATS, COLORS: COLORS,
    norm: norm, fmtPhone: fmtPhone, fmt: fmt, time: time, ago: ago, rnd: rnd, uid: uid,
    get db() { return db; },
    subscribe: function (f) { subs.push(f); return function () { subs = subs.filter(function (x) { return x !== f; }); }; },
    update: function (fn) { db = load(); var r = fn(db); save(); notify(); return r; },
    reset: function () { db = seed(); save(); notify(); },
    getSession: function (app) { return localStorage.getItem(SK + app); },
    setSession: function (app, id) { if (id) localStorage.setItem(SK + app, id); else localStorage.removeItem(SK + app); },
    chip: function (st) { return COLORS[st] || COLORS.Created; },
    user: function (d, id) { return d.users.filter(function (u) { return u.id === id; })[0] || null; },
    userByPhone: function (d, phone, role) { var p = norm(phone); return d.users.filter(function (u) { return norm(u.phone) === p && (!role || u.role === role); })[0] || null; },
    ship: function (d, code) { var c = String(code || '').trim().toUpperCase(); return d.shipments.filter(function (s) { return s.code === c; })[0] || null; },
    log: function (d, actor, role, text, code) { d.activity.unshift({ id: uid('a'), at: now(), actor: actor, role: role, text: text, code: code || '' }); if (d.activity.length > 400) d.activity.length = 400; },
    sms: function (d, phone, text, kind) { var m = { id: uid('m'), to: norm(phone), text: text, kind: kind || 'info', at: now() }; d.sms.unshift(m); if (d.sms.length > 300) d.sms.length = 300; return m; },
    sendOtp: function (phone, app) { var code = rnd(6); T.update(function (d) { T.sms(d, phone, 'Your TMO ' + app + ' verification code is ' + code + '. Do not share it.', 'otp'); }); return code; },
    bandIndex: function (kg) { for (var i = 0; i < BANDS.length; i++) if (kg < BANDS[i].max) return i; return BANDS.length - 1; },
    dest: function (name) { return DESTS.filter(function (x) { return x.n === name || x.s === name; })[0] || DESTS[1]; },
    price: function (d, o) {
      var r = d.rates, bi = o.kg != null ? T.bandIndex(o.kg) : o.band, z = T.dest(o.dest).z, km = T.dest(o.dest).km, v = Number(o.value) || 0;
      var band = Number(r.bands[bi]) || 0, zone = Number(r.zones[z]) || 0, sub = Number(r.base) + band + zone + Number(r.svc), ins = v * Number(r.ins) / 100, vat = sub * Number(r.vat) / 100;
      return { total: Math.round(sub + ins + vat), lines: [
        { k: 'Base charge', v: fmt(r.base) }, { k: 'Weight · ' + BANDS[bi].l, v: fmt(band) }, { k: 'Zone ' + z + ' · ' + km + ' km', v: fmt(zone) },
        { k: 'Service charge', v: fmt(r.svc) }, { k: 'Insurance · ' + r.ins + '% of ' + fmt(v), v: fmt(ins) }, { k: 'VAT ' + r.vat + '%', v: fmt(vat) }] };
    },
    due: function (sh) { return Math.max(0, (sh.finalPrice || sh.estPrice || 0) - (sh.paidAmount || 0)); },
    collectable: function (sh) { return !!sh.kg && T.due(sh) <= 0; },
    display: function (sh) {
      var s = sh.status;
      if (s === 'Cancelled' || s === 'Closed' || s === 'Delivered' || s === 'In transit' || s === 'Out for delivery') return s;
      if (sh.kg && T.due(sh) > 0) return 'Awaiting payment';
      if (sh.channel === 'online') { if (!sh.driverId) return sh.paidAmount ? 'Paid' : 'Requested'; if (T.collectable(sh)) return 'Ready for pickup'; return 'Assigned'; }
      return s;
    },
    newCode: function (d) { d.seq += 1; return 'TMO-LG-' + d.seq; },
    create: function (d, o, actor, role) {
      var sh = Object.assign({ id: uid('s'), code: T.newCode(d), podToken: rnd(6), status: 'Created', payments: [], paidAmount: 0, history: [], issues: [], createdAt: now() }, o);
      sh.history.push({ status: 'Created', at: now(), by: actor, note: o.channel === 'online' ? 'Online pickup request' : (o.channel === 'ride' ? 'Passenger package registered' : 'Drop-off registered') });
      d.shipments.unshift(sh);
      T.log(d, actor, role, (o.channel === 'online' ? 'requested a pickup ' : 'registered a shipment ') + sh.code + ' → ' + T.dest(o.dest).s, sh.code);
      return sh;
    },
    step: function (d, sh, status, actor, role, note) { sh.status = status; sh.history.push({ status: status, at: now(), by: actor, note: note || '' }); T.log(d, actor, role, 'set ' + sh.code + ' to ' + status + (note ? ' · ' + note : ''), sh.code); },
    note: function (d, sh, label, actor, role, note) { sh.history.push({ status: label, at: now(), by: actor, note: note || '' }); T.log(d, actor, role, label + ' · ' + sh.code + (note ? ' · ' + note : ''), sh.code); },
    pay: function (d, sh, amount, method, actor, role) {
      amount = Math.round(amount);
      if (method === 'TMO Card') { var u = T.userByPhone(d, sh.senderPhone, 'customer'); if (!u || (u.card || 0) < amount) return false; u.card -= amount; }
      sh.payments.push({ id: uid('p'), amount: amount, method: method, at: now(), by: actor, park: sh.park || 'Online' });
      sh.paidAmount = (sh.paidAmount || 0) + amount; sh.payRequest = false;
      T.note(d, sh, 'Payment received', actor, role, fmt(amount) + ' via ' + method);
      if (!sh.waybillAt && (sh.kg ? T.due(sh) <= 0 : true)) {
        if (sh.channel === 'online' && !sh.kg) { /* estimate paid upfront */ }
        else { sh.waybillAt = now(); T.sms(d, sh.senderPhone, 'TMO: Payment of ' + fmt(sh.paidAmount) + ' confirmed. Waybill ' + sh.code + ' issued. Track: tmo.ng/t/' + sh.code); }
      }
      if (sh.channel !== 'online' && sh.status === 'Created') { T.step(d, sh, 'Paid', 'System', 'system', 'Payment confirmed'); T.step(d, sh, 'Accepted', actor, role, 'Package received & sealed at ' + (sh.park || 'park')); T.sms(d, sh.receiverPhone, 'TMO: ' + sh.senderName + ' sent you a package (' + sh.code + '). Track & get your delivery QR: tmo.ng/t/' + sh.code); }
      else if (sh.channel === 'online' && sh.status === 'Created') T.step(d, sh, 'Paid', 'System', 'system', 'Estimate paid upfront');
      return true;
    },
    refundExtra: function (d, sh, actor) {
      var extra = (sh.paidAmount || 0) - (sh.finalPrice || 0);
      if (extra > 0) { var u = T.userByPhone(d, sh.senderPhone, 'customer'); if (u) u.card = (u.card || 0) + extra; sh.paidAmount -= extra; sh.payments.push({ id: uid('p'), amount: -extra, method: 'Refund to TMO Card', at: now(), by: 'System', park: 'Online' }); T.note(d, sh, 'Refund issued', 'System', 'system', fmt(extra) + ' back to TMO Card'); T.sms(d, sh.senderPhone, 'TMO: ' + fmt(extra) + ' refunded to your TMO Card for ' + sh.code + '.'); }
    },
    wbPayload: function (sh) { return 'TMO:WB:' + sh.code; },
    podPayload: function (sh) { return 'TMO:POD:' + sh.code + ':' + sh.podToken; },
    qr: function (text, cell) { if (!window.qrcode || !text) return ''; try { var q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createDataURL(cell || 6, 2); } catch (e) { return ''; } },
    readFile: function (file) { return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsDataURL(file); }); },
    photo: function (file, max) {
      max = max || 520;
      return T.readFile(file).then(function (url) { return new Promise(function (res) { var im = new Image(); im.onload = function () { var k = Math.min(1, max / Math.max(im.width, im.height)); var c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.7)); }; im.onerror = function () { res(''); }; im.src = url; }); });
    },
    decodeFile: function (file) {
      return T.readFile(file).then(function (url) { return new Promise(function (res) { var im = new Image(); im.onload = function () { var k = Math.min(1, 1000 / Math.max(im.width, im.height)); var c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); var x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height); var data = x.getImageData(0, 0, c.width, c.height); var r = window.jsQR ? window.jsQR(data.data, c.width, c.height) : null; res(r ? r.data : null); }; im.onerror = function () { res(null); }; im.src = url; }); });
    },
    scan: function (video, onResult) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.reject(new Error('Camera not available'));
      return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (stream) {
        var stopped = false, c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
        video.srcObject = stream; video.setAttribute('playsinline', ''); video.play();
        function tick() {
          if (stopped) return;
          if (video.readyState >= 2 && window.jsQR) { c.width = video.videoWidth; c.height = video.videoHeight; x.drawImage(video, 0, 0); var r = window.jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height); if (r && r.data) { stop(); onResult(r.data); return; } }
          requestAnimationFrame(tick);
        }
        function stop() { stopped = true; stream.getTracks().forEach(function (t) { t.stop(); }); video.srcObject = null; }
        requestAnimationFrame(tick);
        return stop;
      });
    },
    embed: /[?&]embed=1/.test(location.search),
    get device() { return /[?&]device=1/.test(location.search) || window.innerWidth < 600; },
    frame: function () { return T.device ? { w: '100vw', h: '100dvh', r: '0', p: '0', sh: 'none', ir: '0', sb: '0', sbd: 'none' } : { w: '390px', h: '844px', r: '54px', p: '10px', sh: '0 30px 80px rgba(23,37,27,.28)', ir: '44px', sb: '48px', sbd: 'flex' }; }
  };
  window.TMO = T;
})();
