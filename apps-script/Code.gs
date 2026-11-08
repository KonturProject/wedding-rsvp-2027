/* Server configuration lives only in Apps Script > Project settings > Script properties.
 * SPREADSHEET_ID, ADMIN_KEY (random, at least 24 characters), PUBLIC_URL (GitHub Pages URL).
 */
const HEADERS_ = ['ID', 'Ключ приглашения', 'Имя', 'Приглашён на регистрацию', '17.07 Москва', '24.07 Переславль', 'Трансфер', 'Проживание', 'Комментарий', 'Обновлено'];
function doGet(e) {
  const t = HtmlService.createTemplateFromFile('App');
  t.boot = JSON.stringify({invite: String((e.parameter || {}).invite || ''), admin: (e.parameter || {}).admin === '1'}).replace(/</g, '\\u003c');
  return t.evaluate().setTitle('Наша свадьба · июль 2027').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function config_() {
  const p = PropertiesService.getScriptProperties().getProperties();
  if (!p.SPREADSHEET_ID || !p.ADMIN_KEY || p.ADMIN_KEY.length < 24) throw new Error('Сервер ещё не настроен.');
  return p;
}
function sheet_() {
  const s = SpreadsheetApp.openById(config_().SPREADSHEET_ID).getSheetByName('RSVP_Гости');
  if (!s || s.getRange(1, 1, 1, HEADERS_.length).getValues()[0].join('|') !== HEADERS_.join('|')) throw new Error('Запустите install в редакторе Apps Script.');
  return s;
}
function install() {
  const book = SpreadsheetApp.openById(config_().SPREADSHEET_ID);
  if (book.getSheetByName('RSVP_Гости')) { sheet_(); return 'Уже установлено'; }
  const s = book.insertSheet('RSVP_Гости');
  s.getRange(1, 1, 1, HEADERS_.length).setValues([HEADERS_]).setBackground('#465840').setFontColor('#ffffff').setFontWeight('bold');
  s.setFrozenRows(1); s.setColumnWidth(3, 220); s.setColumnWidth(9, 320); s.hideColumns(2);
  return 'Готово: RSVP_Гости создан. Другие листы не изменены.';
}
function all_() { const s = sheet_(); return s.getLastRow() < 2 ? [] : s.getRange(2, 1, s.getLastRow() - 1, HEADERS_.length).getValues(); }
function text_(value, max) { const v = String(value == null ? '' : value).trim(); if (v.length > max) throw new Error('Слишком длинное поле'); return v; }
function safe_(v) { return /^[=+@\-\t\r]/.test(v) ? "'" + v : v; }
function status_(v) { if (!['Иду', 'Не иду', 'Не ответил'].includes(v)) throw new Error('Неверный ответ'); return v; }
function choice_(v) { if (!['Нужно', 'Не нужно', 'Уточню'].includes(v)) throw new Error('Неверный выбор'); return v; }
function public_(r) { return {name:r[2],registrationInvited:r[3] === true,registration:r[4],celebration:r[5],transfer:r[6],stay:r[7],note:r[8],updated:r[9] ? new Date(r[9]).toISOString() : ''}; }
function find_(token) { if (!/^[a-f0-9-]{72}$/.test(String(token))) throw new Error('Приглашение не найдено'); const rows = all_(); const i = rows.findIndex(r => r[1] === token); if (i < 0) throw new Error('Приглашение не найдено'); return {row:rows[i], index:i+2}; }
function locked_(fn) { const lock = LockService.getScriptLock(); lock.waitLock(20000); try { return fn(); } finally { lock.releaseLock(); } }
function getInvitation(token) { return public_(find_(token).row); }
function saveReply(token, data) {
  return locked_(() => {
    const found = find_(token), r = found.row;
    r[4] = r[3] === true ? status_(data.registration) : 'Не приглашён';
    r[5] = status_(data.celebration); r[6] = choice_(data.transfer); r[7] = choice_(data.stay);
    r[8] = safe_(text_(data.note, 500)); r[9] = new Date();
    sheet_().getRange(found.index, 1, 1, HEADERS_.length).setValues([r]);
    SpreadsheetApp.flush(); return public_(r);
  });
}
function authorize_(key) {
  const expected = config_().ADMIN_KEY;
  const hash = v => Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(v));
  const a = hash(key || ''), b = hash(expected); let mismatch = 0;
  a.forEach((v, i) => mismatch |= v ^ b[i]);
  if (mismatch) throw new Error('Неверный ключ администратора');
}
function adminAction(key, action, data) {
  authorize_(key); data = data || {};
  if (action === 'list') return all_().map(r => ({...public_(r), id:r[0], link:inviteUrl_(r[1])}));
  if (action === 'create') return locked_(() => {
    const name = text_(data.name, 120); if (!name) throw new Error('Введите имя гостя');
    const token = Utilities.getUuid() + Utilities.getUuid();
    const r = [Utilities.getUuid(),token,safe_(name),data.registrationInvited === true,'Не ответил','Не ответил','Уточню','Уточню','',new Date()];
    if (!r[3]) r[4] = 'Не приглашён';
    sheet_().appendRow(r); SpreadsheetApp.flush(); return {id:r[0],...public_(r),link:inviteUrl_(token)};
  });
  if (action === 'update') {
    const r = all_().find(r => r[0] === data.id); if (!r) throw new Error('Гость не найден');
    return saveReply(r[1], data);
  }
  throw new Error('Неизвестное действие');
}
function inviteUrl_(token) {
  const url = config_().PUBLIC_URL || ScriptApp.getService().getUrl();
  return url.replace(/\/$/, '') + (url.includes('?') ? '&' : '?') + 'invite=' + encodeURIComponent(token);
}
