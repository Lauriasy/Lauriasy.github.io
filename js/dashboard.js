(function() {
  'use strict';

  const DEFAULTS = {
    mainColor: '#9c4146',
    darkMainColor: '#ffb3b4',
    displayMode: 'dark',   // 'light' | 'dark' | 'auto'
    asideEnable: true,
  };

  // 读写 localStorage
  function getSettings() {
    try {
      const saved = localStorage.getItem('anzhiyu_dashboard_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = { ...DEFAULTS, ...parsed };
        merged.asideEnable = Boolean(merged.asideEnable);
        return merged;
      }
    } catch (e) {}
    return { ...DEFAULTS };
  }

  function saveSettings(settings) {
    localStorage.setItem('anzhiyu_dashboard_settings', JSON.stringify(settings));
  }

  // 应用设置到页面（全面设置颜色变量）
  function applySettings(settings) {
    const root = document.documentElement;
    const body = document.body;

    // 1. 判断明暗
    let isDark = false;
    if (settings.displayMode === 'dark') isDark = true;
    else if (settings.displayMode === 'light') isDark = false;
    else { // auto
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // 2. 主色 - 设置所有可能用到的变量
    const mainColor = isDark ? settings.darkMainColor : settings.mainColor;
    root.style.setProperty('--anzhiyu-main', mainColor);
    root.style.setProperty('--anzhiyu-dark-main', settings.darkMainColor);
    root.style.setProperty('--anzhiyu-theme', mainColor);
    root.style.setProperty('--primary-color', mainColor);
    root.style.setProperty('--theme-color', mainColor);

    if (isDark) {
      root.style.setProperty('--anzhiyu-dark-main', settings.darkMainColor);
    }

    console.log('[Dashboard] 主色已设置为:', mainColor, '暗色主色:', settings.darkMainColor);

    // 3. 模式（同时操作 body 类和 html data-theme）
    body.classList.remove('dark', 'light');
    root.removeAttribute('data-theme');
    if (isDark) {
      body.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      body.classList.add('light');
      root.setAttribute('data-theme', 'light');
    }

    // 4. 侧边栏
    const aside = document.querySelector('#aside-content, .aside-content, #aside, .sidebar, #sidebar');
    if (aside) {
      aside.style.display = settings.asideEnable ? '' : 'none';
    } else {
      console.warn('[Dashboard] 未找到侧边栏元素');
    }
  }

  // ---------- 构建 UI ----------
  function buildUI() {
    if (document.getElementById('dashboard-overlay')) return;

    const settings = getSettings();

    const overlay = document.createElement('div');
    overlay.className = 'dashboard-overlay';
    overlay.id = 'dashboard-overlay';
    overlay.innerHTML = `
      <div class="dashboard-panel">
        <div class="dashboard-header">
          <h2>⚙️ 个性化设置</h2>
          <button class="dashboard-close" id="dashboard-close-btn">✕</button>
        </div>
        <div class="dashboard-body">
          <div class="dashboard-item">
            <label>亮色主色</label>
            <input type="color" id="mainColor" value="${settings.mainColor}">
          </div>
          <div class="dashboard-item">
            <label>暗色主色</label>
            <input type="color" id="darkMainColor" value="${settings.darkMainColor}">
          </div>
          <div class="dashboard-item">
            <label>显示模式</label>
            <select id="displayMode">
              <option value="light" ${settings.displayMode === 'light' ? 'selected' : ''}>亮色</option>
              <option value="dark" ${settings.displayMode === 'dark' ? 'selected' : ''}>暗色</option>
              <option value="auto" ${settings.displayMode === 'auto' ? 'selected' : ''}>跟随系统</option>
            </select>
          </div>
          <div class="dashboard-item">
            <label>侧边栏显示</label>
            <div class="toggle ${settings.asideEnable ? 'active' : ''}" id="asideEnable"></div>
          </div>
        </div>
        <div class="dashboard-footer">
          <button class="btn-reset" id="reset-btn">恢复默认</button>
          <button class="btn-close" id="save-close-btn">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    bindEvents();

    // ---------- 统一入口：隐藏主题自带的设置图标 ----------
    // 尝试查找安知鱼主题右下角的设置图标（常见类名/ID）
    const themeSettingsBtn = document.querySelector('#rightside .fa-cog') || 
                             document.querySelector('.rightside .fa-cog') ||
                             document.querySelector('#rightside-config') ||
                             document.querySelector('.rightside-config');
    if (themeSettingsBtn) {
      themeSettingsBtn.style.display = 'none';
      console.log('[Dashboard] 已隐藏主题自带的设置图标，统一使用Dashboard入口');
    }
  }

  function bindEvents() {
    // 入口按钮（如果主题没有自带图标，则创建我们的；如果主题有，我们将新建的作为补充，但已经隐藏了主题的，所以我们的将作为唯一入口）
    const trigger = document.createElement('button');
    trigger.className = 'dashboard-trigger';
    trigger.id = 'dashboard-trigger';
    trigger.innerHTML = '🎨';
    document.body.appendChild(trigger);

    trigger.addEventListener('click', () => {
      document.getElementById('dashboard-overlay').classList.add('active');
      const s = getSettings();
      document.getElementById('mainColor').value = s.mainColor;
      document.getElementById('darkMainColor').value = s.darkMainColor;
      document.getElementById('displayMode').value = s.displayMode;
      const toggle = document.getElementById('asideEnable');
      if (s.asideEnable) toggle.classList.add('active');
      else toggle.classList.remove('active');
    });

    // 关闭
    document.getElementById('dashboard-close-btn').addEventListener('click', closeDashboard);
    document.getElementById('save-close-btn').addEventListener('click', () => {
      saveFromUI();
      closeDashboard();
    });
    document.getElementById('dashboard-overlay').addEventListener('click', function(e) {
      if (e.target === this) closeDashboard();
    });

    // 实时保存（防抖）
    let timer;
    const saveHandler = () => {
      clearTimeout(timer);
      timer = setTimeout(saveFromUI, 300);
    };

    document.getElementById('mainColor').addEventListener('input', saveHandler);
    document.getElementById('darkMainColor').addEventListener('input', saveHandler);
    document.getElementById('displayMode').addEventListener('change', saveHandler);
    document.getElementById('asideEnable').addEventListener('click', function() {
      this.classList.toggle('active');
      saveHandler();
    });

    // 恢复默认
    document.getElementById('reset-btn').addEventListener('click', function() {
      if (confirm('恢复默认设置？页面将刷新。')) {
        localStorage.removeItem('anzhiyu_dashboard_settings');
        location.reload();
      }
    });

    // 系统颜色变化监听（auto 模式）
    if (window.matchMedia) {
      const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
      darkMedia.addEventListener('change', () => {
        const s = getSettings();
        if (s.displayMode === 'auto') applySettings(s);
      });
    }
  }

  // ---------- 保存并应用（改动都会触发 Snackbar） ----------
  function saveFromUI() {
    const newSettings = {
      mainColor: document.getElementById('mainColor').value,
      darkMainColor: document.getElementById('darkMainColor').value,
      displayMode: document.getElementById('displayMode').value,
      asideEnable: document.getElementById('asideEnable').classList.contains('active'),
    };
    const oldSettings = getSettings();
    applySettings(newSettings);
    saveSettings(newSettings);

    // 检测变化并生成提示消息
    let changed = false;
    let message = '';

    if (oldSettings.mainColor !== newSettings.mainColor ||
        oldSettings.darkMainColor !== newSettings.darkMainColor) {
      changed = true;
      message = '主题颜色已更新';
    }
    if (oldSettings.displayMode !== newSettings.displayMode) {
      changed = true;
      const modeName = newSettings.displayMode === 'dark' ? '暗色' :
                       newSettings.displayMode === 'light' ? '亮色' : '跟随系统';
      message = '已切换至 ' + modeName + ' 模式';
    }
    if (oldSettings.asideEnable !== newSettings.asideEnable) {
      changed = true;
      if (newSettings.displayMode === oldSettings.displayMode) {
        // 如果模式没变，则显示侧边栏变化
        message = '侧边栏' + (newSettings.asideEnable ? '已显示' : '已隐藏');
      }
    }

    // 如果没有任何变化，可能是重复操作，不提示
    if (changed) {
      // 如果模式变化优先显示模式信息，否则使用颜色或侧边栏信息
      if (oldSettings.displayMode !== newSettings.displayMode) {
        // 已设置 message 为模式切换信息
      } else if (message === '') {
        message = '个性化设置已更新';
      }
      // 调用主题自带的 Snackbar
      if (typeof anzhiyu !== 'undefined' && typeof anzhiyu.snackbarShow === 'function') {
        anzhiyu.snackbarShow(message);
      } else {
        alert(message);
      }
    }
  }

  function closeDashboard() {
    document.getElementById('dashboard-overlay').classList.remove('active');
  }

  // ---------- 初始化（立即执行） ----------
  function init() {
    const settings = getSettings();
    applySettings(settings);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', buildUI);
    } else {
      buildUI();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();