window.WHENG_CONFIG = {
  supabaseUrl: 'https://bcjhwlqvytphupxpzjlj.supabase.co',
  supabasePublishableKey: 'sb_publishable_uPxC7lYV8hxyMP9Q0T5z_Q_BCTc6LUE',
  adminEmail: 'admin@wheng.local',
  phoneDisplay: '010-0000-0000',
  phoneTel: '01000000000',
  kakaoUrl: '',
  businessName: 'WHENG 생활설비',
  serviceAreas: '수원 · 화성 · 용인 · 오산 외 협의'
};

// 관리자 화면은 계정 이메일을 내부 고정값으로 사용하고 비밀번호만 입력받습니다.
document.addEventListener('DOMContentLoaded', () => {
  if (!location.pathname.endsWith('/admin.html') && !location.pathname.endsWith('admin.html')) return;

  const adminEmail = window.WHENG_CONFIG.adminEmail;
  const loginEmail = document.querySelector('#loginForm input[name="email"]');
  if (loginEmail) {
    loginEmail.value = adminEmail;
    const label = loginEmail.closest('label');
    if (label) label.classList.add('hidden');
  }

  const setupEmail = document.querySelector('#setupForm input[name="email"]');
  if (setupEmail) {
    setupEmail.value = adminEmail;
    const label = setupEmail.closest('label');
    if (label) label.classList.add('hidden');
  }

  const loginPassword = document.querySelector('#loginForm input[name="password"]');
  if (loginPassword) {
    loginPassword.value = '';
    loginPassword.placeholder = '관리자 비밀번호';
    loginPassword.autocomplete = 'current-password';
  }

  const setupText = document.querySelector('#setupForm .muted');
  if (setupText) setupText.textContent = '새 관리자 비밀번호와 WHENG 1회용 설정코드만 입력하세요.';
});
