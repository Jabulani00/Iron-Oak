/**
 * Iron & Oak Barber Co. — booking book
 * Sheet tab name: BARBER-ONE
 *
 * SETUP
 * 1. Create a Google Sheet (the file name can be anything).
 * 2. Extensions → Apps Script. Delete the placeholder and paste this file.
 * 3. Save, then click Run on myFunction. Approve the permissions.
 *    That creates the BARBER-ONE tab and the column headers.
 * 4. Deploy → New deployment → Web app.
 *    Execute as: Me
 *    Who has access: Anyone
 * 5. Copy the web app URL (it ends in /exec) into APPS_SCRIPT_URL
 *    at the top of the script in ironoak.html.
 *
 * Google calls doGet / doPost for the website. Both hand the request to myFunction.
 */

var SHEET_NAME = 'BARBER-ONE';
var CAPACITY = 8;
var HEADERS = ['BookingID', 'CreatedAt', 'Name', 'Email', 'Phone', 'Service', 'Price', 'Barber', 'Date', 'StartTime', 'EndTime', 'Status'];
var SERVICES = {
  'Classic Haircut': 220,
  'Skin Fade': 260,
  'Beard Trim & Line-up': 150,
  'Cut & Beard Package': 340,
  'Kids Cut': 140,
  'Hot Towel Shave': 190
};
var BARBERS = ['No preference', 'Thabo Nkosi', 'Sipho Dlamini', 'Ayanda Mokoena'];

function doGet(e) {
  return myFunction(e);
}

function doPost(e) {
  return myFunction(e);
}

/**
 * Run with no arguments from the editor to prepare BARBER-ONE.
 * The web app passes the request event in.
 */
function myFunction(e) {
  if (!e || (!e.parameter && !e.postData)) {
    var ready = getSheet_();
    Logger.log('BARBER-ONE is ready. Rows including header: ' + ready.getLastRow());
    return 'BARBER-ONE sheet is ready';
  }

  try {
    var payload = readPayload_(e);
    var action = String(payload.action || 'ping').toLowerCase();

    if (action === 'ping') {
      return json_({ ok: true, sheet: SHEET_NAME, service: 'Iron & Oak bookings', capacity: CAPACITY });
    }
    if (action === 'availability') return json_(availability_(payload.date));
    if (action === 'book') return json_(withLock_(function () { return book_(payload); }));
    if (action === 'track') return json_(track_(payload.bookingId || payload.id));
    if (action === 'cancel') return json_(withLock_(function () { return cancel_(payload.bookingId || payload.id); }));
    if (action === 'reschedule') {
      return json_(withLock_(function () { return reschedule_(payload); }));
    }
    return json_({ ok: false, error: 'Unknown action.' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function getSpreadsheet_() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  throw new Error('Open your Google Sheet, choose Extensions → Apps Script, and paste this code there so it can use BARBER-ONE.');
}

function getSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    var sheets = ss.getSheets();
    if (sheets.length === 1 && sheets[0].getLastRow() === 0) {
      sheets[0].setName(SHEET_NAME);
      sheet = sheets[0];
    } else {
      sheet = ss.insertSheet(SHEET_NAME);
    }
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setNumberFormat('@');
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    styleHeader_(sheet);
  } else if (String(sheet.getRange(1, 1).getValue()) !== 'BookingID') {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setNumberFormat('@');
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    styleHeader_(sheet);
  }
  return sheet;
}

function styleHeader_(sheet) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#1B1712')
    .setFontColor('#F3ECDD');
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 160);
}

function readPayload_(e) {
  var payload = {};
  var key;
  if (e.parameter) {
    for (key in e.parameter) payload[key] = e.parameter[key];
  }
  if (e.postData && e.postData.contents) {
    try {
      var body = JSON.parse(e.postData.contents);
      for (key in body) payload[key] = body[key];
    } catch (ignore) {}
  }
  return payload;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function clean_(value, max) {
  return String(value || '').replace(/[\u0000-\u001F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 120);
}

function pad_(n) {
  n = Number(n);
  return (n < 10 ? '0' : '') + n;
}

function todaySA_() {
  return Utilities.formatDate(new Date(), 'Africa/Johannesburg', 'yyyy-MM-dd');
}

function nowSA_() {
  return Utilities.formatDate(new Date(), 'Africa/Johannesburg', 'yyyy-MM-dd HH:mm');
}

function weekday_(dateStr) {
  var p = String(dateStr).split('-');
  var dt = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12));
  return dt.getUTCDay();
}

function hoursFor_(dateStr) {
  var day = weekday_(dateStr);
  if (day === 0) return [];
  var lastStart = day === 6 ? 16 : 18;
  var hours = [];
  var h;
  for (h = 8; h <= lastStart; h++) hours.push(pad_(h) + ':00');
  return hours;
}

function endFor_(time) {
  return pad_(Number(String(time).slice(0, 2)) + 1) + ':00';
}

function asDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, 'Africa/Johannesburg', 'yyyy-MM-dd');
  }
  var s = String(value || '');
  var m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : s.slice(0, 10);
}

function asTime_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, 'Africa/Johannesburg', 'HH:mm');
  }
  var s = String(value || '');
  var m = s.match(/(\d{1,2}):(\d{2})/);
  return m ? pad_(m[1]) + ':' + m[2] : s;
}

function asDateTime_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, 'Africa/Johannesburg', 'yyyy-MM-dd HH:mm:ss');
  }
  return String(value || '');
}

function readAll_(sheet) {
  var values = sheet.getDataRange().getValues();
  var rows = [];
  var i;
  for (i = 1; i < values.length; i++) {
    var r = values[i];
    if (!r[0]) continue;
    rows.push({
      row: i + 1,
      id: String(r[0]).trim(),
      createdAt: asDateTime_(r[1]),
      name: String(r[2] || ''),
      email: String(r[3] || ''),
      phone: String(r[4] || ''),
      service: String(r[5] || ''),
      price: Number(String(r[6]).replace(/[^\d.]/g, '')) || 0,
      barber: String(r[7] || ''),
      date: asDate_(r[8]),
      time: asTime_(r[9]),
      end: asTime_(r[10]),
      status: String(r[11] || '').toLowerCase()
    });
  }
  return rows;
}

function publicBooking_(b) {
  return {
    id: b.id,
    createdAt: b.createdAt,
    name: b.name,
    email: b.email,
    phone: b.phone,
    service: b.service,
    price: b.price,
    barber: b.barber,
    date: b.date,
    time: b.time,
    end: b.end || endFor_(b.time),
    status: b.status
  };
}

function taken_(rows, date, time, ignoreId) {
  var n = 0;
  var i;
  for (i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.date === date && r.time === time && r.status === 'confirmed' && r.id !== ignoreId) n++;
  }
  return n;
}

function assertDate_(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) throw new Error('Choose a valid date.');
  var today = todaySA_();
  if (dateStr < today) throw new Error('That day has already passed.');
  var todayMs = Date.parse(today + 'T00:00:00Z');
  var pickMs = Date.parse(dateStr + 'T00:00:00Z');
  if ((pickMs - todayMs) / 86400000 > 90) throw new Error('Bookings open up to 90 days ahead.');
  if (weekday_(dateStr) === 0) throw new Error('We are closed on Sundays.');
}

function assertSlot_(dateStr, time) {
  assertDate_(dateStr);
  if (hoursFor_(dateStr).indexOf(time) === -1) throw new Error('Choose an hour we are open.');
  if ((dateStr + ' ' + time) <= nowSA_()) throw new Error('That hour has already started.');
}

function availability_(dateStr) {
  dateStr = clean_(dateStr, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { ok: false, error: 'Choose a valid date.' };
  if (weekday_(dateStr) === 0) {
    return { ok: true, date: dateStr, closed: true, reason: 'Sunday — the shop is closed.', capacity: CAPACITY, slots: [] };
  }
  var hours = hoursFor_(dateStr);
  var rows = readAll_(getSheet_());
  var now = nowSA_();
  var slots = hours.map(function (time) {
    var booked = taken_(rows, dateStr, time);
    var past = (dateStr + ' ' + time) <= now;
    return {
      time: time,
      end: endFor_(time),
      booked: booked,
      left: Math.max(CAPACITY - booked, 0),
      past: past
    };
  });
  return { ok: true, date: dateStr, closed: false, capacity: CAPACITY, slots: slots };
}

function newId_(rows) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var existing = {};
  var i;
  for (i = 0; i < rows.length; i++) existing[rows[i].id] = true;
  var guard = 0;
  while (guard < 20) {
    var id = 'IO-';
    var n;
    for (n = 0; n < 6; n++) id += chars.charAt(Math.floor(Math.random() * chars.length));
    if (!existing[id]) return id;
    guard++;
  }
  throw new Error('Could not create a booking ID. Try again.');
}

function book_(payload) {
  var name = clean_(payload.name, 80);
  var email = clean_(payload.email, 120).toLowerCase();
  var phone = clean_(payload.phone, 30);
  var service = clean_(payload.service, 60);
  var barber = clean_(payload.barber, 40);
  var date = clean_(payload.date, 10);
  var time = clean_(payload.time, 5);
  if (name.length < 2) throw new Error('Enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if ((phone.match(/\d/g) || []).length < 10) throw new Error('Enter a phone number we can reach you on.');
  if (!SERVICES[service]) throw new Error('Choose a service from the list.');
  if (BARBERS.indexOf(barber) === -1) barber = 'No preference';
  assertSlot_(date, time);

  var sheet = getSheet_();
  var rows = readAll_(sheet);
  if (taken_(rows, date, time) >= CAPACITY) {
    throw new Error('That hour is full (8 of 8 spots taken). Choose another hour.');
  }

  var id = newId_(rows);
  var created = Utilities.formatDate(new Date(), 'Africa/Johannesburg', 'yyyy-MM-dd HH:mm:ss');
  var end = endFor_(time);
  var price = String(SERVICES[service]);
  var row = sheet.getLastRow() + 1;
  var record = [id, created, name, email, phone, service, price, barber, date, time, end, 'confirmed'];
  sheet.getRange(row, 1, 1, record.length).setNumberFormat('@');
  sheet.getRange(row, 1, 1, record.length).setValues([record]);

  return {
    ok: true,
    booking: publicBooking_({
      id: id,
      createdAt: created,
      name: name,
      email: email,
      phone: phone,
      service: service,
      price: Number(price),
      barber: barber,
      date: date,
      time: time,
      end: end,
      status: 'confirmed'
    })
  };
}

function find_(id) {
  id = clean_(id, 20).toUpperCase();
  if (!/^IO-[A-Z0-9]{6}$/.test(id)) throw new Error('Enter a booking ID like IO-ABC123.');
  var rows = readAll_(getSheet_());
  var i;
  for (i = 0; i < rows.length; i++) {
    if (rows[i].id.toUpperCase() === id) return rows[i];
  }
  throw new Error('No booking found for ' + id + '.');
}

function track_(id) {
  return { ok: true, booking: publicBooking_(find_(id)) };
}

function cancel_(id) {
  var booking = find_(id);
  if (booking.status === 'cancelled') {
    return { ok: true, booking: publicBooking_(booking) };
  }
  getSheet_().getRange(booking.row, 12).setValue('cancelled');
  booking.status = 'cancelled';
  return { ok: true, booking: publicBooking_(booking) };
}

function reschedule_(payload) {
  var booking = find_(payload.bookingId || payload.id);
  if (booking.status === 'cancelled') throw new Error('This booking is cancelled. Book a new hour instead.');
  var date = clean_(payload.date, 10);
  var time = clean_(payload.time, 5);
  assertSlot_(date, time);
  var rows = readAll_(getSheet_());
  if (taken_(rows, date, time, booking.id) >= CAPACITY) {
    throw new Error('That hour is full (8 of 8 spots taken). Choose another hour.');
  }
  var end = endFor_(time);
  var sheet = getSheet_();
  sheet.getRange(booking.row, 9, 1, 3).setNumberFormat('@');
  sheet.getRange(booking.row, 9, 1, 3).setValues([[date, time, end]]);
  booking.date = date;
  booking.time = time;
  booking.end = end;
  return { ok: true, booking: publicBooking_(booking) };
}
