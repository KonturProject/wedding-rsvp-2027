/**
 * Совместная свадебная смета: Google Apps Script backend.
 * Владелец проекта один раз запускает setupBudgetStorage(),
 * затем развёртывает проект как Web App: Execute as Me, Access Anyone.
 * Секретные ключи остаются в Script Properties.
 */
const BUDGET_SHEET_ID = '1qfZuxRy4TiRFFEBr8w6lipKFdZ8D1HkVE2d8vlKiF_g';
const BUDGET_SHEET_NAME = 'Смета_синхронизация';
const CHUNK_LEN = 35000;

function setupBudgetStorage() {
  const sheet = SpreadsheetApp.openById(BUDGET_SHEET_ID).getSheetByName(BUDGET_SHEET_NAME);
  if (!sheet) throw new Error('Не найден отдельный лист Смета_синхронизация');
  const props = PropertiesService.getScriptProperties();
  const keys = {};
  for (const who of ['IGNAT','LERA']) {
    const name = 'BUDGET_KEY_' + who;
    let key = props.getProperty(name);
    if (!key) {
      key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g,'');
      props.setProperty(name,key);
    }
    keys[who] = key;
  }
  Logger.log('Ключ Игната: ' + keys.IGNAT);
  Logger.log('Ключ Леры: ' + keys.LERA);
  Logger.log('Не размещайте ключи в GitHub, комментариях или публичных ссылках.');
  return 'Ключи созданы. Откройте журнал выполнения для их получения.';
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Наша свадьба · общая смета')
    .addMetaTag('viewport','width=device-width, initial-scale=1');
}

function identify_(key) {
  if (typeof key !== 'string' || key.length < 4 || key.length > 128) throw new Error('Неверный ключ доступа');
  const props = PropertiesService.getScriptProperties();
  const secrets = [['IGNAT','Игнат'],['LERA','Лера']];
  const digest = s => Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s);
  const incoming = digest(key);
  let person = '';
  for (const pair of secrets) {
    const secret = props.getProperty('BUDGET_KEY_' + pair[0]);
    if (!secret) continue;
    const expected = digest(secret);
    let mismatch = 0;
    incoming.forEach((b,i) => mismatch |= b ^ expected[i]);
    if (!mismatch) person = pair[1];
  }
  if (!person) throw new Error('Неверный ключ доступа');
  return person;
}

function budgetSheet_() {
  const sheet = SpreadsheetApp.openById(BUDGET_SHEET_ID).getSheetByName(BUDGET_SHEET_NAME);
  if (!sheet) throw new Error('Хранилище не найдено');
  return sheet;
}

function readBudget_() {
  const sheet=budgetSheet_();
  const version=Number(sheet.getRange(2,1).getValue()) || 1;
  const updated=String(sheet.getRange(2,2).getDisplayValue() || '');
  const editor=String(sheet.getRange(2,3).getValue() || '');
  const chunks=sheet.getRange(2,4,Math.max(1,sheet.getLastRow()-1),1)
    .getValues().map(r=>String(r[0]||'')).filter(Boolean);
  if (!chunks.length) throw new Error('Пустая смета');
  const encoded=chunks.join('');
  const json=encoded.charAt(0)==='{' ? encoded :
    Utilities.newBlob(Utilities.base64DecodeWebSafe(encoded)).getDataAsString('UTF-8');
  const state=JSON.parse(json);
  if (!state || !Array.isArray(state.expenses) || !Array.isArray(state.offers) || !Array.isArray(state.checklist)) {
    throw new Error('В хранилище повреждены данные');
  }
  return {version:version,updated:updated,editor:editor,state:state};
}

function loadBudget(key) {
  const editor=identify_(key);
  const data=readBudget_();
  return {version:data.version,updated:data.updated,editor:data.editor,state:data.state,accessAs:editor};
}

function saveBudget(key,expectedVersion,state) {
  const editor=identify_(key);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new Error('Неверная версия');
  if (!state || !Array.isArray(state.expenses) || !Array.isArray(state.offers) || !Array.isArray(state.checklist)) {
    throw new Error('Неверный формат сметы');
  }
  const json=JSON.stringify(state);
  if (json.length > 450000) throw new Error('Слишком много данных в смете');
  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const current=readBudget_();
    if (current.version!==expectedVersion) throw new Error('VERSION_CONFLICT: другой участник сохранил изменения. Скачайте локальную копию и обновите данные.');
    const encoded=Utilities.base64EncodeWebSafe(Utilities.newBlob(json,'application/json').getBytes());
    const chunks=encoded.match(/.{1,35000}/g)||[''];
    const sheet=budgetSheet_();
    const oldCount=Math.max(1,sheet.getLastRow()-1);
    if (chunks.length > sheet.getMaxRows()-1) sheet.insertRowsAfter(sheet.getMaxRows(),chunks.length-(sheet.getMaxRows()-1));
    sheet.getRange(2,4,Math.max(chunks.length,oldCount),1).clearContent();
    sheet.getRange(2,4,chunks.length,1).setValues(chunks.map(t=>[t]));
    const next=expectedVersion+1;
    sheet.getRange(2,1,1,3).setValues([[next,new Date(),editor]]);
    sheet.getRange(2,5).setValue('База сметы, доступ по двум раздельным ключам');
    SpreadsheetApp.flush();
    return {version:next,updated:new Date().toISOString(),editor:editor};
  } finally {lock.releaseLock();}
}
