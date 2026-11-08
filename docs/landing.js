const config = window.WEDDING_CONFIG || {};
const invite = new URLSearchParams(location.search).get('invite');
const admin = location.pathname.endsWith('admin.html');
const validBackend = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(config.backendUrl || '');
const state = document.querySelector('#state');
if (validBackend && (admin || invite)) {
  const target = new URL(config.backendUrl);
  target.searchParams.set(admin ? 'admin' : 'invite', admin ? '1' : invite);
  const link = document.querySelector('#rsvp');link.href=target.href;link.textContent=admin?'Открыть админку':'Ответить на приглашение';link.classList.remove('hidden');
  state.textContent=admin?'Вход по ключу организатора.':'Анкета откроется на защищённой странице Google.';
  document.querySelector('#demo').classList.add('hidden');
} else if (!validBackend) {
  state.textContent='Прототип опубликован. Приём реальных ответов появится после подключения серверной части.';
} else state.textContent='Для ответа откройте личную ссылку, которую прислали организаторы.';
