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

// redirect if already logged in
auth.onAuthStateChanged(user => {
  if (user) window.location.href = 'dashboard.html';
});

// switch tab based on hash
window.addEventListener('load', () => {
  if (window.location.hash === '#register') switchTab('register');
});

function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('loginForm').style.display    = isLogin ? 'block' : 'none';
  document.getElementById('registerForm').style.display = isLogin ? 'none'  : 'block';
  document.getElementById('loginTab').classList.toggle('active', isLogin);
  document.getElementById('registerTab').classList.toggle('active', !isLogin);
  document.getElementById('loginError').textContent    = '';
  document.getElementById('registerError').textContent = '';
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait...' : (btnId === 'loginBtn' ? 'Login' : 'Create Account');
}

async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');
  errEl.textContent = '';
  setLoading('loginBtn', true);
  try {
    await auth.signInWithEmailAndPassword(email, password);
    window.location.href = 'dashboard.html';
  } catch (err) {
    errEl.textContent = friendlyError(err.code);
    setLoading('loginBtn', false);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name     = document.getElementById('regName').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const errEl    = document.getElementById('registerError');
  errEl.textContent = '';
  setLoading('registerBtn', true);
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    window.location.href = 'dashboard.html';
  } catch (err) {
    errEl.textContent = friendlyError(err.code);
    setLoading('registerBtn', false);
  }
}

function friendlyError(code) {
  const map = {
    'auth/email-already-in-use':    'This email is already registered.',
    'auth/invalid-email':           'Invalid email address.',
    'auth/weak-password':           'Password must be at least 6 characters.',
    'auth/user-not-found':          'No account found with this email.',
    'auth/wrong-password':          'Incorrect password.',
    'auth/too-many-requests':       'Too many attempts. Try again later.',
    'auth/invalid-credential':      'Invalid email or password.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}
