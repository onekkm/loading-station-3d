import './style.css';
import { components, warehouse } from './model.js';
import { createViewer } from './viewer.js';

const paths = {
  cube: '<path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z"/><path d="m3 7 9 5 9-5M12 12v10"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  inbound: '<path d="M14 4h6v16h-6M4 12h11m-4-4 4 4-4 4"/>',
  outbound: '<path d="M10 4H4v16h6m-1-8h11m-4-4 4 4-4 4"/>',
  crane: '<path d="M3 5h18M4 5v3h16V5m-8 3v6m0 0c-3 0-3 4 0 4 1.4 0 2-.9 2-2M6 3v2m12-2v2"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  gantry: '<path d="M3 20V6h18v14M2 6h20M12 6v7m0 0c-2 0-2 3 0 3 1.1 0 1.7-.5 1.7-1.3M3 10l4-4m14 4-4-4"/>',
  conveyor: '<rect x="3" y="7" width="18" height="7" rx="3.5"/><path d="M6 14v4m12-4v4M7 10.5h.01m5 0h.01m5 0h.01"/>',
  transfer: '<path d="M6 3v18M18 3v18M4 6h16M4 12h16M4 18h16"/><rect x="8.5" y="9" width="7" height="6" rx="1"/>',
  rack: '<path d="M4 3v18M20 3v18M4 5h16M4 10h16M4 15h16M4 20h16M12 5v15"/>',
  stacker: '<path d="M3 21h18M10 21V3h4v18M7 3h10M10 12H5v4h5m4 0h5M6 21v-2m12 2v-2"/>',
  fence: '<path d="M3 5v14M21 5v14M3 6h18M3 17h18M8 6v11m4-11v11m4-11v11M3 11.5h18"/>',
  site: '<path d="m12 5 9 5-9 5-9-5 9-5Zm-9 5v4l9 5 9-5v-4M12 15v4"/>',
  wall: '<path d="M3 21V6l9-3 9 3v15H3Zm4 0v-8h5v8m4-12h2m-2 4h2m-2 4h2M7 9h4"/>',
  eye: '<path d="M2.5 12s3.4-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.4 5.5-9.5 5.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.25"/>',
  eyeOff: '<path d="m3 3 18 18M9.7 6.7a10.7 10.7 0 0 1 2.3-.2c6.1 0 9.5 5.5 9.5 5.5a15 15 0 0 1-3.4 3.5M6.2 8.4A15.6 15.6 0 0 0 2.5 12s3.4 5.5 9.5 5.5c1 0 2-.2 2.8-.4"/>',
  reset: '<path d="M4 11a8 8 0 1 1 2.2 6.5M4 5v6h6"/>',
  grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.2h17m-17 5.6h17M9.2 3.5v17m5.6-17v17"/>',
  expand: '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>',
  collapse: '<path d="M4 9h5V4m11 5h-5V4M9 20v-5H4m11 5v-5h5"/>',
  mouse: '<rect x="6.5" y="3" width="11" height="18" rx="5.5"/><path d="M12 6v4"/>',
  cursor: '<path d="m5 3 14 10-7 1-3 7-4-18Z"/>',
};

function icon(name, size = 19) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}

const app = document.querySelector('#app');
const flightHint = 'WASD / 方向键飞行 · E / Q 升降';
app.innerHTML = `
  <header class="app-header">
    <div class="brand">
      <div class="brand-icon">${icon('cube', 24)}</div>
      <div>
        <h1>立体仓库</h1>
        <p>三维模型预览</p>
      </div>
    </div>
    <button class="export-button" id="export" type="button">${icon('download', 17)}<span>导出 GLB</span></button>
  </header>

  <main class="workspace">
    <section class="viewport" id="viewport" aria-label="三维视口">
      <div class="stage">
        <div class="canvas-host" id="canvas-host"></div>
        <div class="view-tools">
          <div class="camera-tools">
            <div class="view-switch area-switch" role="group" aria-label="仓库区域">
              <button type="button" data-area="overview" aria-pressed="true">总览</button>
              <button type="button" data-area="inbound" aria-pressed="false">入库区</button>
              <button type="button" data-area="outbound" aria-pressed="false">出库区</button>
            </div>
            <div class="view-switch" role="group" aria-label="相机视图">
              <button type="button" data-view="iso" aria-pressed="true">轴测</button>
              <button type="button" data-view="top" aria-pressed="false">俯视</button>
              <button type="button" data-view="side" aria-pressed="false">侧视</button>
              <button type="button" data-view="avatar" aria-pressed="false" title="跟随数字人视角" disabled>跟随</button>
            </div>
            <div class="view-switch" role="group" aria-label="人物控制">
              <button type="button" id="avatar-control" aria-pressed="false" disabled>数字人</button>
            </div>
          </div>
          <div class="utility-tools" role="group" aria-label="视口工具">
            <button class="icon-button" id="reset" type="button" aria-label="恢复初始视图" title="恢复初始视图">${icon('reset', 18)}</button>
            <button class="icon-button" id="grid" type="button" aria-label="显示网格" title="显示或隐藏网格" aria-pressed="true">${icon('grid', 18)}</button>
            <button class="icon-button" id="walls" type="button" aria-label="切换仓库外墙" title="显示或隐藏仓库外墙" aria-pressed="true">${icon('wall', 18)}</button>
            <button class="icon-button" id="fullscreen" type="button" aria-label="全屏" title="全屏">${icon('expand', 18)}</button>
          </div>
        </div>
        <div class="view-switch detail-views" data-detail-area="inbound" role="group" aria-label="入库细节视图" hidden>
          <button type="button" data-view="transfer" aria-pressed="false">输送近景</button>
          <button type="button" data-view="rack-side" aria-pressed="false">货架侧面</button>
          <button type="button" data-view="manual-intake" aria-pressed="false">人工入库口</button>
        </div>
        <div class="view-switch detail-views" data-detail-area="outbound" role="group" aria-label="出库细节视图" hidden>
          <button type="button" data-view="outbound-transfer" aria-pressed="false">出库输送近景</button>
          <button type="button" data-view="outbound-rack-side" aria-pressed="false">货架端部</button>
          <button type="button" data-view="aisle-stacker" aria-pressed="false">巷道堆垛机</button>
        </div>
        <div class="stage-message" id="stage-message" hidden role="alert"></div>
        <div class="avatar-pad" id="avatar-pad" role="group" aria-label="数字人方向控制" hidden>
          <button type="button" data-step-key="ArrowUp" aria-label="前进">↑</button>
          <button type="button" data-step-key="ArrowLeft" aria-label="左移">←</button>
          <button type="button" data-step-key="ArrowDown" aria-label="后退">↓</button>
          <button type="button" data-step-key="ArrowRight" aria-label="右移">→</button>
          <button type="button" class="sprint-button" data-step-key="ShiftLeft" aria-label="按住冲刺">冲刺</button>
        </div>
        <svg class="axis-key" viewBox="0 0 71 65" role="img" aria-label="坐标轴，X 红色，Y 绿色，Z 蓝色">
          <g class="axis-x"><line x1="35" y1="35"/><text text-anchor="middle" dominant-baseline="central">X</text></g>
          <g class="axis-y"><line x1="35" y1="35"/><text text-anchor="middle" dominant-baseline="central">Y</text></g>
          <g class="axis-z"><line x1="35" y1="35"/><text text-anchor="middle" dominant-baseline="central">Z</text></g>
          <circle cx="35" cy="35" r="2" fill="#d0e1e2"/>
        </svg>
      </div>
      <footer class="viewport-footer">
        <span class="view-label"><i></i><span id="view-label">总览 · 轴测视图</span></span>
        <span class="mouse-hint">
          <span id="movement-hint">${flightHint}</span>
          <span class="mouse-gestures"><span class="hint-divider"></span>${icon('mouse', 15)}拖动旋转<span class="hint-divider"></span>滚轮缩放<span id="pan-hint"><span class="hint-divider"></span>右键平移</span></span>
        </span>
        <span class="touch-hint" id="touch-hint">单指旋转 · 双指缩放和平移</span>
        <span class="select-hint">${icon('cursor', 14)} 点击选择</span>
      </footer>
    </section>

    <aside class="sidebar" aria-label="场景对象">
      <div class="sidebar-header">
        <div>${icon('layers', 19)}<h2>场景对象</h2></div>
        <span id="object-count"></span>
      </div>
      <div class="object-list" id="objects"></div>
      <div class="info-panel" id="info" aria-live="polite"></div>
      <div class="sidebar-footer"><i></i><span id="visibility-count"></span><button type="button" id="show-all" disabled>全部显示</button></div>
    </aside>
  </main>
  <div id="toast" class="toast" role="status" hidden></div>
`;

const objectList = document.querySelector('#objects');
const info = document.querySelector('#info');
const visibilityCount = document.querySelector('#visibility-count');
const showAll = document.querySelector('#show-all');
const viewport = document.querySelector('#viewport');
const viewButtons = [...document.querySelectorAll('[data-view]')];
const detailViews = [...document.querySelectorAll('.detail-views')];
const areaButtons = [...document.querySelectorAll('[data-area]')];
const viewLabel = document.querySelector('#view-label');
const toast = document.querySelector('#toast');
const exportButton = document.querySelector('#export');
const exportLabel = exportButton.querySelector('span');
const grid = document.querySelector('#grid');
const walls = document.querySelector('#walls');
const fullscreen = document.querySelector('#fullscreen');
const avatarControl = document.querySelector('#avatar-control');
const avatarView = document.querySelector('[data-view="avatar"]');
const avatarPad = document.querySelector('#avatar-pad');
const touchHint = document.querySelector('#touch-hint');
const panHint = document.querySelector('#pan-hint');
const movementHint = document.querySelector('#movement-hint');
const viewNames = {
  iso: '轴测视图', top: '俯视图', side: '侧视图',
  transfer: '输送近景', 'rack-side': '货架侧面', 'manual-intake': '人工入库口',
  'outbound-transfer': '出库输送近景', 'outbound-rack-side': '货架端部',
  'aisle-stacker': '巷道堆垛机',
};
const areaNames = { overview: '总览', inbound: '入库区', outbound: '出库区' };
const params = new URLSearchParams(location.search);
const requestedArea = params.get('area');
const initialArea = requestedArea === 'inbound' || requestedArea === 'outbound' ? requestedArea : 'overview';
const isDetailView = (view, area) => detailViews.some((group) =>
  group.dataset.detailArea === area && [...group.children].some((button) => button.dataset.view === view));
const requestedView = params.get('view');
const initialView = isDetailView(requestedView, initialArea) ? requestedView : 'iso';
const leaves = components.flatMap((component) => component.children ?? [component]);
const entries = new Map();
const parents = new Map();
for (const component of components) {
  entries.set(component.id, component);
  for (const child of component.children ?? []) {
    entries.set(child.id, child);
    parents.set(child.id, component.id);
  }
}
const visibility = new Map(leaves.map(({ id }) => [id, true]));
const wallEntry = entries.get('walls');
visibility.set('walls', initialArea === 'overview');
let activeArea;
let selected;
let toastTimer;
let viewer;

function objectRow({ id, name, icon: symbol, color, children }) {
  return `
  <div class="object-row" data-object="${id}">
    ${children ? `<button class="object-expand" type="button" aria-label="展开${name}" aria-controls="children-${id}" aria-expanded="false">${icon('chevron', 13)}</button>` : ''}
    <button class="object-select" type="button" aria-pressed="false">
      <span class="object-icon" style="--object-color: ${color}">${icon(symbol, 19)}</span>
      <span>${name}</span>
    </button>
    <button class="object-visibility" type="button" aria-label="隐藏${name}" title="隐藏${name}">${icon('eye', 17)}</button>
  </div>
`;
}

document.querySelector('#object-count').textContent = leaves.length;
objectList.innerHTML = components.map((component) => component.children
  ? `<div class="object-group">${objectRow(component)}
    <div class="object-children" id="children-${component.id}" hidden>${component.children.map(objectRow).join('')}</div>
  </div>`
  : objectRow(component)).join('');
const rows = new Map([...objectList.querySelectorAll('.object-row')].map((row) => [row.dataset.object, row]));

function setExpanded(id, expanded) {
  const button = rows.get(id).querySelector('.object-expand');
  button.setAttribute('aria-expanded', String(expanded));
  button.setAttribute('aria-label', `${expanded ? '折叠' : '展开'}${entries.get(id).name}`);
  document.getElementById(`children-${id}`).hidden = !expanded;
}

function renderInfo() {
  const component = entries.get(selected);
  const { floor, rack } = warehouse;
  info.innerHTML = component
    ? `<h3>选中对象</h3><strong>${component.name}</strong><p>${component.description}</p>`
    : `<h3>模型信息</h3><dl>
        <div><dt>地坪范围</dt><dd>${(floor.maxX - floor.minX).toFixed(1)} × ${floor.depth} m</dd></div>
        <div><dt>货架配置</dt><dd>${rack.rows * rack.stationsPerRow * rack.columnsPerStation} 列 × ${rack.bays} 跨 × ${rack.levels} 层</dd></div>
        <div><dt>尺寸依据</dt><dd>参考图估算</dd></div>
      </dl>`;
}

function select(id) {
  selected = id;
  const parent = parents.get(id);
  if (parent) setExpanded(parent, true);
  for (const [rowId, row] of rows) {
    const isSelected = rowId === id;
    row.classList.toggle('selected', isSelected);
    row.querySelector('.object-select').setAttribute('aria-pressed', String(isSelected));
  }
  renderInfo();
  viewer?.select(id);
}

function isVisible({ id, children }) {
  return children ? children.some((child) => visibility.get(child.id)) : visibility.get(id);
}

function setVisible(items, visible) {
  for (const { id } of items) {
    if (visibility.get(id) === visible) continue;
    visibility.set(id, visible);
    viewer?.setVisible(id, visible);
  }
  renderVisibility();
}

function renderVisibility() {
  for (const [id, row] of rows) {
    const component = entries.get(id);
    const visible = isVisible(component);
    const button = row.querySelector('.object-visibility');
    const label = `${visible ? '隐藏' : '显示'}${component.name}`;
    row.classList.toggle('muted', !visible);
    button.innerHTML = icon(visible ? 'eye' : 'eyeOff', 17);
    button.setAttribute('aria-label', label);
    button.title = label;
  }
  const visibleCount = [...visibility.values()].filter(Boolean).length;
  walls.setAttribute('aria-pressed', String(visibility.get('walls')));
  visibilityCount.textContent = `${visibleCount} / ${leaves.length} 个对象可见`;
  showAll.disabled = !viewer || visibleCount === leaves.length;
}

function updateView(view, area) {
  if (area !== activeArea && (area === 'inbound' || area === 'outbound')) setExpanded(area, true);
  activeArea = area;
  const following = view === 'avatar';
  for (const group of detailViews) group.hidden = group.dataset.detailArea !== area;
  const viewName = area === 'outbound' && view === 'iso' ? '车道近景' : (viewNames[view] ?? '自定义视图');
  viewLabel.textContent = following ? '数字人跟随' : `${areaNames[area]} · ${viewName}`;
  panHint.hidden = following;
  for (const button of viewButtons) {
    if (button.dataset.view === 'iso') button.textContent = area === 'outbound' ? '近景' : '轴测';
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  }
  for (const button of areaButtons) button.setAttribute('aria-pressed', String(button.dataset.area === area));
}

function updateAvatarSelection(selected) {
  avatarControl.setAttribute('aria-pressed', String(selected));
  avatarControl.title = selected ? '取消选中数字人' : '选中数字人';
  avatarPad.hidden = !selected;
  movementHint.textContent = selected ? 'WASD / 方向键移动 · 按住 Shift 冲刺' : flightHint;
  touchHint.textContent = selected ? '按住方向键走动 · 单指旋转视角' : '单指旋转 · 双指缩放和平移';
}

function focusArea(area) {
  if (area !== activeArea) setVisible([wallEntry], area === 'overview');
  viewer.focusArea(area);
  const url = new URL(location.href);
  if (area === 'overview') url.searchParams.delete('area');
  else url.searchParams.set('area', area);
  url.searchParams.delete('view');
  history.replaceState(null, '', url);
}

function chooseView(view) {
  viewer.fitView(view);
  const url = new URL(location.href);
  if (isDetailView(view, activeArea)) url.searchParams.set('view', view);
  else url.searchParams.delete('view');
  history.replaceState(null, '', url);
}

function notify(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

try {
  viewer = createViewer(document.querySelector('#canvas-host'), {
    axes: document.querySelector('.axis-key'),
    onSelect: select,
    onViewChange: updateView,
    onAvatarSelection: updateAvatarSelection,
    onAvatarReady: (ready) => {
      avatarControl.disabled = !ready;
      avatarView.disabled = !ready;
      avatarControl.title = ready ? '选中数字人' : '数字人载入失败';
      if (!ready) notify('数字人载入失败，刷新页面后可重试。');
    },
    initialArea,
    initialView,
  });
  viewer.setVisible('walls', visibility.get('walls'));
} catch (error) {
  console.error(error);
  const message = document.querySelector('#stage-message');
  message.hidden = false;
  message.textContent = '无法初始化三维视口。请在支持 WebGL 2 的浏览器中打开。';
  for (const button of document.querySelectorAll('button')) button.disabled = true;
}

select();
renderVisibility();

objectList.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const id = button.closest('.object-row').dataset.object;
  const component = entries.get(id);
  if (button.classList.contains('object-expand')) {
    setExpanded(id, button.getAttribute('aria-expanded') !== 'true');
  } else if (button.classList.contains('object-visibility')) {
    setVisible(component.children ?? [component], !isVisible(component));
  } else {
    viewer.setAvatarSelected(false);
    select(selected === id ? undefined : id);
  }
});

for (const button of viewButtons) button.addEventListener('click', () => chooseView(button.dataset.view));
for (const button of areaButtons) button.addEventListener('click', () => focusArea(button.dataset.area));
avatarControl.addEventListener('click', () => viewer.toggleAvatarControl());
for (const button of avatarPad.querySelectorAll('[data-step-key]')) {
  const key = button.dataset.stepKey;
  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    button.setPointerCapture(event.pointerId);
    viewer.setMovementKey(key, true);
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(event, () => viewer.setMovementKey(key, false));
  }
}
document.querySelector('#reset').addEventListener('click', () => focusArea('overview'));
showAll.addEventListener('click', () => setVisible(leaves, true));
walls.addEventListener('click', () => setVisible([wallEntry], !visibility.get('walls')));
grid.addEventListener('click', () => {
  const visible = grid.getAttribute('aria-pressed') !== 'true';
  grid.setAttribute('aria-pressed', String(visible));
  viewer.toggleGrid(visible);
});
fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await viewport.requestFullscreen();
  } catch {
    notify('当前浏览器无法进入全屏。');
  }
});
document.addEventListener('fullscreenchange', () => {
  const expanded = document.fullscreenElement === viewport;
  const label = expanded ? '退出全屏' : '全屏';
  fullscreen.innerHTML = icon(expanded ? 'collapse' : 'expand', 18);
  fullscreen.setAttribute('aria-label', label);
  fullscreen.title = label;
});
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || document.fullscreenElement) return;
  if (avatarControl.getAttribute('aria-pressed') === 'true') viewer.toggleAvatarControl();
  else if (selected) select();
});

exportButton.addEventListener('click', async () => {
  exportButton.disabled = true;
  exportLabel.textContent = '正在导出…';
  try {
    const url = URL.createObjectURL(await viewer.exportModel());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'warehouse.glb';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    notify('已导出完整场景');
  } catch (error) {
    console.error(error);
    notify('导出失败，请重试。');
  } finally {
    exportLabel.textContent = '导出 GLB';
    exportButton.disabled = false;
  }
});
