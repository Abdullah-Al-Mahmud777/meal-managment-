// ---- Firebase Setup ----
const firebaseConfig = {
  apiKey: "AIzaSyB5uhdUxfCnybiXPBrTNz_wnecH8WD-PTY",
  authDomain: "meal-2fb00.firebaseapp.com",
  databaseURL: "https://meal-2fb00-default-rtdb.firebaseio.com",
  projectId: "meal-2fb00",
  storageBucket: "meal-2fb00.firebasestorage.app",
  messagingSenderId: "975194604373",
  appId: "1:975194604373:web:aee3bb5480e19a1a1065dc"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.database();

// Auth guard — redirect to login if not logged in
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    const nameEl = document.getElementById('userNameDisplay');
    if (nameEl) nameEl.textContent = user.displayName || user.email;
    const dbRef = db.ref('mealApp/' + user.uid);
    initApp(dbRef);
  }
});

function logout() {
  auth.signOut().then(() => window.location.href = 'login.html');
}

// ---- App Init (called after auth) ----
function initApp(dbRef) {

// ---- State ----
let state = {
  users: [],
  meals: [],
  deposits: [],
  mealRate: null
};

function save() {
  dbRef.set(state);
}

// ---- Load from Firebase & init ----
function loadAndInit() {
  showSyncStatus('Connecting...');
  dbRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      state = data;
      state.users    = state.users    || [];
      state.meals    = state.meals    || [];
      state.deposits = state.deposits || [];
      state.mealRate = state.mealRate || null;
    }
    document.getElementById('mealRate').value  = state.mealRate || '';
    document.getElementById('mealDate').value  = new Date().toISOString().split('T')[0];
    document.getElementById('pdfMonth').value  = new Date().toISOString().slice(0, 7);
    populateSelects();
    render();
    showSyncStatus('Synced ✓', true);
  });
}

function showSyncStatus(msg, ok = false) {
  let el = document.getElementById('syncStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = 'sync-status ' + (ok ? 'sync-ok' : 'sync-loading');
}

// ---- Toast ----
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ---- Populate Selects ----
function populateSelects() {
  ['depositUser', 'mealUser', 'filterUser'].forEach(id => {
    const el = document.getElementById(id);
    const prev = el.value;
    el.innerHTML = id === 'filterUser' ? '<option value="">All Users</option>' : '';
    state.users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.name;
      el.appendChild(opt);
    });
    if (prev) el.value = prev;
  });
}

// ---- Add User ----
function addUser() {
  const name = document.getElementById('userName').value.trim();
  if (!name) return toast('Please enter a user name');
  if (state.users.find(u => u.name.toLowerCase() === name.toLowerCase()))
    return toast('User already exists');
  state.users.push({ id: Date.now().toString(), name });
  save();
  document.getElementById('userName').value = '';
  populateSelects();
  render();
  toast(`User "${name}" added`);
}

// ---- Add Deposit ----
function addDeposit() {
  const userId = document.getElementById('depositUser').value;
  const amount = parseFloat(document.getElementById('depositAmount').value);
  if (!userId) return toast('Select a user');
  if (!amount || amount <= 0) return toast('Enter a valid amount');
  state.deposits.push({ id: Date.now().toString(), userId, amount, date: new Date().toLocaleDateString('en-GB') });
  save();
  document.getElementById('depositAmount').value = '';
  render();
  toast('Deposit added');
}

// ---- Add Meal ----
function addMeal() {
  const userId = document.getElementById('mealUser').value;
  const date = document.getElementById('mealDate').value;
  const lunch = document.getElementById('lunchCheck').checked;
  const dinner = document.getElementById('dinnerCheck').checked;
  if (!userId) return toast('Select a user');
  if (!date) return toast('Select a date');
  if (!lunch && !dinner) return toast('Select at least Lunch or Dinner');

  // Check duplicate
  const dup = state.meals.find(m => m.userId === userId && m.date === date);
  if (dup) {
    dup.lunch = lunch;
    dup.dinner = dinner;
    toast('Meal updated for this date');
  } else {
    state.meals.push({ id: Date.now().toString(), userId, date, lunch, dinner });
    toast('Meal added');
  }
  save();
  document.getElementById('lunchCheck').checked = false;
  document.getElementById('dinnerCheck').checked = false;
  render();
}

// ---- Update Rates ----
function updateRates() {
  const val = document.getElementById('mealRate').value.trim();
  if (val === '') {
    state.mealRate = null;
    save(); render();
    return toast('Meal rate cleared');
  }
  const r = parseFloat(val);
  if (isNaN(r) || r <= 0) return toast('Enter a valid amount');
  state.mealRate = r;
  save(); render();
  toast('Meal rate set to ৳' + r);
}

// ---- Delete Meal ----
function deleteMeal(id) {
  state.meals = state.meals.filter(m => m.id !== id);
  save(); render(); toast('Meal removed');
}

// ---- Delete Deposit ----
function deleteDeposit(id) {
  state.deposits = state.deposits.filter(d => d.id !== id);
  save(); render(); toast('Deposit removed');
}

// ---- Delete User ----
function deleteUser(id) {
  const user = state.users.find(u => u.id === id);
  if (!confirm(`Delete user "${user.name}"? This will also remove their meals and deposits.`)) return;
  state.users = state.users.filter(u => u.id !== id);
  state.meals = state.meals.filter(m => m.userId !== id);
  state.deposits = state.deposits.filter(d => d.userId !== id);
  save();
  populateSelects();
  render();
  toast(`User "${user.name}" deleted`);
}

// ---- Render Summary ----
function renderSummary() {
  const tbody = document.getElementById('summaryBody');
  const tfoot = document.getElementById('summaryFoot');
  tbody.innerHTML = '';

  const hasRate = state.mealRate !== null && state.mealRate > 0;
  let totalLunch = 0, totalDinner = 0, totalMeals = 0, totalCost = 0, totalDeposit = 0;

  // update thead dynamically
  const thead = document.querySelector('#summaryTable thead tr');
  thead.innerHTML = `
    <th>#</th>
    <th>User</th>
    <th>Lunch</th>
    <th>Dinner</th>
    <th>Total Meals</th>
    ${hasRate ? '<th>Meal Cost (৳)</th>' : ''}
    <th>Deposited (৳)</th>
    ${hasRate ? '<th>Balance (৳)</th>' : ''}
    <th>Action</th>`;

  state.users.forEach(u => {
    const userMeals = state.meals.filter(m => m.userId === u.id);
    const lunch = userMeals.filter(m => m.lunch).length;
    const dinner = userMeals.filter(m => m.dinner).length;
    const meals = lunch + dinner;
    const cost = hasRate ? meals * state.mealRate : 0;
    const deposited = state.deposits.filter(d => d.userId === u.id).reduce((s, d) => s + d.amount, 0);
    const balance = deposited - cost;

    totalLunch += lunch; totalDinner += dinner;
    totalMeals += meals; totalCost += cost; totalDeposit += deposited;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${tbody.children.length + 1}</td>
      <td>${u.name}</td>
      <td>${lunch}</td>
      <td>${dinner}</td>
      <td><span class="badge">${meals}</span></td>
      ${hasRate ? `<td>৳${cost.toFixed(2)}</td>` : ''}
      <td>৳${deposited.toFixed(2)}</td>
      ${hasRate ? `<td class="${balance < 0 ? 'bal-neg' : 'bal-pos'}">${balance < 0 ? '-৳' + Math.abs(balance).toFixed(2) : '৳' + balance.toFixed(2)}</td>` : ''}
      <td><button class="btn btn-danger" onclick="deleteUser('${u.id}')">Delete</button></td>`;
    tbody.appendChild(tr);
  });

  const totalBalance = totalDeposit - totalCost;
  tfoot.innerHTML = `<tr>
    <td></td>
    <td>Total</td>
    <td>${totalLunch}</td>
    <td>${totalDinner}</td>
    <td><span class="badge">${totalMeals}</span></td>
    ${hasRate ? `<td>৳${totalCost.toFixed(2)}</td>` : ''}
    <td>৳${totalDeposit.toFixed(2)}</td>
    ${hasRate ? `<td class="${totalBalance < 0 ? 'bal-neg' : 'bal-pos'}">${totalBalance < 0 ? '-৳' + Math.abs(totalBalance).toFixed(2) : '৳' + totalBalance.toFixed(2)}</td>` : ''}
    <td></td>
  </tr>`;

  // rate info
  const ri = document.getElementById('rateInfo');
  if (ri) ri.innerHTML = hasRate
    ? `<span>⚡ Per Meal Rate: <strong>৳${state.mealRate}</strong></span>`
    : `<span style="color:#94a3b8">Rate not set — Meal Cost & Balance hidden</span>`;
}

// ---- Render Meal Log ----
function renderMealLog() {
  const filterUser = document.getElementById('filterUser').value;
  const tbody = document.getElementById('mealLogBody');
  tbody.innerHTML = '';

  const filtered = state.meals
    .filter(m => !filterUser || m.userId === filterUser)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  filtered.forEach(m => {
    const user = state.users.find(u => u.id === m.userId);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.date}</td>
      <td>${user ? user.name : 'Unknown'}</td>
      <td>${m.lunch ? '✅' : '—'}</td>
      <td>${m.dinner ? '✅' : '—'}</td>
      <td><button class="btn btn-danger" onclick="deleteMeal('${m.id}')">Delete</button></td>`;
    tbody.appendChild(tr);
  });

  if (!filtered.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No meals found</td></tr>';
  }
}

// ---- Render Deposit Log ----
function renderDepositLog() {
  const tbody = document.getElementById('depositLogBody');
  tbody.innerHTML = '';

  const sorted = [...state.deposits].sort((a, b) => b.id - a.id);
  sorted.forEach(d => {
    const user = state.users.find(u => u.id === d.userId);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${user ? user.name : 'Unknown'}</td>
      <td>৳${d.amount.toFixed(2)}</td>
      <td>${d.date}</td>
      <td><button class="btn btn-danger" onclick="deleteDeposit('${d.id}')">Delete</button></td>`;
    tbody.appendChild(tr);
  });

  if (!sorted.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No deposits yet</td></tr>';
  }
}

// ---- Generate PDF ----
function generatePDF(fullReport = false) {
  const monthVal = document.getElementById('pdfMonth').value;
  if (!fullReport && !monthVal) return toast('Please select a month');

  let year, month, monthName, reportTitle, fileName;

  if (fullReport) {
    reportTitle = 'Full Meal Report — All Time';
    fileName = 'Meal-Report-Full.pdf';
  } else {
    [year, month] = monthVal.split('-').map(Number);
    monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    reportTitle = 'Meal Management Report';
    fileName = `Meal-Report-${monthVal}.pdf`;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(reportTitle, pageW / 2, 12, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(fullReport ? 'All Records' : monthName, pageW / 2, 22, { align: 'center' });
  y = 36;

  // Rate info
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  const rateText = state.mealRate ? `Per Meal Rate: BDT ${state.mealRate}` : 'Meal Rate: Not Set';
  doc.text(rateText, 14, y);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageW - 14, y, { align: 'right' });
  y += 8;

  const hasRate = state.mealRate > 0;

  // filter helper
  const filterByMonth = (date) => {
    if (fullReport) return true;
    const d = new Date(date);
    return d.getFullYear() === year && (d.getMonth() + 1) === month;
  };

  const filterDepositByMonth = (dateStr) => {
    if (fullReport) return true;
    const parts = dateStr.split('/');
    return parseInt(parts[1]) === month && parseInt(parts[2]) === year;
  };

  // ---- Summary Table ----
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Summary', 14, y);
  y += 4;

  const summaryHead = [['#', 'User', 'Lunch', 'Dinner', 'Total Meals',
    ...(hasRate ? ['Meal Cost (BDT)', 'Deposited (BDT)', 'Balance (BDT)'] : ['Deposited (BDT)'])]];
  const summaryRows = [];
  let tLunch = 0, tDinner = 0, tMeals = 0, tCost = 0, tDeposit = 0;

  state.users.forEach((u, i) => {
    const userMeals = state.meals.filter(m => m.userId === u.id && filterByMonth(m.date));
    const lunch = userMeals.filter(m => m.lunch).length;
    const dinner = userMeals.filter(m => m.dinner).length;
    const meals = lunch + dinner;
    const cost = hasRate ? meals * state.mealRate : 0;
    const deposited = state.deposits
      .filter(d => d.userId === u.id && filterDepositByMonth(d.date))
      .reduce((s, d) => s + d.amount, 0);
    const balance = deposited - cost;

    tLunch += lunch; tDinner += dinner; tMeals += meals; tCost += cost; tDeposit += deposited;

    summaryRows.push([
      i + 1, u.name, lunch, dinner, meals,
      ...(hasRate ? [
        'BDT ' + cost.toFixed(2),
        'BDT ' + deposited.toFixed(2),
        (balance < 0 ? '-BDT ' : 'BDT ') + Math.abs(balance).toFixed(2)
      ] : ['BDT ' + deposited.toFixed(2)])
    ]);
  });

  const tBalance = tDeposit - tCost;
  summaryRows.push([
    '', 'TOTAL', tLunch, tDinner, tMeals,
    ...(hasRate ? [
      'BDT ' + tCost.toFixed(2),
      'BDT ' + tDeposit.toFixed(2),
      (tBalance < 0 ? '-BDT ' : 'BDT ') + Math.abs(tBalance).toFixed(2)
    ] : ['BDT ' + tDeposit.toFixed(2)])
  ]);

  doc.autoTable({
    startY: y,
    head: summaryHead,
    body: summaryRows,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [245, 247, 255] },
    didParseCell(data) {
      if (data.row.index === summaryRows.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [199, 210, 254];
      }
    },
    margin: { left: 14, right: 14 }
  });
  y = doc.lastAutoTable.finalY + 10;

  // ---- Meal Log ----
  const filteredMeals = state.meals
    .filter(m => filterByMonth(m.date))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (filteredMeals.length) {
    if (y > 240) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('Meal Log', 14, y);
    y += 4;

    doc.autoTable({
      startY: y,
      head: [['Date', 'User', 'Lunch', 'Dinner']],
      body: filteredMeals.map(m => {
        const u = state.users.find(u => u.id === m.userId);
        return [m.date, u ? u.name : 'Unknown', m.lunch ? 'Yes' : 'No', m.dinner ? 'Yes' : 'No'];
      }),
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      margin: { left: 14, right: 14 }
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // ---- Deposit Log ----
  const filteredDeposits = state.deposits
    .filter(d => filterDepositByMonth(d.date))
    .sort((a, b) => b.id - a.id);

  if (filteredDeposits.length) {
    if (y > 240) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('Deposit Log', 14, y);
    y += 4;

    doc.autoTable({
      startY: y,
      head: [['User', 'Amount (BDT)', 'Date']],
      body: filteredDeposits.map(d => {
        const u = state.users.find(u => u.id === d.userId);
        return [u ? u.name : 'Unknown', 'BDT ' + d.amount.toFixed(2), d.date];
      }),
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [255, 251, 235] },
      margin: { left: 14, right: 14 }
    });
  }

  // Footer
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pages}  |  MealManager`, pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
  }

  doc.save(fileName);
  toast('PDF downloaded');
}


function render() {
  renderSummary();
  renderMealLog();
  renderDepositLog();
}

// ---- Filter listener ----
document.getElementById('filterUser').addEventListener('change', renderMealLog);

// ---- Init ----
loadAndInit();

} // end initApp
