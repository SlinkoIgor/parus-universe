import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// A small DOM boundary for readouts: replacing children invalidates endpoints,
// and changing CharacterData resets their offsets, as in the browser. Actual
// mouse drags and HTML layout are also checked separately in Chrome.
const selection = {
  anchorNode: null, anchorOffset: 0, focusNode: null, focusOffset: 0,
  get rangeCount() { return this.anchorNode ? 1 : 0; },
  setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset) {
    assert.ok(anchorOffset >= 0 && anchorOffset <= (anchorNode.nodeType === 3 ? anchorNode.length : anchorNode.childNodes.length));
    assert.ok(focusOffset >= 0 && focusOffset <= (focusNode.nodeType === 3 ? focusNode.length : focusNode.childNodes.length));
    Object.assign(this, { anchorNode, anchorOffset, focusNode, focusOffset });
  },
  removeAllRanges() { this.anchorNode = this.focusNode = null; },
  toString() {
    if (!this.rangeCount) return '';
    const a = position(body, this.anchorNode, this.anchorOffset), b = position(body, this.focusNode, this.focusOffset);
    return body.textContent.slice(Math.min(a, b), Math.max(a, b));
  },
};
function position(root, node, offset) {
  if (root === node) return root.nodeType === 3 ? offset : root.childNodes.slice(0, offset).reduce((n, c) => n + c.textContent.length, 0);
  let length = 0;
  for (const child of root.childNodes || []) {
    if (child.contains(node)) return length + position(child, node, offset);
    length += child.textContent.length;
  }
  throw Error('Endpoint outside readout');
}
class Text {
  nodeType = 3; nodeName = '#text';
  constructor(value) { this.value = value; }
  contains(node) { return this === node; }
  get length() { return this.value.length; }
  get nodeValue() { return this.value; }
  set nodeValue(value) {
    this.value = value;
    for (const end of ['anchor', 'focus']) if (selection[end + 'Node'] === this) selection[end + 'Offset'] = 0;
  }
  get textContent() { return this.value; }
  get innerHTML() { return this.value; }
  cloneNode() { return new Text(this.value); }
}
class Readout {
  nodeType = 1; nodeValue = null; childNodes = []; attrs = new Map(); writes = 0;
  constructor(name = 'div') { this.nodeName = name.toUpperCase(); }
  get firstChild() { return this.childNodes[0]; }
  get lastChild() { return this.childNodes.at(-1); }
  contains(node) { return this === node || this.childNodes.some(child => child.contains(node)); }
  get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
  hasAttribute(name) { return this.attrs.has(name); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  setAttribute(name, value) { this.attrs.set(name, value); }
  removeAttribute(name) { this.attrs.delete(name); }
  appendChild(node) { this.childNodes.push(node); return node; }
  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    for (const end of ['anchor', 'focus']) if (node.contains(selection[end + 'Node'])) {
      selection[end + 'Node'] = this; selection[end + 'Offset'] = index;
    }
    this.childNodes.splice(index, 1);
  }
  replaceChild(next, old) { const i = this.childNodes.indexOf(old); this.removeChild(old); this.childNodes.splice(i, 0, next); }
  cloneNode(deep) {
    const node = new Readout(this.nodeName); node.attrs = new Map(this.attrs);
    if (deep) node.childNodes = this.childNodes.map(child => child.cloneNode(true));
    return node;
  }
  get textContent() { return this.childNodes.map(child => child.textContent).join(''); }
  set textContent(value) {
    this.writes++;
    while (this.lastChild) this.removeChild(this.lastChild);
    if (value) this.appendChild(new Text(value));
  }
  get innerHTML() {
    return this.childNodes.map(child => child.nodeType === 3 ? child.nodeValue :
      '<' + child.nodeName.toLowerCase() + [...child.attrs].map(([k, v]) => ' ' + k + '="' + v + '"').join('') + '>' +
      (child.nodeName === 'BR' ? '' : child.innerHTML + '</' + child.nodeName.toLowerCase() + '>')).join('');
  }
  set innerHTML(value) {
    this.textContent = '';
    const stack = [this];
    for (const token of value.match(/<[^>]+>|[^<]+/g) || []) {
      if (token.startsWith('</')) stack.pop();
      else if (token.startsWith('<')) {
        const node = new Readout(token.match(/^<(\w+)/)[1]);
        for (const [, name, value] of token.matchAll(/([\w-]+)="([^"]*)"/g)) node.setAttribute(name, value);
        stack.at(-1).appendChild(node);
        if (node.nodeName !== 'BR') stack.push(node);
      } else stack.at(-1).appendChild(new Text(token));
    }
  }
}
const body = new Readout();
const document = {
  documentElement: { dataset: { theme: 'dark' } }, getSelection: () => selection,
  createRange: () => ({
    selectNodeContents(root) { this.root = root; },
    setEnd(node, offset) { this.end = position(this.root, node, offset); },
    toString() { return this.root.textContent.slice(0, this.end); },
  }),
  createTreeWalker(root) {
    const nodes = [], visit = node => { if (node.nodeType === 3) nodes.push(node); else node.childNodes.forEach(visit); };
    visit(root); return { nextNode: () => nodes.shift() || null };
  },
};
const context = vm.createContext({ document });
vm.runInContext(fs.readFileSync('dist/app-utils.js', 'utf8'), context);
const { UIContent: ui, UIPatch: batch } = vm.runInContext('({UIContent, UIPatch})', context);
const name = body.appendChild(new Readout()), clock = body.appendChild(new Readout()), velocity = body.appendChild(new Readout());
ui.text(name, 'Альфа Центавра A');
ui.html(velocity, '99,90<br/><small>% c</small>');
for (let i = 0; i < 30; i++) {
  ui.text(name, 'Альфа Центавра A');
  ui.html(velocity, '99,90<br/><small>% c</small>');
}
assert.equal(name.writes, 1, 'unchanged names keep their text nodes');
assert.equal(velocity.writes, 1, 'normalised markup is not rebuilt on every frame');

selection.setBaseAndExtent(name.firstChild, 0, velocity.lastChild.firstChild, 3);
const nameText = name.firstChild, speedText = velocity.firstChild, unit = velocity.lastChild;
for (let year = 1; year <= 30; year++) {
  ui.text(name, 'Следующая цель ' + year);
  ui.html(velocity, year + '<br/><small>% c</small>');
  ui.text(clock, year);
  assert.equal(name.textContent, 'Следующая цель ' + year, 'selected names update immediately');
  assert.equal(velocity.textContent, year + '% c', 'selected HTML updates immediately');
  assert.equal(clock.textContent, String(year), 'unselected telemetry keeps updating');
}
assert.equal(name.firstChild, nameText, 'the mouse anchor stays attached to its text node');
assert.equal(velocity.firstChild, speedText);
assert.equal(velocity.lastChild, unit);
assert.equal(selection.anchorNode, nameText);
assert.equal(selection.focusNode, unit.firstChild);
assert.equal(selection.toString(), 'Следующая цель 303030% c', 'a selection across several readouts stays intact');

ui.text(clock, '99');
const clockText = clock.firstChild;
selection.setBaseAndExtent(clockText, 2, clockText, 0);
ui.text(clock, '1000');
assert.equal(selection.toString(), '1000', 'backward whole-number selection expands with new digits');
assert.equal(selection.anchorOffset, 4);
assert.equal(selection.focusOffset, 0);
ui.text(clock, '7');
assert.equal(selection.toString(), '7', 'selection also follows shorter numbers');
selection.setBaseAndExtent(clockText, 1, clockText, 1);
ui.text(clock, '12');
assert.equal(selection.anchorOffset, 2, 'a collapsed mouse-drag anchor survives an update');

selection.setBaseAndExtent(unit.firstChild, 0, unit.firstChild, 3);
ui.html(velocity, '1000<br/><small class="unit">% c</small>');
assert.equal(selection.toString(), '% c', 'selecting the unit is independent of the number length');
assert.equal(velocity.lastChild, unit);
assert.equal(unit.getAttribute('class'), 'unit', 'selected markup attributes update too');
ui.html(velocity, '7<br/><small>% c</small>');
assert.equal(unit.hasAttribute('class'), false);
assert.equal(selection.toString(), '% c');

selection.setBaseAndExtent(velocity, 0, velocity, velocity.childNodes.length);
ui.html(velocity, '<b>Новый</b> текст');
assert.equal(velocity.innerHTML, '<b>Новый</b> текст');
assert.equal(selection.toString(), 'Новый текст', 'element endpoints survive structural changes');
ui.text(velocity, '');
assert.equal(selection.toString(), '', 'removing selected content applies immediately');
assert.equal(velocity.childNodes.length, 0);
ui.text(velocity, 'Возобновлено');
assert.equal(velocity.textContent, 'Возобновлено', 'an empty selected readout keeps updating');

selection.setBaseAndExtent(name.firstChild, 4, clockText, clockText.length);
const outside = selection.anchorNode, outsideOffset = selection.anchorOffset;
batch.begin();
ui.text(clock, '12345');
ui.text(clock, '123456');
assert.equal(clock.textContent, '12', 'batching still waits for the render commit');
batch.end();
assert.equal(clock.textContent, '123456');
assert.equal(selection.anchorNode, outside, 'updating one endpoint leaves the other readout alone');
assert.equal(selection.anchorOffset, outsideOffset);
assert.equal(selection.focusOffset, 6);
selection.removeAllRanges();
ui.text(clock, '987');
assert.equal(clock.textContent, '987', 'clearing selection cannot restore an older value');
console.log('PASS stable DOM, immediate selected text/HTML, cross-readout and backward selections, digit changes, units, structural changes, empty content and render batching');
