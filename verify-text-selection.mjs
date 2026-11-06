import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Small DOM boundary: replacements invalidate selected text, as in a browser.
// No catalogues or physical plans are needed to verify content updates.
const selected = new Set(), listeners = new Map();
const selection = {
  get isCollapsed() { return selected.size === 0; },
  get rangeCount() { return selected.size ? 1 : 0; },
  getRangeAt() { return { intersectsNode: node => selected.has(node) }; },
};
class Readout {
  value = '';
  writes = 0;
  isConnected = true;
  get textContent() { return this.value; }
  set textContent(value) {
    this.value = value;
    this.writes++;
    if (selected.has(this)) selected.clear();
  }
  get innerHTML() { return this.value; }
  set innerHTML(value) {
    // Browsers normalise HTML when serialising it again.
    this.textContent = value.replace(/<br\s*\/>/g, '<br>');
  }
}
const context = vm.createContext({ document: {
  documentElement: { dataset: { theme: 'dark' } },
  getSelection: () => selection,
  addEventListener: (event, handler) => listeners.set(event, handler),
} });
vm.runInContext(fs.readFileSync('dist/app-utils.js', 'utf8'), context);
// Exercise the real event binding without starting the application.
const binding = fs.readFileSync('dist/app.js', 'utf8').match(/^document\.addEventListener\('selectionchange'.*$/m);
assert.ok(binding, 'deferred updates are connected to browser selection changes');
vm.runInContext(binding[0], context);
const ui = vm.runInContext('UIContent', context);
const name = new Readout(), clock = new Readout(), velocity = new Readout();
ui.text(name, 'Альфа Центавра A');
ui.html(velocity, '99,90<br/><small>% c</small>');
for (let i = 0; i < 30; i++) {
  ui.text(name, 'Альфа Центавра A');
  ui.html(velocity, '99,90<br/><small>% c</small>');
}
assert.equal(name.writes, 1, 'unchanged names keep their text nodes');
assert.equal(velocity.writes, 1, 'normalised markup is not rebuilt on every frame');

selected.add(name);
selected.add(velocity);
for (let year = 1; year <= 30; year++) {
  ui.text(name, 'Следующая цель ' + year);
  ui.html(velocity, year + '<small>% c</small>');
  ui.text(clock, year);
}
assert.equal(selected.size, 2, 'selection spanning readouts survives live updates');
assert.equal(name.textContent, 'Альфа Центавра A');
assert.equal(velocity.innerHTML, '99,90<br><small>% c</small>');
assert.equal(clock.textContent, '30', 'unselected telemetry continues updating');
selected.delete(name);
listeners.get('selectionchange')();
assert.equal(name.textContent, 'Следующая цель 30', 'released fragment gets the latest value');
assert.equal(selected.size, 1, 'moving selection does not release other fragments');
selected.clear();
listeners.get('selectionchange')();
assert.equal(velocity.innerHTML, '30<small>% c</small>');
assert.equal(ui.pending.size, 0);

selected.add(name);
ui.text(name, 'Отложенный прогноз');
ui.text(name, 'Следующая цель 30');
selected.clear();
listeners.get('selectionchange')();
assert.equal(name.textContent, 'Следующая цель 30', 'a superseded forecast cannot reappear');

selected.add(name);
ui.text(name, 'Удалённая карточка');
name.isConnected = false;
selected.clear();
listeners.get('selectionchange')();
assert.equal(ui.pending.size, 0, 'removed cards do not retain deferred updates');
console.log('PASS stable text/HTML, multi-readout selection, live telemetry, latest-value refresh and removed cards');
